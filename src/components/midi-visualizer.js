/**
 * MIDI Visualizer Component
 * Displays a MIDI track on a sixteenth-note grid with div-based rendering and
 * drag selection. Positions are MPC pulses (960 per quarter note) from the
 * start of the MIDI file, selections are whole sixteenths.
 */

import React, { Component } from 'react';
import { MPC_PPQ, SIXTEENTH_PULSES } from '../converter/mpc-converter.js';

const TARGET_WIDTH = 800; // Width of the timeline in pixels
const MIN_SIXTEENTH_LINE_SPACING = 4; // Hide sixteenth lines when they get denser

/**
 * MIDI Grid Component - Renders the note grid using divs (like the original)
 */
class MidiGrid extends Component {
    constructor(props) {
        super(props);
        this.el = null;
        this.insetX = 6;
        this.insetY = 4;
        this.noteHeight = 4;
        this.scaling = 1; // Pixels per MPC pulse
        this.height = 0;
        this.selectionEl = null;
    }

    componentDidMount() {
        this.symbolize();
        this.drawSelection(this.props.selection);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.track !== this.props.track
            || prevProps.converter !== this.props.converter
            || prevProps.totalSixteenths !== this.props.totalSixteenths) {
            this.symbolize();
        }
        this.drawSelection(this.props.selection);
    }

    symbolize() {
        const { track, converter, totalSixteenths } = this.props;
        const notes = track.notes;

        if (this.el) {
            this.el.innerHTML = '';
        }
        if (!notes || notes.length === 0 || !converter) {
            return;
        }

        const minPitch = Math.min(...notes.map(note => note.midi));
        const maxPitch = Math.max(...notes.map(note => note.midi));

        const totalPulses = totalSixteenths * SIXTEENTH_PULSES;
        this.scaling = TARGET_WIDTH / totalPulses;

        const gridDiv = document.createElement('div');
        gridDiv.className = 'midigrid';

        // Grid lines: bars, beats and (if not too dense) sixteenths
        const line = (color, pulses) =>
            `repeating-linear-gradient(to right, ${color} 0 1px, transparent 1px ${pulses * this.scaling}px)`;
        const layers = [line('rgba(0, 0, 0, 0.35)', 4 * MPC_PPQ), line('rgba(0, 0, 0, 0.18)', MPC_PPQ)];
        if (SIXTEENTH_PULSES * this.scaling >= MIN_SIXTEENTH_LINE_SPACING) {
            layers.push(line('rgba(0, 0, 0, 0.07)', SIXTEENTH_PULSES));
        }
        gridDiv.style.backgroundImage = layers.join(', ');
        gridDiv.style.backgroundPosition = `${this.insetX}px 0`;
        gridDiv.style.backgroundRepeat = 'no-repeat';
        gridDiv.style.backgroundSize = `${Math.round(totalPulses * this.scaling) + 1}px 100%`;

        notes.forEach(note => {
            const start = converter.toMpcPulses(note.time);
            const end = converter.toMpcPulses(note.time + note.duration);

            const noteDiv = document.createElement('div');
            noteDiv.className = 'midiitem';
            noteDiv.style.left = this.pulsesToX(start) + 'px';
            noteDiv.style.top = ((maxPitch - note.midi) * this.noteHeight + this.insetY) + 'px';
            noteDiv.style.width = Math.max(2, Math.round((end - start) * this.scaling)) + 'px';
            noteDiv.style.height = this.noteHeight + 'px';
            gridDiv.appendChild(noteDiv);
        });

        this.height = Math.round((maxPitch - minPitch + 1) * this.noteHeight + 2 * this.insetY + 2);

        this.selectionEl = document.createElement('div');
        this.selectionEl.className = 'selbox';
        gridDiv.appendChild(this.selectionEl);

        gridDiv.style.width = (Math.round(totalPulses * this.scaling) + 2 * this.insetX) + 'px';
        gridDiv.style.height = this.height + 'px';

        if (this.el) {
            this.el.appendChild(gridDiv);
        }
    }

    /**
     * Show a selection of whole sixteenths, or hide it for null
     */
    drawSelection(selection) {
        if (!this.selectionEl) {
            return;
        }
        if (!selection || selection.end <= selection.start) {
            this.selectionEl.style.display = 'none';
            return;
        }
        const startX = this.pulsesToX(selection.start * SIXTEENTH_PULSES);
        const endX = this.pulsesToX(selection.end * SIXTEENTH_PULSES);
        this.selectionEl.style.display = 'block';
        this.selectionEl.style.left = startX + 'px';
        this.selectionEl.style.width = (endX - startX) + 'px';
        this.selectionEl.style.top = '0px';
        this.selectionEl.style.height = this.height + 'px';
    }

    pulsesToX(pulses) {
        return Math.round(pulses * this.scaling) + this.insetX;
    }

    /**
     * Pixel position to the nearest sixteenth, limited to the grid
     */
    xToSixteenth(x) {
        const sixteenth = Math.round((x - this.insetX) / this.scaling / SIXTEENTH_PULSES);
        return Math.min(this.props.totalSixteenths, Math.max(0, sixteenth));
    }

    bounds() {
        return this.el ? this.el.getBoundingClientRect() : { left: 0, top: 0 };
    }

    render() {
        return React.createElement('div', {
            ref: el => this.el = el
        }, ' ');
    }
}

/**
 * Interactive MIDI Visualizer with drag selection that snaps to sixteenths.
 * The selection is controlled by the parent: `selection` ({ start, end } in
 * sixteenths, or null) and `onSelectionChange`.
 */
export class MidiVisualizer extends Component {
    constructor(props) {
        super(props);
        this.plot = null;
    }

    handleMouseDown = (e) => {
        if (!this.plot) {
            return;
        }
        e.preventDefault();

        const bounds = this.plot.bounds();
        const startSixteenth = this.plot.xToSixteenth(e.clientX - bounds.left);
        let endSixteenth = startSixteenth;

        const currentSelection = () => ({
            start: Math.min(startSixteenth, endSixteenth),
            end: Math.max(startSixteenth, endSixteenth)
        });

        const handleMouseMove = (moveEvent) => {
            endSixteenth = this.plot.xToSixteenth(moveEvent.clientX - bounds.left);
            this.plot.drawSelection(currentSelection());
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            // A click without dragging over at least one sixteenth clears the selection
            const selection = currentSelection();
            if (this.props.onSelectionChange) {
                this.props.onSelectionChange(selection.end > selection.start ? selection : null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    render() {
        return React.createElement('div', {
            onMouseDown: this.handleMouseDown,
            className: 'midi-visualizer'
        }, React.createElement(MidiGrid, {
            ref: plot => this.plot = plot,
            track: this.props.track,
            converter: this.props.converter,
            totalSixteenths: this.props.totalSixteenths,
            selection: this.props.selection
        }));
    }
}
