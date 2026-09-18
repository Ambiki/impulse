# Impulse

A lightweight framework that augments server-rendered HTML with behavior through native custom elements. This glossary
covers the framework and the tooling used to develop it.

## Language

### Framework

**Initialized**:
An element whose properties, targets, and actions have started and that has not been disconnected since. Only an
element itself can be Initialized; the `data-impulse-element` attribute reports the state rather than conferring it.
_Avoid_: Started, mounted, booted

**Owner**:
The component a `data-target` or `data-action` token belongs to: the nearest ancestor-or-self whose tag name is the
token's identifier.
_Avoid_: Controller, parent, scope

**Self-contained selector**:
A selector whose match against an element depends only on that element's tag name and its own attributes, so nothing
else in the document (ancestors, siblings, focus, user input) can make it start or stop matching.
_Avoid_: Filterable selector, simple selector, compound selector, local selector

### Benchmarking

**Baseline**:
The build of Impulse that a benchmark run compares against, identified by a git ref (`main` unless stated otherwise).
_Avoid_: Control, reference, before

**Candidate**:
The build of Impulse under evaluation in a benchmark run, taken from the working tree.
_Avoid_: Experiment, branch build, after

**Control**:
A benchmark page that performs a scenario's DOM operations with no Impulse loaded, so the framework's overhead can be
stated in absolute terms.
_Avoid_: Vanilla, no-op build, zero

**Variant**:
What a single Round loads: the Baseline, the Candidate, or the Control.
_Avoid_: Build (the Control is not a build), version, target

**Scenario**:
One named DOM workload timed on its own, such as inserting 5,000 rows that are each an Owner
(`table-row-elements/create`).
_Avoid_: Benchmark, test, case, suite

**Round**:
One fresh page load of a single Variant that runs a scenario's warmup iterations and then its measured iterations.
Rounds for the Variants alternate.
_Avoid_: Run, trial, pass

**Iteration**:
One timed execution of a scenario's DOM operation within a Round, from just before the operation until the microtasks it
queued have drained. Warmup iterations are discarded.
_Avoid_: Run, cycle, tick

**Sample**:
The median of a Round's measured iterations. Statistics compare samples, never individual iterations.
_Avoid_: Measurement, data point

**Overhead**:
How much longer a scenario takes on the Baseline or Candidate than on the Control.
_Avoid_: Tax, cost, framework time

**Verdict**:
The per-scenario outcome of comparing the Candidate to the Baseline: faster, slower, no change, or unsure.
_Avoid_: Result, status, score
