# MIDI to MPC Pattern Converter

A web-based application that converts MIDI files to MPC pattern format (.mpcpattern) for Akai Force and other Akai products. This project has been unminified and restructured from the original by [Catnip/Jamie Faye Fenton (Fentonia)](https://www.fentonia.com/catnip/midianmpc/index.html) into a modular, maintainable codebase.

This is a fork of [miathedev/medianmpc](https://github.com/miathedev/medianmpc) that adds loading several files, a ZIP export, sixteenth-snapped selections and .xtm track files for saving custom arp patterns on the MPC.

- **Use it online**: https://codmpm.github.io/medianmpc/
- **Current version**: 0.1.1, see the [changelog](CHANGELOG.md). The version is also shown on the website.

## Features

- **MIDI File Support**: Load and parse standard MIDI files (.mid, .midi)
- **Multiple Files**: Load several MIDI files at once, each shown in its own section
- **Visual Timeline**: Interactive graphical display of MIDI tracks with note visualization
- **Time Selection**: Click and drag on a timeline with bar, beat and sixteenth lines to select the range of a pattern; it snaps to sixteenths
- **Multi-Track Support**: Convert individual tracks or entire MIDI files
- **MPC Pattern Export**: Generate .mpcpattern files compatible with Akai devices
- **Meaningful File Names**: Patterns are named after the MIDI file (and track), not "Track_1"
- **ZIP Export**: Tick the tracks you want and download all their patterns as one ZIP file
- **Matching .xtm Track Files**: Optionally add an empty MPC track file per pattern, so the MPC suggests the right name when you save the pattern as a custom arp pattern
- **Pattern Length**: Each .xtm carries the track length: the selection, or a length suggested from the notes
- **Real-time Preview**: See notes, velocities, and timing information
- **Drag & Drop**: Easy file loading with drag and drop support

## Project Structure

```
src/
├── components/           # React components
│   ├── app.js           # Main application component
│   ├── file-widget.js   # File input and drag & drop handling
│   ├── midi-player.js   # Track playback
│   ├── midi-visualizer.js  # MIDI track visualization
│   └── track-component.js   # Individual track display and controls
├── converter/           # MPC conversion logic
│   ├── mpc-converter.js # MIDI to MPC pattern conversion and file naming
│   ├── xtm-builder.js   # Builds named, empty MPC track files (.xtm)
│   └── templates/
│       └── track-template.xtm  # Empty track file saved by MPC 3.9.1.2
├── midi/               # MIDI processing utilities
│   ├── midi-utils.js   # Core MIDI classes and utilities
│   ├── midi-parser.js  # MIDI file parsing
│   └── midi-writer.js  # MIDI file writing
├── styles/             # CSS styles
│   └── components.css  # Component styles
├── utils/              # Utility functions
│   └── webpack-runtime.js  # Webpack module system
└── main.js             # Application entry point
```

## Installation

1. Clone or download the project files
2. Install dependencies (Node.js 22.15 or newer):
```bash
npm ci
```

## Development

Start the development server:
```bash
npm run dev
```

This will start a webpack dev server at `http://localhost:8080/medianmpc/` with hot reloading enabled and open it in the browser.

On macOS you can also double-click `medianmpc.command` in Finder (or an alias of it on the desktop). It starts the dev server from the project folder, or only opens the browser if the app is already running.

## Building for Production

Create a production build:
```bash
npm run build
```

The built files will be in the `docs/` directory, which the GitHub Pages workflow deploys.

## Versions and Releases

- The version lives in `package.json` and is shown on the website (injected at build time).
- Every release gets an entry in [CHANGELOG.md](CHANGELOG.md) and a git tag `vX.Y.Z` on `main`.
- Versions stay at 0.x while the features are still being tried out on the MPC.

To release a new version:

1. Add the changes under a new version heading in `CHANGELOG.md`
2. Set the version without creating a tag yet: `npm version 0.2.0 --no-git-tag-version`
3. Commit, merge into `main`, then tag and push: `git tag -a v0.2.0 -m "v0.2.0"` and `git push origin main v0.2.0`

Pushing `main` deploys the website through GitHub Pages.

## Usage

1. **Load MIDI Files**: 
   - Click "Choose MIDI Files" or drag and drop one or more .mid/.midi files
   - The files are processed entirely in your browser - no data is sent to external servers
   - Each file can be removed on its own, or all at once with "Remove all files"

2. **View Tracks**: 
   - Each MIDI track is displayed with a visual timeline
   - Notes are shown as horizontal bars with color indicating velocity
   - Track information includes note count, pitch range, and duration

3. **Select a Range** (Optional):
   - Click and drag on the timeline; the selection snaps to sixteenths and stays within the timeline
   - The timeline shows bar, beat and sixteenth lines and reaches at least to the end of the suggested pattern, rounded up to whole bars
   - Positions are measured from the start of the MIDI file, so a rest before the first note is kept
   - The pattern starts at the beginning of the selection (step 1 is at 0:0:0) and only contains notes that lie completely inside it
   - Below the timeline, the range and its length are shown in MPC notation, e.g. `Selection: 0:0:24 – 0:1:0  Length 0:0:72 (3 × 1/16)`, together with the number of notes
   - Without a selection, the pattern runs from 0:0:0 to the suggested length: the last note start plus the most common step between note starts, never shorter than the end of the last note, rounded up to a whole sixteenth
   - Click without dragging or use "Clear Selection" to go back to the whole pattern

4. **Download a Single Pattern**:
   - Click "Download pattern" (or "Download selection as pattern") on any track
   - The .mpcpattern file is downloaded directly

5. **Download Several Patterns as ZIP**:
   - Every track has an "Include in ZIP" checkbox; each file has one for all of its tracks, and "Select all" covers everything. Newly loaded files are fully selected
   - Click "Download N patterns as ZIP" to get `mpc-patterns.zip`
   - The ZIP uses the same range per track as the single download: the selection, or the whole pattern
   - "Add matching .xtm track files" is on by default and adds an empty MPC track file for every pattern (see below); untick it to get only the patterns
   - The length of the range becomes the track length in the .xtm (e.g. `1:0:0` = 3840, `0:1:48` = 1440 pulses)

### File Names

- A MIDI file with one track with notes becomes `<file name>.mpcpattern`
- A MIDI file with several tracks with notes becomes `<file name> - <track name>.mpcpattern`, or `<file name> - Track N.mpcpattern` for unnamed tracks
- Characters that are not allowed in file names are replaced; if the same file is loaded twice, the ZIP keeps both with a ` (2)` suffix

### Saving Patterns as Custom Arp Patterns on the MPC

When you save a track as an arp pattern on the MPC, you have to type in the name by hand, unless the track already carries the name you want. The matching .xtm track files take care of that:

1. Download the patterns as ZIP with "Add matching .xtm track files" ticked (the default)
2. On the MPC, load `<name>.xtm`. This creates a track called `<name>`
3. Load `<name>.mpcpattern` into that track
4. Save the track as an arp pattern: the name and the track length are already set

The .xtm files contain no notes, because the MPC ignores note events when it loads a track file. The notes always come from the .mpcpattern.

## Supported Features

### MIDI Features
- Standard MIDI file formats (Type 0, 1, 2)
- Note On/Note Off events
- Multiple tracks and channels
- Velocity information
- Timing and duration data

### MPC Pattern Features
- Note events with timing and velocity
- 960 PPQ (Pulses Per Quarter) resolution
- Compatible with Akai Force, MPC Live, MPC X, and other Akai devices
- Preserves note timing and velocity information

## Technical Details

### Architecture
- **Modular Design**: Separated into logical modules for maintainability
- **React Components**: Modern React-based UI components
- **ES6+ JavaScript**: Uses modern JavaScript features and modules
- **Webpack Build**: Configured for both development and production builds

### MIDI Processing
- **Binary Parsing**: Direct parsing of MIDI binary data
- **Time Conversion**: Converts MIDI ticks to MPC time units
- **Multi-track Support**: Handles complex MIDI arrangements

### Browser Compatibility
- Modern browsers with ES6+ support
- File API support for local file processing
- Canvas API for timeline visualization

## File Format Details

### Input: MIDI Files (.mid, .midi)
- Standard MIDI File Format 0, 1, or 2
- Multi-track support
- Various time divisions supported

### Output: MPC Pattern Files (.mpcpattern)
- JSON format compatible with Akai devices
- 960 PPQ resolution
- Note events with timing, pitch, velocity, and duration

### Output: MPC Track Files (.xtm, optional)
- Gzip-compressed text: a short header (`ACVS`, MPC version, `SerialisableTrackData`, `json`, OS) followed by JSON
- Built from an empty track saved by MPC 3.9.1.2; only the track and program name and the track length are replaced
- Track length: `length` and the `loopEndPulses` of all clips are set to the pattern length (960 pulses per quarter note), and `lengthFollowsSequenceLength` is switched off, the same way the MPC saves a track with its own length
- The template contains no samples, file paths or device IDs
- The JSON is edited as text, because a JSON round trip in the browser would turn values like `1.0` into `1` and round the pattern length `9223372036854775807`

## Limitations

- Only Note On/Note Off events are converted
- Other MIDI events (controllers, program changes, etc.) are not included in MPC patterns
- Time selection is per track
- The .xtm template was saved with MPC 3.9.1.2; other firmware versions have not been tested
- Pattern lengths are whole sixteenths and assume 4/4 for the bars:beats:ticks display
- Maximum file size limited by browser memory

## Contributing

To contribute to this project:

1. Follow the existing code structure and naming conventions
2. Add appropriate documentation for new features
3. Test with various MIDI files
4. Ensure compatibility with existing MPC devices

## Credits

The original converter was written by [Catnip/Jamie Faye Fenton (Fentonia)](https://www.fentonia.com/catnip/midianmpc/index.html) and restructured into this codebase by [miathedev](https://github.com/miathedev/medianmpc). This fork lives at [codmpm/medianmpc](https://github.com/codmpm/medianmpc).

The multi-file loading, the file naming, the ZIP export with track selection, the sixteenth-snapped selections and pattern length, the matching .xtm track files and the dependency cleanup were developed together with [Claude](https://claude.com/claude-code), Anthropic's AI assistant, using Claude Code.

## License

The original project doesn't have a specified license. Original credit goes to [Catnip/Jamie Faye Fenton (Fentonia)](https://www.fentonia.com/catnip/midianmpc/index.html) for the initial implementation. This restructured version is provided as-is without any warranty.