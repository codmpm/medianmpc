/**
 * Track Component
 * Displays individual MIDI track with conversion controls
 */

import React, { Component } from 'react';
import { MidiVisualizer } from './midi-visualizer.js';
import { MPCConverter, SIXTEENTH_PULSES, downloadBlob } from '../converter/mpc-converter.js';
import { MidiPlayer } from './midi-player.js';
import { getGeneralMidiInstrumentName } from '../midi/midi-utils.js';

export class TrackComponent extends Component {
    constructor(props) {
        super(props);
        this.state = {
            isConverting: false
        };
    }

    handleConvertToMPC = () => {
        const { track, trackNum, midiTrackIndex, converter, fileName, isOnlyTrack, toneTrack, range } = this.props;

        if (!track || !converter || !range) {
            console.error('Missing track, converter or range');
            return;
        }

        this.setState({ isConverting: true });

        try {
            const mpcPattern = converter.convertRangeToMPC(
                midiTrackIndex,
                range.start * SIXTEENTH_PULSES,
                range.end * SIXTEENTH_PULSES
            );

            const { blob, filename } = MPCConverter.createMPCFile(
                mpcPattern,
                fileName,
                isOnlyTrack ? '' : (track.name || toneTrack?.name || `Track ${trackNum}`)
            );

            downloadBlob(blob, filename);

        } catch (error) {
            console.error('Error converting to MPC:', error);
            alert(`Error converting track: ${error.message}`);
        } finally {
            this.setState({ isConverting: false });
        }
    };

    getTrackStats = () => {
        const { track } = this.props;
        if (!track || !track.notes) return null;

        const noteCount = track.notes.length;
        if (noteCount === 0) return { noteCount: 0 };

        let minPitch = Infinity;
        let maxPitch = -Infinity;
        let totalDuration = 0;
        let minTime = Infinity;
        let maxTime = -Infinity;

        track.notes.forEach(note => {
            minPitch = Math.min(minPitch, note.midi);
            maxPitch = Math.max(maxPitch, note.midi);
            totalDuration += note.duration;
            minTime = Math.min(minTime, note.time);
            maxTime = Math.max(maxTime, note.time + note.duration);
        });

        return {
            noteCount,
            pitchRange: { min: minPitch, max: maxPitch },
            timeRange: { start: minTime, end: maxTime, duration: maxTime - minTime },
            averageDuration: totalDuration / noteCount
        };
    };

