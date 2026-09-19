import {
  isReadableSelector,
  rightmostCompound,
  splitSelectorList,
  subjectSelectors,
  tokenizeCompound,
} from '../helpers/selector';
import SetMap from './set_map';

interface Entry<T> {
  selector: string;
  value: T;
  /** The {@link SelectorSet.matches} call that last collected this entry, so a repeat can be skipped without a set. */
  generation: number;
}

/**
 * A candidate returned by {@link SelectorSet.matches}: the indexed selector and the value stored with it.
 */
export interface Match<T> {
  selector: string;
  value: T;
}

/** Nothing to query, so nothing to iterate. Shared rather than allocated per call. */
const EMPTY: Element[] = [];

/**
 * Indexes selectors by the key token (`#id`, `[attribute]`, `.class`, or `tag`) of their *subject* - the rightmost
 * compound of each comma-separated part - so a DOM mutation only needs to consult selectors that could plausibly match
 * the affected element. `form > button` is indexed under the `button` tag, and `div, .foo` under both `div` and `.foo`.
 * Selectors with a part whose subject has no such token (e.g. `:is(...)`, `*`) fall into a catch-all bucket and are
 * checked against every element.
 *
 * Modeled on https://github.com/josh/selector-set, which likewise keys each comma-separated part on its last compound.
 * Its indexes stop at `#id`, `.class` and `tag`; an attribute index is added here because a framework's own selectors
 * (`[data-target]`, `[data-action]`) are attribute-only compounds that would otherwise all sit in the catch-all bucket.
 *
 * Callers must run the final `element.matches(selector)` check on the returned candidates - the index narrows the
 * search space; it does not validate the full selector. {@link SelectorSet.queryAll} and
 * {@link SelectorSet.querySubjects} enumerate a subtree instead, and their contracts differ; see each.
 */
export default class SelectorSet<T> {
  private idIndex = new SetMap<string, Entry<T>>();
  private attributeIndex = new SetMap<string, Entry<T>>();
  private classIndex = new SetMap<string, Entry<T>>();
  private tagIndex = new SetMap<string, Entry<T>>();
  private fallback = new Set<Entry<T>>();
  private count = 0;
  private generation = 0;
  // How many entries each distinct selector holds, so the queries below are rebuilt only when the set of selectors
  // itself changes rather than on every add and delete.
  private selectorCounts = new Map<string, number>();
  private matchQueryString: string | null = null;
  private subjectQueryString: string | null = null;
  private attributeNames: string[] | null = null;

  /**
   * Indexes `value` under `selector`. Adding the same pair twice stores two entries, each needing its own
   * {@link SelectorSet.delete}.
   */
  add(selector: string, value: T): void {
    const entry: Entry<T> = { selector, value, generation: 0 };
    const buckets = this.bucketsFor(selector);
    if (buckets) {
      for (const bucket of buckets) bucket.map.add(bucket.key, entry);
    } else {
      this.fallback.add(entry);
    }
    this.count += 1;
    this.countSelector(selector, 1);
  }

  /**
   * Removes one entry for the `selector`/`value` pair. A no-op when the pair was never added.
   */
  delete(selector: string, value: T): void {
    const buckets = this.bucketsFor(selector);
    const entries = buckets ? buckets[0].map.get(buckets[0].key) : this.fallback;
    if (!entries) return;

    for (const entry of entries) {
      if (entry.selector === selector && entry.value === value) {
        if (buckets) {
          for (const bucket of buckets) bucket.map.delete(bucket.key, entry);
        } else {
          this.fallback.delete(entry);
        }
        this.count -= 1;
        this.countSelector(selector, -1);
        return;
      }
    }
  }

