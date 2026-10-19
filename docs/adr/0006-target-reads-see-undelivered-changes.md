# Target reads see changes that have not been delivered

A `@target()` or `@targets()` field used to read an index that only caught up when Impulse's `MutationObserver`
delivered its records, so code that changed the DOM and then read a target in the same synchronous run got the old
targets ([#231](https://github.com/Ambiki/impulse/issues/231);
[Ambiki/impulse_view_components#337](https://github.com/Ambiki/impulse_view_components/pull/337) queried the DOM by hand
to get around it). A read now first asks whether changes are waiting. With none, which is almost every read, it returns
the index as before. With some, it works the field out from the DOM the way the index will once they are delivered: the
elements whose Owner is this element and whose `data-target` lists the key, in document order, and for `@target()` the
current Target for as long as it still holds the key. The callbacks still run when the changes are delivered. The field
therefore reflects the DOM as it is now, but between a change and its delivery it can hold an element whose
`[field]Connected` has not run, or lack one whose `[field]Disconnected` has not.

Looking for waiting changes means taking the records from the observer, since `takeRecords()` is the only way to see
them. They are held and delivered ahead of anything queued after them, in the same batch, from the observer's callback
or from a microtask of Impulse's own when the observer has nothing left to call back with.

Inside a callback Impulse runs while delivering changes (for a batch of records, a new Watcher's first scan, or a target
or action router's replay when an element starts and its teardown when it stops), the field is the index: what has been
delivered so far, as before. Those deliveries are also why a `connected()`, `disconnected()` or `lazyImport()`
registered from such a callback leaves queued records alone. It used to do that only inside a batch, so one registered
from a scan's callback could deliver the removal of an element the scan then connected anyway, detached and never to be
disconnected.

## Considered Options

- **Deliver the waiting changes on read.** Built first: the getter flushed the observer, so the field stayed the index,
  every element in it had had its connected callback, and there was a single read path. Rejected because a read then ran
  callbacks in the middle of the caller's method, other elements' and `connected()` callbacks included, and a callback
  could see the caller's work half done. A method that inserted a row, read a target, then set the state the row's
  connected callback reads had the callback see the old state.
- **Always query on read**, as Catalyst, Stimulus and Lit's `@query` do. One read path and no held records, but every
  read pays for a subtree query, and `@targets()` would hand out a new array on every read.
- **Document the stale read.** Leaves every caller that changes the DOM and then reads a target to work around it, with
  a `querySelectorAll` that loses Owner scoping for nested elements of the same tag.

## Consequences

- Between a change and its delivery, the field and the callbacks disagree, as described above. Stimulus targets behave
  the same way.
- When a `@target()` key has no Target, or loses it, and two elements claim it in one task, the read takes the first in
  document order and delivery the first it reaches, which can differ. Both staying is reported as a mistake, and one of
  them leaving brings the two back into agreement.
- A microtask queued between a change and a read runs before the callbacks for that change, where it used to run after:
  the held records are delivered by a microtask queued at the read, unless a change made after the read has the
  observer's callback deliver them first.
- A read with nothing waiting costs one `takeRecords()` call. The `target-reads` Scenario (10,000 reads of a `@target()`
  field, 30 Rounds against `v2.0.0`) puts a read at 0.13 to 0.15µs, up from 0.03µs. A read with changes waiting queries
  the Owner's subtree, 4 to 7ms for 5,000 targets, and the answer is reused until more changes are waiting.
- `@targets()` hands out a new array when the claimants change before delivery, and the index's own array after it, so
  the reference no longer promises the same array until the Targets change.
- The query has to agree with the index: Owner by `closest()`, tokens parsed with `parseTargetDescriptor`, and the
  waiting rule for `@target()`. Tests compare the two on order, nested Owners, a rewritten `data-target`, a descriptor
  with an extra segment, a moved target, and a read before and after delivery.
- Actions are not covered. A dispatch cannot be hooked the way a read can, so an action on an element inserted in the
  same synchronous run is bound only once the insertion is delivered.