    formatNoteName = (midiNumber) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNumber / 12) - 1;
        const noteName = noteNames[midiNumber % 12];
        return `${noteName}${octave}`;
    };

    // Position or length in sixteenths in MPC notation, bars:beats:ticks
    formatSixteenths = (sixteenths) => MPCConverter.formatMpcLength(sixteenths * SIXTEENTH_PULSES);

    render() {
    const { track, trackNum, toneTrack, toneMidi, selected, onToggleSelect, converter, range, selection, onSelectionChange, totalSixteenths, includeXtm, fileActions } = this.props;
        const { isConverting } = this.state;

        if (!track) {
            return (
                <div className="track-component empty">
                    <h3>Track {trackNum}</h3>
                    <p>No track data available</p>
                </div>
            );
        }

    const stats = this.getTrackStats();
    const hasSelection = !!selection;
    const patternNoteCount = converter && range
        ? converter.convertRangeToMPC(this.props.midiTrackIndex, range.start * SIXTEENTH_PULSES, range.end * SIXTEENTH_PULSES).pattern.events.length
        : 0;
    // Fix: get midiArrayBuffer from props
    const { midiArrayBuffer } = this.props;

    const toneInstrument = toneTrack && toneTrack.instrument ? toneTrack.instrument : null;
    const formatInstrumentString = (value) => {
        if (!value || typeof value !== 'string') return '';
        const cleaned = value.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleaned) return '';
        return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const sanitizeName = (value) => {
        if (!value || typeof value !== 'string') {
            return '';
        }
        const cleaned = value
            .replace(/[\u0000-\u001F\u007F]/g, ' ')
            .replace(/[_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned) {
            return '';
        }
        return cleaned;
    };

    const formatTrackDisplayName = () => {
        const primary = sanitizeName(track.name);
        if (primary) {
            return primary;
        }

        const toneName = sanitizeName(toneTrack && toneTrack.name);
        if (toneName) {
            return toneName;
        }

        return '';
    };

    const displayTrackName = formatTrackDisplayName();

    const toneInstrumentName = toneInstrument
        ? formatInstrumentString(toneInstrument.name || toneInstrument.family)
        : '';

    const programNumber = typeof track.instrument === 'number'
        ? track.instrument
        : (toneInstrument && typeof toneInstrument.number === 'number' ? toneInstrument.number : null);

    const programInstrumentName = typeof programNumber === 'number'
        ? getGeneralMidiInstrumentName(programNumber)
        : '';

    const instrumentLabel = track.instrumentName
        || toneInstrumentName
        || programInstrumentName
        || '';
    console.log(`Track ${trackNum} stats:`, stats);

        return (
            <div className="track-component">
                <div className="track-header">
                    <div className="track-header-row">
                        <h3>
                            Track {trackNum}
                            {displayTrackName && (
                                <span className="track-name">: {displayTrackName}</span>
                            )}
                        </h3>
                        {onToggleSelect && (
                            <label className="select-toggle">
                                <input
                                    type="checkbox"
                                    checked={!!selected}
                                    onChange={onToggleSelect}
                                />
                                Include in ZIP
                            </label>
                        )}
                    </div>
                    
                    {stats && (
                        <div className="track-stats">
                            <span className="stat">Notes: {stats.noteCount}</span>
                            {stats.noteCount > 0 && (
                                <>
                                    <span className="stat">
                                        Range: {this.formatNoteName(stats.pitchRange.min)} - {this.formatNoteName(stats.pitchRange.max)}
                                    </span>
                                    {converter && (
                                        <span className="stat">
                                            Duration: {MPCConverter.formatMpcLength(
                                                converter.toMpcPulses(stats.timeRange.end) - converter.toMpcPulses(stats.timeRange.start)
                                            )}
                                        </span>
                                    )}
                                    {track.channel !== undefined && (
                                        <span className="stat">Channel: {track.channel + 1}</span>
                                    )}
                                    {instrumentLabel && (
                                        <span className="stat">Instrument: {instrumentLabel}</span>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {stats && stats.noteCount > 0 && (
                    <div className="track-content">
                        <div className="timeline-area">
                            <MidiVisualizer
                                track={track}
                                converter={converter}
                                totalSixteenths={totalSixteenths}
                                selection={selection}
                                onSelectionChange={onSelectionChange}
                            />
                            {range && (
                                <div className={`length-badge${hasSelection ? ' is-selection' : ''}`}>
                                    <span className="length-badge-label">
                                        {hasSelection ? 'Selection length' : 'Pattern length'}
                                    </span>
                                    <span className="length-badge-value">
                                        {this.formatSixteenths(range.end - range.start)}
                                    </span>
                                    <span className="length-badge-steps">
                                        ({range.end - range.start} {range.end - range.start === 1 ? 'step' : 'steps'})
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="track-controls">
                            {range && (
                                <div className="selection-info">
                                    <span className="selection-label">
                                        {hasSelection ? 'Selection' : 'Whole pattern'}:
                                    </span>
                                    <span className="mpc-time">
                                        {this.formatSixteenths(range.start)} – {this.formatSixteenths(range.end)}
                                    </span>
                                    <span>{patternNoteCount} {patternNoteCount === 1 ? 'note' : 'notes'}</span>
                                    <span className="selection-hint">
                                        {hasSelection
                                            ? 'Only notes completely inside the selection are exported.'
                                            : 'Drag on the timeline to select a range (snaps to sixteenths).'}
                                        {includeXtm ? ' The length is used as track length in the .xtm.' : ''}
                                    </span>
                                </div>
                            )}

                            <div className="action-buttons">
                                <button 
                                    className="mpc-button"
                                    onClick={this.handleConvertToMPC}
                                    disabled={isConverting || !stats || stats.noteCount === 0}
                                >
                                    {isConverting ? 'Converting...' : (hasSelection ? 'Download selection as pattern' : 'Download pattern')}
                                </button>
                                <MidiPlayer
                                    midiArrayBuffer={midiArrayBuffer}
                                    trackIndex={this.props.midiTrackIndex}
                                    toneTrack={toneTrack}
                                    toneMidi={toneMidi}
                                    track={track}
                                />
                                {hasSelection && (
                                    <button
                                        className="clear-selection-button"
                                        onClick={() => onSelectionChange && onSelectionChange(null)}
                                    >
                                        Clear Selection
                                    </button>
                                )}
                                {fileActions}
                            </div>
                        </div>
                    </div>
                )}

                {stats && stats.noteCount === 0 && (
                    <div className="empty-track">
                        <p>This track contains no notes to convert.</p>
                    </div>
                )}
            </div>
        );
    }
}

/**
 * Track Header Component
 * Displays basic information about the MIDI file
 */
export class MidiHeader extends Component {
    render() {
        const { header, text, stats } = this.props;

        if (!header) return null;

        const items = [
            ['Format', `Type ${header.format || 0}`],
            ['Tracks', header.trackCount || 0],
            ...(stats ? [
                ['Tracks with Notes', stats.tracksWithNotes],
                ['Total Notes', stats.totalNotes]
            ] : []),
            ['Time Division', `${header.ticksPerQuarter || header.timeDivision || 480} ticks per 1/4 note`],
            ...(header.tempoBPM ? [
                ['Tempo', `${header.tempoBPM.toFixed ? header.tempoBPM.toFixed(2) : header.tempoBPM} BPM`]
            ] : [])
        ];

        return (
            <div className="midi-header">
                <h2>MIDI File Information</h2>
                <div className="header-info">
                    {items.map(([label, value]) => (
                        <div className="header-row" key={label}>
                            <span className="label">{label}:</span>
                            <span className="value">{value}</span>
                        </div>
                    ))}
                </div>
                {text && (
                    <div className="header-file">
                        <span className="label">File:</span>
                        <span className="file-name">{text}</span>
                    </div>
                )}
            </div>
        );
    }
}
