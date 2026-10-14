# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-10-14

### Added

- Add `whenInitialized` to await an element being ready. Waits indefinitely unless `{ timeout }` (milliseconds) is passed ([#122](https://github.com/Ambiki/impulse/pull/122), [#121](https://github.com/Ambiki/impulse/pull/121), [#113](https://github.com/Ambiki/impulse/pull/113))
- Export `SelectorSet` ([#100](https://github.com/Ambiki/impulse/pull/100))
- Export `SetMap` ([#93](https://github.com/Ambiki/impulse/pull/93))

### Changed

- `connected`, `disconnected` and `lazyImport` deliver pending mutations to other watchers before their initial scan. Elements a watcher callback inserts into its own element match one delivery later ([#210](https://github.com/Ambiki/impulse/pull/210))
- `connected`, `disconnected` and `lazyImport` wait for the document to be parsed before matching, so a callback never runs on a half-parsed element. On a long page, unenhanced content can show briefly. See `docs/adr/0003-watchers-and-elements-wait-for-the-document-to-be-parsed.md` ([#197](https://github.com/Ambiki/impulse/pull/197))
- `connected`, `disconnected`, `lazyImport`, `on`, `@target` and `@action` share one document-level `MutationObserver`, so callbacks can fire slightly earlier ([#175](https://github.com/Ambiki/impulse/pull/175), [#100](https://github.com/Ambiki/impulse/pull/100))
- `on` uses event delegation. `event.currentTarget` is the matched element, and `event.stopPropagation()` stops further delegated handlers ([#101](https://github.com/Ambiki/impulse/pull/101))
- `lazyImport` stops watching after its first match ([#100](https://github.com/Ambiki/impulse/pull/100))

### Deprecated

- The implicit wait for descendant custom elements before target connected callbacks. Use `await whenInitialized(target)`, then set `ImpulseElement.migratedToWhenInitialized = true` to silence the warning ([#120](https://github.com/Ambiki/impulse/pull/120))

### Removed (BREAKING)

- Non-bubbling events (`focus`, `blur`, `mouseenter`, `mouseleave`, `load`, `error`, `scroll`) passed to `on` require `{ capture: true }`, or use `focusin` / `focusout` / `mouseover` / `mouseout` ([#101](https://github.com/Ambiki/impulse/pull/101))
- `SelectorObserver`, `ElementObserver`, `AttributeObserver` and `TokenListObserver`. Use `connected` / `disconnected` ([#100](https://github.com/Ambiki/impulse/pull/100))

### Fixed

- `connected`, `disconnected`, `lazyImport` and `on` throw a `SyntaxError` for a selector the browser rejects, instead of breaking every other watcher ([#217](https://github.com/Ambiki/impulse/pull/217))
- In Firefox, an element moved by `replaceChildren(node)` is rematched ([#210](https://github.com/Ambiki/impulse/pull/210))
- A replacement `@target()` inserted before the old one is removed is adopted instead of leaving the field `null` ([#208](https://github.com/Ambiki/impulse/pull/208))
- An `ImpulseElement` that moves itself in `connected()` re-initializes. Guard the move to avoid a loop ([#202](https://github.com/Ambiki/impulse/pull/202))
- `ImpulseElement` no longer initializes twice when moved synchronously, or after being removed mid-initialization ([#169](https://github.com/Ambiki/impulse/pull/169))
- A throwing watcher callback is reported through `window.onerror` without stopping other watchers. A duplicate `@target` is reported the same way instead of rejecting initialization ([#168](https://github.com/Ambiki/impulse/pull/168))
- `ImpulseElement` finishes tearing down when `disconnected()` or a target disconnected callback throws ([#167](https://github.com/Ambiki/impulse/pull/167))
- `lazyImport` no longer throws a `ReferenceError` when a matching element is already in the DOM ([#165](https://github.com/Ambiki/impulse/pull/165))
- `@target` / `@action` teardown completes when a callback throws ([#164](https://github.com/Ambiki/impulse/pull/164))
- Stopping a `connected` watcher runs the cleanup of every matched element ([#162](https://github.com/Ambiki/impulse/pull/162))
- Removing one `data-target` or `data-action` token no longer unbinds other tokens or a remaining duplicate ([#157](https://github.com/Ambiki/impulse/pull/157))
- `@property` accessors are defined on connect, so a parent's `[target]Connected(child)` can read them ([#124](https://github.com/Ambiki/impulse/pull/124))
- Remove `data-impulse-element` when an element disconnects ([#112](https://github.com/Ambiki/impulse/pull/112))
- Preserve DOM order for `@targets()` when a target is inserted between others ([#97](https://github.com/Ambiki/impulse/pull/97))

## [1.1.0] - 2025-10-25

### Added

- Add `on` and `emit` event functions ([#62](https://github.com/Ambiki/impulse/pull/62))
- Add `connected` and `disconnected` lifecycle functions ([#60](https://github.com/Ambiki/impulse/pull/60))

### Fixed

- Process pending mutations ([#71](https://github.com/Ambiki/impulse/pull/71))

## [1.0.2] - 2025-06-15

### Fixed

- Prevent early invocation of `connected` and `disconnected` functions ([#56](https://github.com/Ambiki/impulse/pull/56))

## [1.0.1] - 2025-02-07

### Fixed

- Wait for `document.readyState` to be `interactive` before initializing Impulse ([#49](https://github.com/Ambiki/impulse/pull/49))

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

[unreleased]: https://github.com/Ambiki/impulse/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Ambiki/impulse/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/Ambiki/impulse/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/Ambiki/impulse/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Ambiki/impulse/compare/v1.0.0...v1.0.1
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