  /**
   * Every entry whose selector could match `element`, each returned once however many buckets it sits in. These are
   * candidates: run `element.matches(selector)` on them to get the real matches.
   *
   * The results belong to the set and are only valid until the next call, which reuses them. Read them and let them
   * go; retaining or mutating one corrupts the index.
   */
  matches(element: Element): Match<T>[] {
    // The one allocation left, and it earns its keep: callers run callbacks per candidate, and those callbacks
    // register and stop watchers, so walking the live buckets instead would skip or repeat entries mid-iteration.
    const results: Match<T>[] = [];
    // A selector list is indexed once per part, so the same entry can live in several buckets. Stamping each entry
    // with the current call is enough to collect it once, and costs nothing to allocate.
    this.generation += 1;
    const generation = this.generation;

    // Tag keys are lowercased on both sides so camel-cased SVG names (`linearGradient`) still find their bucket.
    const tagSet = this.tagIndex.get(element.localName.toLowerCase());
    if (tagSet) collect(tagSet, results, generation);

    if (element.id) {
      const idSet = this.idIndex.get(element.id);
      if (idSet) collect(idSet, results, generation);
    }

    for (const className of element.classList) {
      const classSet = this.classIndex.get(className);
      if (classSet) collect(classSet, results, generation);
    }

    // Asked of the element by name, rather than read off it: `element.attributes` and `getAttributeNames()` both
    // materialize something per call, and a document holds far more elements than a set holds attribute selectors.
    const attributeNames = (this.attributeNames ??= this.attributeIndex.keys);
    for (let index = 0; index < attributeNames.length; index += 1) {
      const name = attributeNames[index];
      if (!element.hasAttribute(name)) continue;
      const attributeSet = this.attributeIndex.get(name);
      if (attributeSet) collect(attributeSet, results, generation);
    }

    if (this.fallback.size > 0) collect(this.fallback, results, generation);

    return results;
  }

  /**
   * The descendants of `context` matching any indexed selector, for a subtree that has just been *added*. It is already
   * in the document when a mutation record is delivered, and `querySelectorAll` resolves a selector against the whole
   * document before narrowing to descendants, so a selector anchored on an ancestor outside `context` still matches.
   * Results are therefore exact for the set as a whole, though a caller still needs {@link SelectorSet.matches} to
   * learn *which* selector each one matched.
   *
   * `context` itself is never included, the way `querySelectorAll` does not include its root.
   */
  queryAll(context: Element): Iterable<Element> {
    if (this.count === 0) return EMPTY;
    this.matchQueryString ??= Array.from(this.selectorCounts.keys()).join(', ');
    return context.querySelectorAll(this.matchQueryString);
  }

  /**
   * The descendants of `context` that could be tracked under any indexed selector, for a subtree that has just been
   * removed. Such a subtree is detached by the time its record is delivered, so an anchored selector can no longer
   * match inside it and {@link SelectorSet.queryAll} would come back empty. Each selector is reduced to its subject
   * instead, which every element it matched still matches, so the result is a superset - enough to find everything a
   * disconnect has to reach.
   *
   * Degrades to every element when some selector has no queryable subject at all.
   *
   * `context` itself is never included.
   */
  querySubjects(context: Element): Iterable<Element> {
    if (this.count === 0) return EMPTY;
    this.subjectQueryString ??= buildSubjectQuery(this.selectorCounts.keys());
    return context.querySelectorAll(this.subjectQueryString);
  }

  /**
   * How many entries are indexed.
   */
  get size(): number {
    return this.count;
  }

  /**
   * Tracks how many entries each distinct selector holds, dropping the cached queries and attribute names when the set
   * of selectors gains or loses one. A second entry for a selector already held changes neither.
   */
  private countSelector(selector: string, delta: 1 | -1): void {
    const previous = this.selectorCounts.get(selector) ?? 0;
    const count = previous + delta;
    if (count === 0) {
      this.selectorCounts.delete(selector);
    } else {
      this.selectorCounts.set(selector, count);
    }
    if (previous === 0 || count === 0) {
      this.matchQueryString = null;
      this.subjectQueryString = null;
      this.attributeNames = null;
    }
  }

