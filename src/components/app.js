/**
 * Main Application Component
 * Handles the complete MIDI to MPC conversion workflow
 */

import React, { Component } from 'react';
import { FileWidget } from './file-widget.js';
import { TrackComponent, MidiHeader } from './track-component.js';
import { MidiDocument } from '../midi/midi-utils.js';
import { MPCConverter, downloadBlob } from '../converter/mpc-converter.js';
import { Midi } from '@tonejs/midi';
import { zipSync, strToU8 } from 'fflate';

export class MidiConverterApp extends Component {
    constructor(props) {
        super(props);
        this.state = {
            files: [],
            selected: new Set(),
            pendingLoads: 0,
            errors: [],
            isExporting: false
        };

        this.nextFileId = 1;
    }

    handleFileSelect = (files) => {
        console.log(`Selected ${files.length} file(s)`);
        this.setState(prev => ({ pendingLoads: prev.pendingLoads + files.length }));
    };

    parseMidiFile = (data) => {
        // Parse MIDI file
        const midiDocument = MidiDocument.fromBuffer(data);

        // Parse with tone.js for playback (preserves tempo and channel data)
        const toneMidi = new Midi(data);

        // Prefer Tone.js tempo parsing if available (handles multiple tempo changes accurately)
        let detectedTempo = midiDocument?.header?.tempoBPM || null;
        if (toneMidi?.header) {
            if (Array.isArray(toneMidi.header.tempos) && toneMidi.header.tempos.length > 0) {
                const earliestTempo = [...toneMidi.header.tempos].sort((a, b) => (a.ticks || 0) - (b.ticks || 0))[0];
                if (earliestTempo?.bpm) {
                    detectedTempo = earliestTempo.bpm;
                }
            } else if (toneMidi.header.bpm) {
                detectedTempo = toneMidi.header.bpm;
            }
        }

        if (detectedTempo) {
            const tempoBPM = Number.parseFloat(detectedTempo) || 120;
            midiDocument.header = {
                ...midiDocument.header,
                tempoBPM
            };
            midiDocument.tempoBPM = tempoBPM;
        }

        const converter = new MPCConverter(midiDocument);
        converter.calcTimeBounds();

        return { midiDocument, toneMidi, converter };
    };

    handleFileLoad = ({ data, name }) => {
        console.log(`Loading file: ${name} (${data.byteLength} bytes)`);

        try {
            const { midiDocument, toneMidi, converter } = this.parseMidiFile(data);
            const entry = {
                id: this.nextFileId++,
                name,
                midiDocument,
                toneMidi,
                converter,
                midiArrayBuffer: data
            };

            this.setState(prev => {
                const selected = new Set(prev.selected);
                this.getTrackKeys(entry).forEach(key => selected.add(key));
                return {
                    files: [...prev.files, entry],
                    selected,
                    pendingLoads: Math.max(0, prev.pendingLoads - 1)
                };
            });

            console.log(`Successfully loaded ${name} with ${midiDocument.tracks.length} tracks`);
        } catch (error) {
            console.error('Error loading MIDI file:', error);
            this.setState(prev => ({
                errors: [...prev.errors, `${name}: ${error.message}`],
                pendingLoads: Math.max(0, prev.pendingLoads - 1)
            }));
        }
    };

    handleFileError = (error) => {
        console.error('File error:', error);
        this.setState(prev => ({
            errors: [...prev.errors, String(error)],
            pendingLoads: Math.max(0, prev.pendingLoads - 1)
        }));
    };

    handleFileProgress = (progress, file) => {
        console.log(`Loading progress: ${progress.toFixed(1)}% - ${file.name}`);
    };

    removeFile = (id) => {
        this.setState(prev => {
            const fileEntry = prev.files.find(file => file.id === id);
            const selected = new Set(prev.selected);
            if (fileEntry) {
                this.getTrackKeys(fileEntry).forEach(key => selected.delete(key));
            }
            return { files: prev.files.filter(file => file.id !== id), selected };
        });
    };

    clearAll = () => {
        this.setState({ files: [], selected: new Set(), errors: [], pendingLoads: 0 });
    };

    trackKey = (fileId, midiTrackIndex) => `${fileId}:${midiTrackIndex}`;

