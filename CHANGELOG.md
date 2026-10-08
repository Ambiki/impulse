# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `whenInitialized` to await an element being ready: standard elements resolve immediately, Impulse elements once initialized, and other custom elements once defined. Waits indefinitely unless `{ timeout }` (milliseconds) is passed ([#113](https://github.com/Ambiki/impulse/pull/113), [#121](https://github.com/Ambiki/impulse/pull/121), [#122](https://github.com/Ambiki/impulse/pull/122))
- Export `SetMap` ([#93](https://github.com/Ambiki/impulse/pull/93))
- Export `SelectorSet`, which indexes CSS selectors by their leftmost token ([#100](https://github.com/Ambiki/impulse/pull/100))

### Changed

- `connected`, `disconnected`, `lazyImport`, `on`, `@target` and `@action` now share one document-level `MutationObserver` instead of one observer chain per call or instance ([#100](https://github.com/Ambiki/impulse/pull/100))
- `lazyImport` now stops watching after its first match instead of leaking a `MutationObserver` per call ([#100](https://github.com/Ambiki/impulse/pull/100))
- `@target` / `@action` now share one `[data-target]` and one `[data-action]` watcher across all `ImpulseElement` instances instead of a pair per instance. An element starting its targets and actions now delivers pending mutation records to every watcher synchronously, so `connected`, `disconnected` and `on` callbacks can fire slightly earlier ([#175](https://github.com/Ambiki/impulse/pull/175))
- `connected`, `disconnected` and `lazyImport` no longer match while the document is parsing (`readyState` is `loading`), so a callback never runs on a half-parsed element. A watcher registered during the parse matches on `DOMContentLoaded`; one registered later still scans synchronously. An element inserted and removed during the parse is never reported. On a long page, `connected` callbacks wait for the whole parse, so unenhanced content can show briefly. A throwing `lazyImport` callback is now reported like an uncaught error without stopping other callbacks for its selector. `on` handlers are unaffected. See `docs/adr/0003-watchers-and-elements-wait-for-the-document-to-be-parsed.md` ([#197](https://github.com/Ambiki/impulse/pull/197))
- `on` now uses event delegation: one document-level listener per event name and capture phase instead of one per matching element. `event.currentTarget` points at the matched element, and `event.stopPropagation()` halts further delegated dispatch ([#101](https://github.com/Ambiki/impulse/pull/101))

### Deprecated

- The implicit wait for descendant custom elements to be defined before target connected callbacks run, to be removed in the next major version. `await whenInitialized(target)` inside the callback instead, then set `ImpulseElement.migratedToWhenInitialized = true` to silence the warning ([#120](https://github.com/Ambiki/impulse/pull/120))

### Removed (BREAKING)

- `SelectorObserver`, `ElementObserver`, `AttributeObserver` and `TokenListObserver`. Use `connected` / `disconnected` instead ([#100](https://github.com/Ambiki/impulse/pull/100))
- Non-bubbling events (`focus`, `blur`, `mouseenter`, `mouseleave`, `load`, `error`, `scroll`) passed to `on` now require `{ capture: true }`. Or use the bubbling `focusin` / `focusout` / `mouseover` / `mouseout` ([#101](https://github.com/Ambiki/impulse/pull/101))

### Fixed

- An `ImpulseElement` that moves itself in `connected()` now re-initializes at its new position instead of staying torn down. `connected()` runs again, so guard the move to avoid a loop ([#202](https://github.com/Ambiki/impulse/pull/202))
- Removing one of two duplicate `data-target` tokens (`x.a x.a` to `x.a`) no longer unregisters the target or fires its disconnected callback ([#157](https://github.com/Ambiki/impulse/pull/157))
- Removing one token from a multi-token `data-action` attribute now unbinds only that action instead of every listener on the element ([#157](https://github.com/Ambiki/impulse/pull/157))
- `ImpulseElement` no longer initializes twice when moved synchronously, or finishes initializing after being removed mid-initialization ([#169](https://github.com/Ambiki/impulse/pull/169))
- A throwing watcher callback (`connected` / `disconnected`, target or action) no longer aborts the mutation batch for other watchers or leaks the watcher during the initial scan. Errors are reported through `window.onerror` and processing continues. A duplicate `@target` (the "Multiple targets" error) is now reported the same way instead of rejecting initialization: the element initializes with the duplicate ignored ([#168](https://github.com/Ambiki/impulse/pull/168))
- `ImpulseElement` now finishes tearing down when `disconnected()` or a target disconnected callback throws, so it can re-initialize on reconnect. The error is rethrown afterwards ([#167](https://github.com/Ambiki/impulse/pull/167))
- `lazyImport` no longer throws `ReferenceError: Cannot access 'stop' before initialization` when a matching element is already in the DOM ([#165](https://github.com/Ambiki/impulse/pull/165))
- `@target` / `@action` teardown now reports every tracked token and deregisters the watcher even if a callback throws or calls stop again ([#164](https://github.com/Ambiki/impulse/pull/164))
- Stopping a `connected` watcher now runs the cleanup of every matched element still in the DOM ([#162](https://github.com/Ambiki/impulse/pull/162))
- Define `@property` accessors synchronously on connect instead of after `await domReady()`, so a parent's `[target]Connected(child)` callback can no longer read a child's property before it exists ([#124](https://github.com/Ambiki/impulse/pull/124))
- Preserve DOM order for `@targets()` when a target is inserted between existing targets ([#97](https://github.com/Ambiki/impulse/pull/97))
- Remove the `data-impulse-element` attribute when an element is disconnected ([#112](https://github.com/Ambiki/impulse/pull/112))

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

[unreleased]: https://github.com/Ambiki/impulse/compare/v1.1.0...HEAD
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
