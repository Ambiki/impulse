import SetMap from './set_map';

interface Entry<T> {
  selector: string;
  value: T;
}

/**
 * A candidate returned by {@link SelectorSet.matches}: the indexed selector and the value stored with it.
 */
export interface Match<T> {
  selector: string;
  value: T;
}

/**
 * Indexes selectors by the key token (`#id`, `.class`, or `tag`) of their *subject* - the rightmost compound of each
 * comma-separated part - so a DOM mutation only needs to consult selectors that could plausibly match the affected
 * element. `form > button` is indexed under the `button` tag, and `div, .foo` under both `div` and `.foo`. Selectors
 * with a part whose subject has no such token (e.g. `[data-x]`, `:is(...)`, `*`) fall into a catch-all bucket and are
 * checked against every element.
 *
 * Modeled on https://github.com/josh/selector-set, which likewise keys each comma-separated part on its last compound.
 *
 * Callers must run the final `element.matches(selector)` check on the returned candidates - the index narrows the
 * search space; it does not validate the full selector.
 */
export default class SelectorSet<T> {
  private idIndex = new SetMap<string, Entry<T>>();
  private classIndex = new SetMap<string, Entry<T>>();
  private tagIndex = new SetMap<string, Entry<T>>();
  private fallback = new Set<Entry<T>>();
  private count = 0;