    getTrackKeys = (fileEntry) => {
        return this.getTracksWithNotes(fileEntry.midiDocument)
            .map(({ midiTrackIndex }) => this.trackKey(fileEntry.id, midiTrackIndex));
    };

    setSelected = (keys, isSelected) => {
        this.setState(prev => {
            const selected = new Set(prev.selected);
            keys.forEach(key => (isSelected ? selected.add(key) : selected.delete(key)));
            return { selected };
        });
    };

    toggleTrack = (key) => {
        this.setSelected([key], !this.state.selected.has(key));
    };

    toggleFile = (fileEntry) => {
        const keys = this.getTrackKeys(fileEntry);
        const allSelected = keys.every(key => this.state.selected.has(key));
        this.setSelected(keys, !allSelected);
    };

    toggleAll = () => {
        const keys = this.state.files.flatMap(this.getTrackKeys);
        const allSelected = keys.length > 0 && keys.every(key => this.state.selected.has(key));
        this.setSelected(keys, !allSelected);
    };

    clearErrors = () => {
        this.setState({ errors: [] });
    };

    getTracksWithNotes = (midiDocument) => {
        return midiDocument.tracks
            .map((track, midiTrackIndex) => ({ track, midiTrackIndex }))
            .filter(({ track }) => track.notes && track.notes.length > 0);
    };

    /**
     * Build one pattern per selected track; a file with a single note track
     * becomes "<file name>.mpcpattern"
     */
    buildPatternFiles = (fileEntry) => {
        const tracks = this.getTracksWithNotes(fileEntry.midiDocument);
        const toneTracks = fileEntry.toneMidi
            ? fileEntry.toneMidi.tracks.filter(track => track.notes && track.notes.length > 0)
            : [];

        return tracks
            .map(({ track, midiTrackIndex }, uiIndex) => ({ track, midiTrackIndex, uiIndex }))
            .filter(({ midiTrackIndex }) => this.state.selected.has(this.trackKey(fileEntry.id, midiTrackIndex)))
            .map(({ track, midiTrackIndex, uiIndex }) => {
                const pattern = fileEntry.converter.convertFullTrack(midiTrackIndex);
                const label = tracks.length === 1
                    ? ''
                    : (track.name || toneTracks[uiIndex]?.name || `Track ${uiIndex + 1}`);
                return {
                    filename: MPCConverter.buildFilename(fileEntry.name, label),
                    content: MPCConverter.exportMPCPattern(pattern)
                };
            });
    };

    downloadSelectedAsZip = () => {
        this.setState({ isExporting: true });
        try {
            const zipEntries = {};
            this.state.files.flatMap(this.buildPatternFiles).forEach(({ filename, content }) => {
                // Same MIDI file name loaded twice: keep both patterns
                let uniqueName = filename;
                for (let n = 2; zipEntries[uniqueName]; n++) {
                    uniqueName = filename.replace(/\.mpcpattern$/, ` (${n}).mpcpattern`);
                }
                zipEntries[uniqueName] = strToU8(content);
            });

            const zipData = zipSync(zipEntries);
            downloadBlob(new Blob([zipData], { type: 'application/zip' }), 'mpc-patterns.zip');
        } catch (error) {
            console.error('Error exporting patterns:', error);
            this.setState(prev => ({ errors: [...prev.errors, `Export: ${error.message}`] }));
        } finally {
            this.setState({ isExporting: false });
        }
    };

    renderTrackList = (fileEntry) => {
        const { midiDocument, converter, midiArrayBuffer, toneMidi, name } = fileEntry;

        // Only show tracks with notes, but keep their original MIDI file index
        const tracksWithNotes = this.getTracksWithNotes(midiDocument);

        const toneTracksWithNotes = toneMidi
            ? toneMidi.tracks.filter(track => track.notes && track.notes.length > 0)
            : [];

        return (
            <div className="track-list">
                {tracksWithNotes.map(({ track, midiTrackIndex }, uiIndex) => {
                    const toneTrack = toneTracksWithNotes[uiIndex] || null;
                    if (!toneTrack) {
                        console.warn(`No Tone.js track found for MIDI track index ${midiTrackIndex}.`);
                    }

                    return (
                        <TrackComponent
                            key={`track-${midiTrackIndex}`}
                            track={track}
                            trackNum={uiIndex + 1}
                            midiTrackIndex={midiTrackIndex}
                            song={midiDocument}
                            converter={converter}
                            fileName={name}
                            isOnlyTrack={tracksWithNotes.length === 1}
                            selected={this.state.selected.has(this.trackKey(fileEntry.id, midiTrackIndex))}
                            onToggleSelect={() => this.toggleTrack(this.trackKey(fileEntry.id, midiTrackIndex))}
                            midiArrayBuffer={midiArrayBuffer}
                            toneTrack={toneTrack}
                            toneMidi={toneMidi}
                        />
                    );
                })}
            </div>
        );
    };

