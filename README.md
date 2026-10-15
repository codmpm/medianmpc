# MIDI to MPC Pattern Converter

A web-based application that converts MIDI files to MPC pattern format (.mpcpattern) for Akai Force and other Akai products. This project has been unminified and restructured from the original by [Catnip/Jamie Faye Fenton (Fentonia)](https://www.fentonia.com/catnip/midianmpc/index.html) into a modular, maintainable codebase.

## Features

- **MIDI File Support**: Load and parse standard MIDI files (.mid, .midi)
- **Multiple Files**: Load several MIDI files at once, each shown in its own section
- **Visual Timeline**: Interactive graphical display of MIDI tracks with note visualization
- **Time Selection**: Click and drag to select specific time ranges for conversion
- **Multi-Track Support**: Convert individual tracks or entire MIDI files
- **MPC Pattern Export**: Generate .mpcpattern files compatible with Akai devices
- **Meaningful File Names**: Patterns are named after the MIDI file (and track), not "Track_1"
- **ZIP Export**: Tick the tracks you want and download all their patterns as one ZIP file
- **Matching .xtm Track Files**: Optionally add an empty MPC track file per pattern, so the MPC suggests the right name when you save the pattern as a custom arp pattern
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
2. Install dependencies:
```bash
npm install
```

## Development

Start the development server:
```bash
npm run dev
```

This will start a webpack dev server at `http://localhost:8080/medianmpc/` with hot reloading enabled.

## Building for Production

Create a production build:
```bash
npm run build
```

The built files will be in the `docs/` directory, which the GitHub Pages workflow deploys.

## Usage

1. **Load MIDI Files**: 
   - Click "Choose MIDI Files" or drag and drop one or more .mid/.midi files
   - The files are processed entirely in your browser - no data is sent to external servers
   - Each file can be removed on its own, or all at once with "Remove all files"

2. **View Tracks**: 
   - Each MIDI track is displayed with a visual timeline
   - Notes are shown as horizontal bars with color indicating velocity
   - Track information includes note count, pitch range, and duration

3. **Select Time Range** (Optional):
   - Click and drag on the timeline to select a specific portion
   - Only the selected range will be converted to MPC format

4. **Download a Single Pattern**:
   - Click "Download pattern" (or "Download selection as pattern") on any track
   - The .mpcpattern file is downloaded directly

5. **Download Several Patterns as ZIP**:
   - Every track has an "Include in ZIP" checkbox; each file has one for all of its tracks, and "Select all" covers everything. Newly loaded files are fully selected
   - Click "Download N patterns as ZIP" to get `mpc-patterns.zip`
   - The ZIP always contains whole tracks; a time selection only applies to the single-pattern download
   - Tick "Add matching .xtm track files" to also get an empty MPC track file for every pattern (see below)

### File Names

- A MIDI file with one track with notes becomes `<file name>.mpcpattern`
- A MIDI file with several tracks with notes becomes `<file name> - <track name>.mpcpattern`, or `<file name> - Track N.mpcpattern` for unnamed tracks
- Characters that are not allowed in file names are replaced; if the same file is loaded twice, the ZIP keeps both with a ` (2)` suffix

### Saving Patterns as Custom Arp Patterns on the MPC

When you save a track as an arp pattern on the MPC, you have to type in the name by hand, unless the track already carries the name you want. The matching .xtm track files take care of that:

1. Download the patterns as ZIP with "Add matching .xtm track files" ticked
2. On the MPC, load `<name>.xtm`. This creates a track called `<name>`
3. Load `<name>.mpcpattern` into that track
4. Save the track as an arp pattern: the name is already filled in

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
- Built from an empty track saved by MPC 3.9.1.2; only the track and program name are replaced
- The template contains no samples, file paths or device IDs
- The JSON is edited as text, because a JSON round trip in the browser would turn values like `1.0` into `1` and round the pattern length `9223372036854775807`

## Limitations

- Only Note On/Note Off events are converted
- Other MIDI events (controllers, program changes, etc.) are not included in MPC patterns
- Time selection is currently track-specific and not used for the ZIP export
- The .xtm template was saved with MPC 3.9.1.2; other firmware versions have not been tested
- Maximum file size limited by browser memory

## Contributing

To contribute to this project:

1. Follow the existing code structure and naming conventions
2. Add appropriate documentation for new features
3. Test with various MIDI files
4. Ensure compatibility with existing MPC devices

## Credits

The original converter was written by [Catnip/Jamie Faye Fenton (Fentonia)](https://www.fentonia.com/catnip/midianmpc/index.html) and restructured into this codebase by [miathedev](https://github.com/miathedev/medianmpc).

The multi-file loading, the file naming, the ZIP export with track selection and the matching .xtm track files were developed together with [Claude](https://claude.com/claude-code), Anthropic's AI assistant, using Claude Code.

## License

The original project doesn't have a specified license. Original credit goes to [Catnip/Jamie Faye Fenton (Fentonia)](https://www.fentonia.com/catnip/midianmpc/index.html) for the initial implementation. This restructured version is provided as-is without any warranty.