  /**
   * One bucket per comma-separated part - two for an attribute whose name is not already lowercase, since an HTML
   * element stores it lowercased while an SVG or MathML one keeps the case it was written in. `null` when any part
   * cannot be indexed (the whole selector then goes to the fallback bucket so no part is ever missed).
   */
  private bucketsFor(selector: string): Array<{ map: SetMap<string, Entry<T>>; key: string }> | null {
    // An escaped identifier (`#\31 foo` from `CSS.escape('1foo')`) would also need decoding to index correctly, so an
    // unreadable selector goes to the fallback bucket - always correct, just unindexed.
    if (!isReadableSelector(selector)) return null;

    const buckets: Array<{ map: SetMap<string, Entry<T>>; key: string }> = [];
    const seen = new Set<string>();
    for (const part of splitSelectorList(selector)) {
      const token = subjectToken(part);
      if (!token) return null;
      const id = `${token.kind}:${token.value}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (token.kind === 'id') {
        buckets.push({ map: this.idIndex, key: token.value });
      } else if (token.kind === 'attribute') {
        buckets.push({ map: this.attributeIndex, key: token.value });
        const lowercased = token.value.toLowerCase();
        if (lowercased !== token.value) buckets.push({ map: this.attributeIndex, key: lowercased });
      } else if (token.kind === 'class') {
        buckets.push({ map: this.classIndex, key: token.value });
      } else {
        buckets.push({ map: this.tagIndex, key: token.value });
      }
    }
    return buckets.length > 0 ? buckets : null;
  }
}

function collect<T>(set: Set<Entry<T>>, out: Match<T>[], generation: number) {
  for (const entry of set) {
    if (entry.generation === generation) continue;
    entry.generation = generation;
    out.push(entry);
  }
}

/**
 * One selector matching a superset of every selector in `selectors`, depending only on their subjects, or `*` when any
 * of them has no queryable subject. Parts shared between selectors are contributed once - `.open .item` and
 * `.closed .item` both reduce to `.item` - since querying costs more for every part the result carries.
 */
function buildSubjectQuery(selectors: Iterable<string>): string {
  const subjects = new Set<string>();
  for (const selector of selectors) {
    const parts = subjectSelectors(selector);
    if (parts === null) return '*';
    for (const part of parts) subjects.add(part);
  }
  return subjects.size > 0 ? Array.from(subjects).join(', ') : '*';
}

interface Token {
  kind: 'id' | 'attribute' | 'class' | 'tag';
  value: string;
}

/**
 * Returns the key token of a single complex selector's subject: its rightmost compound. Prefers `#id` over
 * `[attribute]` over `.class` over `tag`, since a more specific key means fewer candidates - and an attribute is
 * rarer across a document than a class, which is rarer than a tag. Returns `null` when the compound has no such token
 * or contains syntax this parser does not understand.
 */
function subjectToken(selector: string): Token | null {
  const compound = rightmostCompound(selector);
  if (compound === null) return null;
  const simpleSelectors = tokenizeCompound(compound);
  if (simpleSelectors === null) return null;

  let id: string | undefined;
  let attribute: string | undefined;
  let className: string | undefined;
  let tag: string | undefined;

  for (const simple of simpleSelectors) {
    if (simple.kind === 'id') {
      id ??= simple.name;
    } else if (simple.kind === 'attribute') {
      // A namespaced attribute (`[xlink|href]`) is left unindexed rather than keyed on a name it does not have.
      if (simple.name !== null) attribute ??= simple.name;
    } else if (simple.kind === 'class') {
      className ??= simple.name;
    } else if (simple.kind === 'tag') {
      // Tag keys are lowercased on both sides so camel-cased SVG names (`linearGradient`) still find their bucket.
      tag ??= simple.name.toLowerCase();
    }
    // A universal selector and a pseudo-class are no use as a key; the compound is indexed on whatever else it holds.
  }

  if (id !== undefined) return { kind: 'id', value: id };
  if (attribute !== undefined) return { kind: 'attribute', value: attribute };
  if (className !== undefined) return { kind: 'class', value: className };
  if (tag !== undefined) return { kind: 'tag', value: tag };
  return null;
}