    renderStats = (midiDocument) => {
        let totalNotes = 0;
        let totalTracks = midiDocument.tracks.length;
        let tracksWithNotes = 0;

        midiDocument.tracks.forEach(track => {
            if (track.notes && track.notes.length > 0) {
                totalNotes += track.notes.length;
                tracksWithNotes++;
            }
        });

        return (
            <div className="midi-stats">
                <div className="stats-row">
                    <span className="stat-item">Total Tracks: {totalTracks}</span>
                    <span className="stat-item">Tracks with Notes: {tracksWithNotes}</span>
                    <span className="stat-item">Total Notes: {totalNotes}</span>
                </div>
            </div>
        );
    };

    renderFile = (fileEntry) => {
        const { selected } = this.state;
        const { midiDocument, name, id } = fileEntry;
        const trackKeys = this.getTrackKeys(fileEntry);
        const selectedCount = trackKeys.filter(key => selected.has(key)).length;

        return (
            <div className="midi-content" key={`file-${id}`}>
                <div className="content-header">
                    <MidiHeader
                        header={midiDocument.header}
                        text={name}
                    />

                    {this.renderStats(midiDocument)}

                    <div className="content-controls">
                        <label className="select-toggle">
                            <input
                                type="checkbox"
                                checked={trackKeys.length > 0 && selectedCount === trackKeys.length}
                                onChange={() => this.toggleFile(fileEntry)}
                            />
                            Include all tracks of this file in ZIP
                        </label>
                        <button
                            className="clear-button"
                            onClick={() => this.removeFile(id)}
                        >
                            Remove file
                        </button>
                    </div>
                </div>

                {this.renderTrackList(fileEntry)}
            </div>
        );
    };

