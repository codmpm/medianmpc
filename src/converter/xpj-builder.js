/**
 * MPC Project Builder
 * Creates an MPC project (.xpj) with one MIDI track per pattern.
 *
 * Unlike a .xtm, a project keeps its notes: every track gets its name, its
 * length and its notes, so loading the project gives all patterns at once.
 * The project has one sequence, as long as its longest track in whole bars.
 *
 * The template is a project saved by MPC 3.9.1.2 with one placeholder MIDI
 * track (plus the fixed submix, return and output tracks). The placeholder
 * track, its clip and one of its note events serve as patterns for the
 * generated tracks. The file is read and written with lossless-json, which
 * keeps numbers like 1.0 and 9223372036854775807 exactly as the MPC wrote
 * them.
 */

import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import templateUrl from './templates/project-template.xpj';
import { parse, stringify, clone, JsonNumber } from './lossless-json.js';

// An MPC project holds at most 128 MIDI tracks
export const MAX_PROJECT_TRACKS = 128;

const PLACEHOLDER = 'MIDI2MPC_TEMPLATE';
const BAR_PULSES = 4 * 960;

let templatePromise = null;

/**
 * Load and unpack the template once
 */
export function loadXpjTemplate() {
    if (!templatePromise) {
        templatePromise = fetch(templateUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Could not load .xpj template (HTTP ${response.status})`);
                }
                return response.arrayBuffer();
            })
            .then(buffer => {
                const text = strFromU8(gunzipSync(new Uint8Array(buffer)));
                const bodyStart = text.indexOf('{');
                if (bodyStart < 0 || !text.includes(`"${PLACEHOLDER}"`)) {
                    throw new Error('Unexpected .xpj template content');
                }
                return { header: text.slice(0, bodyStart), body: text.slice(bodyStart) };
            })
            .catch(error => {
                // Allow a retry on the next export
                templatePromise = null;
                throw error;
            });
    }
    return templatePromise;
}

const byKey = (a, b) => {
    const keyA = a.get('key');
    const keyB = b.get('key');
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
};

const isNoteEvent = (event) => event.get('type').text === '3';

/**
 * Build a gzipped .xpj.
 *
 * tracks: [{ name, lengthPulses, events }] with events as in a .mpcpattern
 * (type 2 note events: time, len, "1" = note, "2" = velocity 0-1). Names must
 * be unique. Only the first MAX_PROJECT_TRACKS tracks are used.
 */
export function buildXpj(template, tracks) {
    const used = tracks.slice(0, MAX_PROJECT_TRACKS);
    if (used.length === 0) {
        throw new Error('No tracks for the MPC project');
    }

    const root = parse(template.body);
    const data = root.get('data');
    const sequence = data.get('sequences')[0].get('value');
    const clipMap = sequence.get('trackClipMaps')[0];
    const clipPlayer = data.get('clipPlayerData');

    // Patterns from the placeholder
    const trackTemplate = data.get('tracks').find(track => track.get('name') === PLACEHOLDER);
    const clipTemplate = clipMap.find(entry => entry.get('key') === PLACEHOLDER);
    const transportTemplate = clipPlayer.get('trackClipTransportMap').find(entry => entry.get('key') === PLACEHOLDER);
    if (!trackTemplate || !clipTemplate || !transportTemplate) {
        throw new Error('Unexpected .xpj template content');
    }
    const templateEvents = clipTemplate.get('value').get('eventList').get('events');
    const fixedEvents = templateEvents.filter(event => !isNoteEvent(event));
    const noteTemplate = templateEvents.find(isNoteEvent);

    // The sequence is as long as the longest track, in whole bars
    const bars = Math.max(1, Math.ceil(Math.max(...used.map(track => track.lengthPulses)) / BAR_PULSES));
    const sequencePulses = bars * BAR_PULSES;
    sequence.set('lengthBars', JsonNumber.integer(bars));
    sequence.set('loopEndBar', JsonNumber.integer(bars));
    sequence.set('lengthPulses', JsonNumber.integer(sequencePulses));
    sequence.set('loopEndPulses', JsonNumber.integer(sequencePulses));

    const midiTracks = [];
    const midiClips = [];
    const midiTransports = [];

    used.forEach(({ name, lengthPulses, events }) => {
        const length = JsonNumber.integer(Math.round(lengthPulses));

        const track = clone(trackTemplate);
        track.set('name', name);
        track.get('program').set('name', name);
        track.set('length', length);
        midiTracks.push(track);

        const clipEntry = clone(clipTemplate);
        clipEntry.set('key', name);
        const clip = clipEntry.get('value');
        clip.set('name', name);
        clip.set('endPulses', JsonNumber.integer(sequencePulses));
        clip.set('loopEndPulses', length);
        const notes = events
            .filter(event => event.type === 2)
            .map(event => {
                const note = clone(noteTemplate);
                note.set('time', JsonNumber.integer(event.time));
                const noteData = note.get('note');
                noteData.set('note', JsonNumber.integer(Number(event['1'])));
                noteData.set('velocity', JsonNumber.double(Number(event['2'])));
                noteData.set('length', JsonNumber.integer(event.len));
                return note;
            });
        clip.get('eventList').set('events', [...fixedEvents.map(clone), ...notes]);
        midiClips.push(clipEntry);

        const transport = clone(transportTemplate);
        transport.set('key', name);
        midiTransports.push(transport);
    });

    // MIDI tracks first, then the fixed submix, return and output tracks
    data.set('tracks', [...midiTracks, ...data.get('tracks').filter(track => track !== trackTemplate)]);

    // The other clips span the whole sequence
    const otherClips = clipMap.filter(entry => entry !== clipTemplate);
    otherClips.forEach(entry => {
        entry.get('value').set('endPulses', JsonNumber.integer(sequencePulses));
        entry.get('value').set('loopEndPulses', JsonNumber.integer(sequencePulses));
    });
    sequence.get('trackClipMaps')[0] = [...midiClips, ...otherClips].sort(byKey);

    const otherTransports = clipPlayer.get('trackClipTransportMap').filter(entry => entry !== transportTemplate);
    clipPlayer.set('trackClipTransportMap', [...midiTransports, ...otherTransports].sort(byKey));

    return gzipSync(strToU8(template.header + stringify(root)), { mtime: 0 });
}