  /**
   * Indexes `value` under `selector`. Adding the same pair twice stores two entries, each needing its own
   * {@link SelectorSet.delete}.
   */
  add(selector: string, value: T): void {
    const entry: Entry<T> = { selector, value };
    const buckets = this.bucketsFor(selector);
    if (buckets) {
      for (const bucket of buckets) bucket.map.add(bucket.key, entry);
    } else {
      this.fallback.add(entry);
    }
    this.count += 1;
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
        return;
      }
    }
  }

  /**
   * Every entry whose selector could match `element`, each returned once however many buckets it sits in. These are
   * candidates: run `element.matches(selector)` on them to get the real matches.
   */
  matches(element: Element): Match<T>[] {
    const results: Match<T>[] = [];
    // A selector list is indexed once per part, so the same entry can live in several buckets.
    const seen = new Set<Entry<T>>();

    // Tag keys are lowercased on both sides so camel-cased SVG names (`linearGradient`) still find their bucket.
    const tagSet = this.tagIndex.get(element.localName.toLowerCase());
    if (tagSet) collect(tagSet, results, seen);

    if (element.id) {
      const idSet = this.idIndex.get(element.id);
      if (idSet) collect(idSet, results, seen);
    }

    for (const className of element.classList) {
      const classSet = this.classIndex.get(className);
      if (classSet) collect(classSet, results, seen);
    }

    if (this.fallback.size > 0) collect(this.fallback, results, seen);

    return results;
  }

  /**
   * How many entries are indexed.
   */
  get size(): number {
    return this.count;
  }

  /**
   * One bucket per comma-separated part, or `null` when any part cannot be indexed (the whole selector then goes to
   * the fallback bucket so no part is ever missed).
   */
  private bucketsFor(selector: string): Array<{ map: SetMap<string, Entry<T>>; key: string }> | null {
    // Escaped identifiers (e.g. `#\31 foo` from `CSS.escape('1foo')`) would need decoding to index correctly; the
    // fallback bucket is always correct, just unindexed.
    if (selector.includes('\\')) return null;

    const buckets: Array<{ map: SetMap<string, Entry<T>>; key: string }> = [];
    const seen = new Set<string>();
    for (const part of splitSelectorList(selector)) {
      const token = subjectToken(part);
      if (!token) return null;
      const id = `${token.kind}:${token.value}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (token.kind === 'id') buckets.push({ map: this.idIndex, key: token.value });
      else if (token.kind === 'class') buckets.push({ map: this.classIndex, key: token.value });
      else buckets.push({ map: this.tagIndex, key: token.value });
    }
    return buckets.length > 0 ? buckets : null;
  }
}

function collect<T>(set: Set<Entry<T>>, out: Match<T>[], seen: Set<Entry<T>>) {
  for (const entry of set) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push({ selector: entry.selector, value: entry.value });
  }
}

interface Token {
  kind: 'id' | 'class' | 'tag';
  value: string;
}

// CSS identifiers may contain any non-ASCII code point, so `\u00A0` (which `CSS.escape` leaves unescaped) is part of
// an identifier, not whitespace. Only the five CSS whitespace characters separate compounds.
const IDENT_PATTERN = /^[\w\u0080-\uFFFF-]+/;
const TAG_PATTERN = /^[a-z][\w\u0080-\uFFFF-]*/i;
const CSS_WHITESPACE = /[\t\n\f\r ]/;
const CSS_TRIM = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

/**
 * Walks `value` from index `from`, skipping over quoted strings and tracking `(...)` / `[...]` nesting. `visit` is
 * called for every unquoted character with the nesting depth *after* that character is applied (so a closing bracket
 * is visited at the depth of its opener) and may return `true` to stop early. Returns the index the walk stopped at,
 * or `-1` if it reached the end - `null` if quotes or nesting were unbalanced.
 */
function scan(value: string, from: number, visit: (ch: string, index: number, depth: number) => boolean | void) {
  let depth = 0;
  let quote: string | null = null;

  for (let i = from; i < value.length; i += 1) {
    const ch = value[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    if (depth < 0) return null;
    if (visit(ch, i, depth)) return i;
  }

  return depth === 0 && quote === null ? -1 : null;
}

/**
 * Splits a selector list on top-level commas, ignoring commas inside `(...)`, `[...]`, and quoted strings.
 */
function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let start = 0;
  scan(selector, 0, (ch, i, depth) => {
    if (ch === ',' && depth === 0) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  });
  parts.push(selector.slice(start));

  return parts.map((part) => part.replace(CSS_TRIM, '')).filter((part) => part.length > 0);
}

/**
 * Returns the key token of a single complex selector's subject: its rightmost compound. Prefers `#id` over `.class`
 * over `tag`, since a more specific key means fewer candidates. Returns `null` when the compound has no such token or
 * contains syntax this parser does not understand.
 */
function subjectToken(selector: string): Token | null {
  const compound = rightmostCompound(selector);
  if (compound === null) return null;

  let id: string | undefined;
  let className: string | undefined;
  let tag: string | undefined;
  let i = 0;

  const tagMatch = TAG_PATTERN.exec(compound);
  if (tagMatch) {
    tag = tagMatch[0].toLowerCase();
    i = tagMatch[0].length;
  } else if (compound[0] === '*') {
    i = 1;
  }

  while (i < compound.length) {
    const ch = compound[i];
    if (ch === '#' || ch === '.') {
      const match = IDENT_PATTERN.exec(compound.slice(i + 1));
      if (!match) return null;
      if (ch === '#') id ??= match[0];
      else className ??= match[0];
      i += 1 + match[0].length;
    } else if (ch === '[') {
      const end = matchingClose(compound, i);
      if (end === null) return null;
      i = end + 1;
    } else if (ch === ':') {
      i += compound[i + 1] === ':' ? 2 : 1;
      const match = IDENT_PATTERN.exec(compound.slice(i));
      if (!match) return null;
      i += match[0].length;
      if (compound[i] === '(') {
        const end = matchingClose(compound, i);
        if (end === null) return null;
        i = end + 1;
      }
    } else {
      return null;
    }
  }

  if (id !== undefined) return { kind: 'id', value: id };
  if (className !== undefined) return { kind: 'class', value: className };
  if (tag !== undefined) return { kind: 'tag', value: tag };
  return null;
}

/**
 * Returns the substring after the last top-level combinator (descendant whitespace, `>`, `+`, `~`), or `null` if the
 * selector is malformed (unbalanced brackets/parens/quotes).
 */
function rightmostCompound(selector: string): string | null {
  let start = 0;
  const end = scan(selector, 0, (ch, i, depth) => {
    if (depth === 0 && (ch === '>' || ch === '+' || ch === '~' || CSS_WHITESPACE.test(ch))) start = i + 1;
  });
  return end === null ? null : selector.slice(start);
}

/**
 * Index of the bracket or paren closing the one at `openIndex`, honoring nesting and quoted strings; `null` if
 * unbalanced.
 */
function matchingClose(value: string, openIndex: number): number | null {
  const end = scan(value, openIndex, (_ch, i, depth) => i > openIndex && depth === 0);
  return end === null || end === -1 ? null : end;
}