    render() {
        const { files, selected, pendingLoads, errors, isExporting } = this.state;
        const allTrackKeys = files.flatMap(this.getTrackKeys);
        const selectedCount = allTrackKeys.filter(key => selected.has(key)).length;

        return (
            <div className="midi-converter-app">
                <div className="app-header">
                    <h1>MIDI to MPC Pattern Converter</h1>
                    <p className="app-description">
                        Convert MIDI files to MPC pattern format for Akai Force and other Akai products.
                        Select one or more MIDI files, choose the tracks and time ranges you want to convert,
                        and download the resulting MPC pattern files.
                    </p>
                    <p className="app-credit" style={{ fontSize: '0.95em', color: '#888', marginTop: '10px' }}>
                        Based on the original by <a href="https://www.fentonia.com/catnip/midianmpc/index.html" target="_blank" rel="noopener noreferrer">Catnip/Jamie Faye Fenton (Fentonia)</a>.
                    </p>
                    <p className="app-source" style={{ fontSize: '0.95em', marginTop: '6px' }}>
                        View this project on <a href="https://github.com/miathedev/medianmpc" target="_blank" rel="noopener noreferrer">GitHub</a>.
                    </p>
                </div>

                <div className="file-section">
                    <FileWidget
                        acceptedTypes={['.mid', '.midi', '.MID', '.MIDI']}
                        multiple={true}
                        onFileSelect={this.handleFileSelect}
                        onFileLoad={this.handleFileLoad}
                        onError={this.handleFileError}
                        onProgress={this.handleFileProgress}
                        dragAndDrop={true}
                    />
                </div>

                {pendingLoads > 0 && (
                    <div className="loading-section">
                        <div className="loading-spinner"></div>
                        <p>Loading MIDI files...</p>
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="error-section">
                        <div className="error-message">
                            <h3>Error</h3>
                            {errors.map((error, index) => (
                                <p key={index}>{error}</p>
                            ))}
                            <button onClick={this.clearErrors}>
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {files.length > 0 && (
                    <div className="content-controls">
                        <label className="select-toggle">
                            <input
                                type="checkbox"
                                checked={allTrackKeys.length > 0 && selectedCount === allTrackKeys.length}
                                onChange={this.toggleAll}
                            />
                            Select all
                        </label>
                        <button
                            className="mpc-button"
                            onClick={this.downloadSelectedAsZip}
                            disabled={isExporting || selectedCount === 0}
                        >
                            {isExporting ? 'Exporting...' : `Download ${selectedCount} pattern${selectedCount === 1 ? '' : 's'} as ZIP`}
                        </button>
                        <button
                            className="clear-button"
                            onClick={this.clearAll}
                        >
                            Remove all files
                        </button>
                    </div>
                )}

                {files.map(this.renderFile)}

                <div className="usage-notes">
                    <h3>Usage Notes</h3>
                    <ul>
                        <li>You can load several MIDI files at once. Tick the tracks you want and download them together as one ZIP file.</li>
                        <li>You can select a subset of a track to extract by clicking and dragging on the timeline.</li>
                        <li>At present, the program only converts Note On/Note Off events.</li>
                        <li>The MIDI file you choose and the MPC pattern files are processed entirely on your computer. No data is sent elsewhere.</li>
                        <li>MPC pattern files can be imported into Akai Force, MPC Live, MPC X, and other compatible devices.</li>
                        <li>Patterns are named after the MIDI file. Files with several tracks get one pattern per track, named &quot;&lt;file&gt; - &lt;track&gt;.mpcpattern&quot;.</li>
                    </ul>
                </div>
            </div>
        );
    }
}

/**
 * Widget Manager Class
 * Handles the integration with the original widget system
 */
export class WidgetManager {
    constructor(containerId) {
        this.idNumber = ++WidgetManager.idCounter;
        this.idString = '' + this.idNumber;
        this.homeId = this.idFor(containerId);
        this.container = document.getElementById(containerId);

        if (!this.container) {
            throw new Error(`Container with id '${containerId}' not found`);
        }
    }

    static idCounter = 0;

    idFor(elementId) {
        return '#' + elementId + this.idString;
    }

    bindGui() {
        // Set up any additional GUI bindings
        const buttonRow = document.querySelector(this.idFor('butnrow'));
        if (buttonRow) {
            // Additional button setup if needed
        }
    }

    setDisable(element, disabled) {
        if (element && element.prop) {
            element.prop('disabled', disabled);
            element.css('opacity', disabled ? 0.3 : 1);
        }
    }

    setEditData(data) {
        // Handle MIDI data editing
        if (!this.midiDoc) {
            // Initialize MIDI document viewer if needed
        }

        if (this.midiDoc && this.midiDoc.openOnBuffer) {
            this.midiDoc.openOnBuffer(data);
        }
    }

    openLocal(event) {
        const files = event.target.files;
        if (files && files.length > 0) {
            this.loadFile(files[0]);
        }
    }

    loadFile(file) {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const arrayBuffer = event.target.result;
                this.handleMidiData(arrayBuffer, file.name);
            } catch (error) {
                console.error('Error reading file:', error);
                alert(`Error reading file: ${error.message}`);
            }
        };

        reader.onerror = () => {
            console.error('Error reading file');
            alert('Error reading file');
        };

        reader.readAsArrayBuffer(file);
    }

    handleMidiData(data, filename) {
        try {
            const midiDocument = MidiDocument.fromBuffer(data);
            const converter = new MPCConverter(midiDocument);

            // Render React app
            const app = React.createElement(MidiConverterApp, {
                initialMidiDocument: midiDocument,
                initialMidiText: filename,
                initialConverter: converter
            });

            // You would need to use ReactDOM.render here in a real implementation
            console.log('MIDI data processed successfully');

        } catch (error) {
            console.error('Error processing MIDI data:', error);
            alert(`Error processing MIDI file: ${error.message}`);
        }
    }
}