# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Export `AttributeObserver` and `ElementObserver`
- Support number values with underscores
- Add `lazyImport` function which imports the elements/targets lazily

### Changed

- Invoke `disconnected` callback before [target]Disconnected callbacks

## [0.3.0] - 2024-03-17

### Added

- Add event modifiers (`stop`, `prevent`, `self`) and event options (`capture`, `once`, `passive`) to the action ([#12](https://github.com/Ambiki/impulse/pull/12))

### Fixed

- Property value is undefined when the element is disconnected ([#19](https://github.com/Ambiki/impulse/pull/19))

## [0.2.0] - 2023-10-15

### Changed

- Scope target(s) and events to the closest Impulse element ([#9](https://github.com/Ambiki/impulse/pull/9))

## [0.1.3] - 2023-07-31

### Changed

- Drop build target to `2017` ([#6](https://github.com/Ambiki/impulse/pull/6))

## [0.1.2] - 2023-07-31

### Fixed

- Register values only if it is defined in the element ([#4](https://github.com/Ambiki/impulse/pull/4))

## [0.1.1] - 2023-07-31

### Fixed

- Property dependency order ([#2](https://github.com/Ambiki/impulse/pull/2))

## [0.1.0] - 2023-07-31

### Added

- Everything!

[unreleased]: https://github.com/Ambiki/impulse/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Ambiki/impulse/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ambiki/impulse/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/Ambiki/impulse/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Ambiki/impulse/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Ambiki/impulse/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Ambiki/impulse/releases/tag/v0.1.0
