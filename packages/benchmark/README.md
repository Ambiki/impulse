# @ambiki/benchmark

Answers one question: **is the working tree's Impulse slower or faster than a git ref?** It times DOM workloads in
Chromium on three Variants and reports the difference with a confidence interval.

```bash
yarn bench                                   # every Scenario, Candidate vs main, 10 Rounds
yarn bench --scenario 'table-row-elements/*' # while iterating on a change
yarn bench --rounds 30 --json out.json       # tighter intervals for a pull request, keeping the raw Samples
yarn bench --baseline v1.1.0                 # against a tag
yarn bench:serve                             # open the Scenario pages by hand (run `yarn build` first)
```

Run it on a quiet machine: close other heavy programs, and plug in a laptop. A full run takes 10 to 15 minutes.

The default 10 Rounds per Variant catch changes of roughly 5 to 8% or more, which is enough to spot a regression while
working. They miss smaller changes and rarely reach a `no change` Verdict, whose whole interval must sit within ±2%.
Use `--rounds 30` (30 to 40 minutes) for numbers that go in a pull request: on the table Scenarios that narrows the
interval to about ±2 to 3.5%.

## What a run does

Terms are defined in the repository's [`CONTEXT.md`](../../CONTEXT.md).

1. **Prepares three Variants.** The **Candidate** is `packages/core` from the working tree, uncommitted changes
   included, copied into `.bench/` and built there (your `packages/core/dist` is untouched). The **Baseline** is built
   from `--baseline` (default `main`) in a temporary git worktree. Both are built with the working tree's toolchain, so
   the Baseline is cached by commit SHA plus a hash of `yarn.lock`. The **Control** loads no Impulse at all. Vite
   bundles the same Scenario pages once per Variant.
2. **Runs Rounds.** A Round opens a fresh browser context for one Variant, runs a Scenario's warmup Iterations, then
   its measured Iterations, and keeps their median as one **Sample**. The Variants alternate (A B C, C B A, ...) so a
   drifting machine biases none of them.
3. **Compares.** For each Scenario, a 95% Welch interval on the Candidate's mean Sample against the Baseline's gives a
   **Verdict**: `faster`, `slower`, `no change` (the whole interval within ±2%), or `unsure`. **Overhead** compares
   the Baseline and the Candidate against the Control.

An **Iteration** is timed from just before the DOM operation until the microtasks it queued have drained, which is
when `ImpulseElement` has finished wiring targets and actions. Setup and teardown are untimed, and Chromium runs with
`--expose-gc` so a garbage collection is forced before every timed window. `<body>` is `display: none`, so style,
layout and paint stay out of the numbers; the pages are served cross-origin isolated for 5µs timer resolution.

## Scenarios

| Scenario | Operation |
| --- | --- |
| `table-single-owner/{create,clear,append,move}` | A `<data-table>` owning 5,000 rows' tokens (20,000 in all) |
| `table-row-elements/{create,clear,append,move}` | 5,000 `<table-row>` components, each with a property, 2 targets, 2 actions |
| `body-swap` | `document.body.replaceWith()` a fresh copy of a ~10,000 element page with ~200 components |
| `attributes-plain` | Toggle a class and write a style on 1,000 elements with no tokens |
| `attributes-tokened` | The same on 1,000 elements that each carry a `data-action` |
| `attributes-fallback` | The same as `attributes-plain`, with a registered selector that is not self-contained |

`create` inserts all rows in one `append`, `clear` removes them with `replaceChildren()`, `append` adds 1,000 rows to
5,000, and `move` re-appends the 5,000 rows in reverse order.

## Adding a Scenario

A [`Scenario`](src/scenarios/scenario.ts) is `setup`, the timed `run`, `teardown`, and `verify`. Add it to
[`src/scenarios/index.ts`](src/scenarios/index.ts), and put any components it needs in `src/components/`.

- Scenarios use standard DOM APIs only and never import Impulse, so the same code runs on all three Variants.
- Components use only the public API (`ImpulseElement`, `registerElement`, `property`, `target`, `targets`,
  `lazyImport`), so a Baseline as old as v1.0.0 still builds.
- `verify` (and `verifySetup` for operations on existing components) must fail when Impulse did not do the work;
  otherwise a broken fixture reports fast, stable, meaningless numbers. `yarn workspace @ambiki/benchmark test` runs
  every Scenario once on the Candidate and the Control and checks them, building into `.bench/test/` so it can run
  alongside `yarn bench`.

## Profiling

`yarn bench:serve` serves the pages against `packages/core/dist`. Open a Scenario, start a recording in the DevTools
Performance panel, and press **Run ×10**. Each Iteration shows up as a `performance.measure` entry in the Timings
track.
