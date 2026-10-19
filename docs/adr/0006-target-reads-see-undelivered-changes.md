# Target reads see changes that have not been delivered

A `@target()` or `@targets()` field used to read an index that only caught up when Impulse's `MutationObserver`
delivered its records, so code that changed the DOM and then read a target in the same synchronous run got the old
targets ([#231](https://github.com/Ambiki/impulse/issues/231);
[Ambiki/impulse_view_components#337](https://github.com/Ambiki/impulse_view_components/pull/337) queried the DOM by hand
to get around it). A read now first asks whether changes are waiting. With none, which is almost every read, it returns
the index as before. With some, it works the field out from the DOM the way the index will once they are delivered: the
elements whose Owner is this element and whose `data-target` lists the key, in document order, and for `@target()` the
current Target for as long as it still claims the key. The callbacks still run when the changes are delivered. The field
therefore reflects the DOM as it is now, but between a change and its delivery it can hold an element whose
`[field]Connected` has not run, or lack one whose `[field]Disconnected` has not.

A read changes nothing about when callbacks run. The observer's records are the only way to see waiting changes, so a
read takes them and holds them for the next batch, which delivers them ahead of its own. It then changes a text node
outside the document that only the observer watches. The record that leaves behind keeps the observer's callback coming
when it would have, no one else can see it, and the batch ignores it.

For `@target()`, delivery follows the rule the read follows, so the two never disagree. A Target from an earlier
delivery keeps the key while it claims it, and a claimant inserted ahead of it waits, so a replacement inserted before
the old Target is removed does not take over early ([#199](https://github.com/Ambiki/impulse/issues/199)). That holds
when the Target is moved too: its token is unmatched and matched again within the delivery, and in between the key is
kept for it, so a claimant matched meanwhile waits. Otherwise the first claimant in document order takes the key, even
from a claimant connected earlier in the same delivery, which gets `[field]Disconnected` and waits behind it. Two
claimants that both stay are still reported as a mistake.

An element that is moved is torn down and initialized again, and its index is empty in between. A read in that window
works the field out from the DOM too. An element inside a shadow root never reads from the DOM: the observer does not
reach shadow trees, so its index never holds a target there, and a read agrees with that.

Inside a callback Impulse runs while delivering changes (for a batch of records, a new Watcher's first scan, or a target
or action router's replay as an element initializes and its teardown), the field is the index: what has been delivered
so far, as before. Those deliveries are also why a `connected()`, `disconnected()` or `lazyImport()` registered from
such a callback leaves queued records alone. It used to do that only inside a batch, so one registered from a scan's
callback could deliver the removal of an element the scan then connected anyway, detached and never to be disconnected.

## Considered Options

- **Deliver the waiting changes on read.** Built first: the getter flushed the observer, so the field stayed the index,
  every element in it had had its connected callback, and there was a single read path. Rejected because a read then ran
  callbacks in the middle of the caller's method, other elements' and `connected()` callbacks included, and a callback
  could see the caller's work half done. A method that inserted a row, read a target, then set the state the row's
  connected callback reads had the callback see the old state.
- **Deliver the taken records from a microtask of Impulse's own.** Built second, without the text node. Rejected because
  a read then moved callbacks: with the observer's queue empty, its callback did not come, so a microtask queued between
  a change and a read ran before that change's callbacks, where without the read it ran after.
- **A second observer that sees the same changes.** Built third: a read took that one's records and left the observer's
  alone, so nothing moved. Rejected because every node a change removes then carries a transient registration for both
  observers, and the `/clear` Scenarios ran 3 to 9% slower, against nothing for the text node.
- **Always query on read**, as Catalyst, Stimulus and Lit's `@query` do. One read path and nothing held, but every read
  pays for a subtree query, and `@targets()` would hand out a new array on every read.
- **Document the stale read.** Leaves every caller that changes the DOM and then reads a target to work around it, with
  a `querySelectorAll` that loses Owner scoping for nested elements of the same tag.

## Consequences

- Between a change and its delivery, the field and the callbacks disagree, as described above. Stimulus targets behave
  the same way.
- When a `@target()` key loses its Target and two claimants arrive in one delivery, the one delivery reaches first can
  be connected and then disconnected again before the other is connected.
- A read with changes waiting writes to the text node, so the observer's callback gets one record more than it would
  have.
- A read with nothing waiting costs one `takeRecords()` call. The `target-reads` Scenario (10,000 reads of a `@target()`
  field, 30 Rounds against `v2.0.0`) puts a read at 0.13 to 0.15µs, up from 0.03µs. A read with changes waiting queries
  the Owner's subtree, 4 to 7ms for 5,000 targets, and the answer is reused until more changes are waiting.
- `@targets()` hands out the same array until its elements change, whether it is read from the index or from the DOM.
- The query has to agree with the index. Ownership is asked of the router, which decides it for delivery too, and the
  `@target()` rule above is followed by both. Tests compare the two on order, nested Owners, a rewritten `data-target`,
  a descriptor with an extra segment, a moved target, a moved Owner and two claimants, and a seeded test runs 300 random
  sequences of such changes, comparing the read with the delivered targets and checking every callback is paired. Run
  against the code before the fixes from its last review, it fails 6 of them.
- Actions are not covered. A dispatch cannot be hooked the way a read can, so an action on an element inserted in the
  same synchronous run is bound only once the insertion is delivered.
