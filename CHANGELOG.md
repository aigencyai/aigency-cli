# Changelog

All notable changes to `aigency` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.2.1] - 2026-06-10

### Changed

- **The cold-open now waits for you.** The wordmark ignition used to auto-advance
  into the store picker the instant the tagline finished typing (~2s), so the
  welcome screen and the "online shopping was fine. we fixed it anyway." line
  flew by. It now holds on a `press any key to enter ›` prompt and only proceeds
  on a keypress.
- **New "warp" exit animation.** Pressing a key plays a short zoom-through — the
  wordmark spreads its letter-spacing wider and wider while fading — before
  handing off to the picker.
- A keypress _during_ the ignition fast-forwards to the fully-revealed welcome
  (so an impatient keypress still shows the tagline before a second key enters).

### Fixed

- Non-raw-mode terminals no longer risk stranding on the new "press any key"
  gate: when keypresses can't be delivered, the intro plays once and hands off.

## [0.2.0] - 2026-06-03

### Added

- Wordmark-ignition intro + alternate-screen mode.
- Braille highlight-tile store landing (no auto-search on entry).
- Single / comparison / grid result views, scaled by result count.
- First-party identity + PDP click-through tracking.

## [0.1.0]

### Added

- Initial release — shop real brand catalogs from your terminal.

[0.2.1]: https://github.com/aigencyai/aigency-cli/releases/tag/v0.2.1
[0.2.0]: https://github.com/aigencyai/aigency-cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/aigencyai/aigency-cli/releases/tag/v0.1.0
