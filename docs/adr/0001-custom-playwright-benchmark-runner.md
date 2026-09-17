# A custom Playwright runner for benchmarks

Tachometer, which compared builds of a web library page by page, was archived in September 2026. The popular
replacements (tinybench, the engine behind `vitest bench`, and mitata) time functions inside a single page, but two
builds of Impulse cannot share a page: both would `customElements.define` the same tag names and each would start its
own document-wide `MutationObserver`. So `packages/benchmark` has its own runner: Playwright loads a fresh page per
Round for one Variant (Baseline, Candidate or Control), the Rounds alternate, and about 150 lines of Welch statistics
turn the Samples into a Verdict. No benchmark library is involved.

## Considered Options

- **tinybench / mitata in the page.** Fine for comparing two functions; cannot load two builds side by side. In this
  design they would only replace the warmup-and-measure loop, and their time-based iteration counts work against the
  fixed Iterations per Round.
- **Vitest browser mode `bench`.** Still experimental, cannot bundle a different Impulse per page, and would add Vitest
  next to web-test-runner.
- **CodSpeed or Bencher.** Hosted services for tracking CI results over time. Local A/B comes first; either can
  consume `yarn bench --json` later.
