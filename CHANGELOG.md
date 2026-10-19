# Changelog

All notable changes to this fork are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Versions stay at 0.x while the
features are still being tried out on the MPC.

The version is shown on the website next to the GitHub link.

## [Unreleased]

### Fixed

- A rest before the first note was dropped: patterns and the timeline started at the first note instead of the start of the MIDI file, so the first note always landed on step 1. Positions are now measured from the start of the MIDI file (0:0:0).

## [0.1.0] - 2026-10-17

First release of this fork of [miathedev/medianmpc](https://github.com/miathedev/medianmpc)
(based on upstream commit `a1270e8`).

### Added

- Load several MIDI files at once; each file gets its own section and can be removed on its own.
- "Include in ZIP" checkboxes per track, per file and for all files, and a button that downloads all selected patterns as `mpc-patterns.zip`.
- Optional matching `.xtm` track files in the ZIP: an empty MPC track with the pattern's name and length, so the MPC suggests the right name and length when a pattern is saved as a custom arp pattern.
- Timeline with bar, beat and sixteenth lines; selections snap to sixteenths.
- Range, length and note count of each pattern below the timeline, in MPC notation (bars:beats:ticks).
- Suggested pattern length when nothing is selected: last note start plus the most common step between notes, never shorter than the end of the last note.
- Version number on the website, linked to this changelog.
- `medianmpc.command`: double-click start script for macOS that starts the dev server and opens the app.

### Changed

- Patterns are named after the MIDI file (`<file>.mpcpattern`, or `<file> - <track>.mpcpattern` for files with several tracks) instead of `midi_file_Track_N.mpcpattern`.
- A pattern starts at the beginning of its range and contains only notes that lie completely inside it, for the single download and the ZIP.
- The per-track button is called "Download pattern" ("Download selection as pattern" with a selection).
- The website links to this fork and credits the original by Fentonia and the restructured version by miathedev.
- Dependencies: ESLint 10 with a flat config, webpack-cli 7, webpack-dev-server 6 and current loaders; Jest and the unused file-saver removed. `npm install` shows no deprecation warnings anymore. Node.js 22.15 or newer is required.
- GitHub Pages workflow on Node.js 24 with the current versions of its actions.

### Fixed

- Exporting a track exported the wrong (empty) track in type 1 MIDI files with a separate tempo track.
- Dragging past the left edge of the timeline produced negative selection times.
- Selection times and track durations were shown in seconds computed for 480 ticks per quarter at 120 BPM, which was wrong for most files.
- The dev server opened `http://localhost:8080/` instead of `http://localhost:8080/medianmpc/`.

[0.1.0]: https://github.com/codmpm/medianmpc/releases/tag/v0.1.0
