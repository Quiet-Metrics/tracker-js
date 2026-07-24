# Changelog

All notable changes to the Quiet Metrics `qm.js` tracker are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org).

## [Unreleased]

Full pre-publication review pending (the core PHP SDK and the Laravel bridge already went through theirs).

## [0.1.0] - 2026-07-24

First tagged snapshot (private beta).

### Added
- ES5, dependency-free, build-free tracker (< 2 KB min+gzip target): SPA pageviews, outbound links, opt-in downloads and 404 events, path exclusions, DNT/GPC respect, dev mode, first-party endpoint inferred from the script origin.
- `qm()` queue snippet, `qm.pageview()`, `__qmDisable` kill switch.
- Dependency-free Node test harness (26 tests).

### Fixed
- Documentation: legacy `wa()` call names corrected to `qm()`; the served-script tag deliberately carries no SRI hash (documented), first-party copy is the immutability path.
