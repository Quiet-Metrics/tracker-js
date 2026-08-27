# Changelog

All notable changes to the Quiet Metrics `qm.js` tracker are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org).

## [Unreleased]

Full pre-publication review pending (the core PHP SDK and the Laravel bridge already went through theirs).

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
