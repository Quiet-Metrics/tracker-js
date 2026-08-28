# Changelog

All notable changes to the Quiet Metrics `qm.js` tracker are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org).

## [Unreleased]

Full pre-publication review pending (the core PHP SDK and the Laravel bridge already went through theirs).

### Added
- Opt-out marker: a visitor loading any page of the tracked site with `?qm_ignore=1` stops being counted, and `?qm_ignore=0` puts them back into measurement. It is written on both sides, as a first-party `qm_ignore` cookie of that site (`path=/`, `samesite=lax`, `secure` over https, five years) and in `localStorage`: the cookie is the only one of the two a server-side SDK can read, `localStorage` takes over wherever the cookie is refused or cleared. The marker holds no identifier, is never transmitted, and exists only to stop measurement. The visit that stores it is not counted; the visit that removes it is counted right away. Covered by the Node harness (marker stored on both sides, hit suppressed, removal, exact name only, host cookies untouched, `localStorage` unavailable).

### Changed
- The published promise is now "no identification or tracking cookies" rather than "cookie-free". Nothing is stored on the visitor's device in order to measure them; the one exception is the opt-out marker, which they store themselves and which is exempt from consent as an expression of refusal.
- README size figures re-measured, having drifted twice, and the announced ceiling raised to 4 KB. The file is served AS IS: there is no minification step anywhere in the pipeline, contrary to what the README claimed. Source around 8.8 KB, roughly 3.7 KB gzipped as served, against the 4 KB ceiling. The README now carries the command that measures what is actually served, not a hypothetical minified build.

## [0.1.1] - 2026-08-27

Documentation and artwork only. `tracker.js` is unchanged since 0.1.0.

### Changed
- Banner redrawn to the current brand: product typefaces, the damped wave, title in ink.
- Banner tagline corrected. It read "100 % server-side", which is the claim of the PHP SDK and not of this package: qm.js runs in the browser. It now states what this package actually is, ES5 with no dependencies, under 2 KB min+gzip.

### Added
- `sync.js`, which keeps the served copies of qm.js aligned with this file as the single source of truth (`--check` reports drift without writing).

## [0.1.0] - 2026-07-24

First tagged snapshot (private beta).

### Added
- ES5, dependency-free, build-free tracker (< 2 KB min+gzip target): SPA pageviews, outbound links, opt-in downloads and 404 events, path exclusions, DNT/GPC respect, dev mode, first-party endpoint inferred from the script origin.
- `qm()` queue snippet, `qm.pageview()`, `__qmDisable` kill switch.
- Dependency-free Node test harness (26 tests).

### Fixed
- Documentation: legacy `wa()` call names corrected to `qm()`; the served-script tag deliberately carries no SRI hash (documented), first-party copy is the immutability path.
