# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Wait for `document.readyState` to be `interactive` before initializing Impulse

## [1.0.0] - 2024-11-28

### Fixed

- Set multiple targets as `[]` and single targets as `null` if they cannot be found ([#47](https://github.com/Ambiki/impulse/pull/47))

## [0.5.0-beta.2] - 2024-08-26

### Added

- Fire callbacks when `data-[action|target]` attributes are modified ([#41](https://github.com/Ambiki/impulse/pull/41))

### Fixed

- Optimize event listeners so that only the added/removed actions are processed ([#41](https://github.com/Ambiki/impulse/pull/41))
- Fixed `ElementObserver` types ([#39](https://github.com/Ambiki/impulse/pull/39))

## [0.5.0-beta.1] - 2024-08-24

### Added

- Export `TokenListObserver` ([#34](https://github.com/Ambiki/impulse/pull/34))

### Changed

- Do not wait for DOM to be ready before initializing Impulse ([#32](https://github.com/Ambiki/impulse/pull/32))

## [0.4.0] - 2024-05-17

### Added

- Export `AttributeObserver` and `ElementObserver` ([#26](https://github.com/Ambiki/impulse/pull/26))
- Support number values with underscores ([#25](https://github.com/Ambiki/impulse/pull/25))
- Add `lazyImport` function which imports the elements/targets lazily ([#22](https://github.com/Ambiki/impulse/pull/22))

### Changed

- Invoke `disconnected` callback before [target]Disconnected callbacks ([#23](https://github.com/Ambiki/impulse/pull/23))

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

[unreleased]: https://github.com/Ambiki/impulse/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Ambiki/impulse/compare/v0.5.0-beta.1...v1.0.0
[0.5.0-beta.2]: https://github.com/Ambiki/impulse/compare/v0.5.0-beta.1...v0.5.0-beta.2
[0.5.0-beta.1]: https://github.com/Ambiki/impulse/compare/v0.4.0...v0.5.0-beta.1
[0.4.0]: https://github.com/Ambiki/impulse/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Ambiki/impulse/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ambiki/impulse/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/Ambiki/impulse/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Ambiki/impulse/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Ambiki/impulse/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Ambiki/impulse/releases/tag/v0.1.0
