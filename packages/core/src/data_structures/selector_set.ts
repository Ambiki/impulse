import SetMap from './set_map';

interface Entry<T> {
  selector: string;
  value: T;
}

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

  matches(element: Element): Match<T>[] {
    const results: Match<T>[] = [];
    // A selector list is indexed once per part, so the same entry can live in several buckets.
    const seen = new Set<Entry<T>>();

    const tagSet = this.tagIndex.get(element.localName);
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

  get size(): number {
    return this.count;
  }

  /**
   * One bucket per comma-separated part, or `null` when any part cannot be indexed (the whole selector then goes to
   * the fallback bucket so no part is ever missed).
   */
  private bucketsFor(selector: string): Array<{ map: SetMap<string, Entry<T>>; key: string }> | null {
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

const IDENT_PATTERN = /^[\w-]+/;
const TAG_PATTERN = /^[a-z][\w-]*/i;

/**
 * Splits a selector list on top-level commas, ignoring commas inside `(...)`, `[...]`, and quoted strings.
 */
function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let parens = 0;
  let brackets = 0;
  let quote: string | null = null;

  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (ch === '\\') {
      i += 1;
    } else if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === '\'') {
      quote = ch;
    } else if (ch === '(') {
      parens += 1;
    } else if (ch === ')') {
      parens -= 1;
    } else if (ch === '[') {
      brackets += 1;
    } else if (ch === ']') {
      brackets -= 1;
    } else if (ch === ',' && parens === 0 && brackets === 0) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));

  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
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
      const end = matchingClose(compound, i, '[', ']');
      if (end === -1) return null;
      i = end + 1;
    } else if (ch === ':') {
      i += compound[i + 1] === ':' ? 2 : 1;
      const match = IDENT_PATTERN.exec(compound.slice(i));
      if (!match) return null;
      i += match[0].length;
      if (compound[i] === '(') {
        const end = matchingClose(compound, i, '(', ')');
        if (end === -1) return null;
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
  let parens = 0;
  let brackets = 0;
  let quote: string | null = null;

  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (ch === '\\') {
      i += 1;
    } else if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === '\'') {
      quote = ch;
    } else if (ch === '(') {
      parens += 1;
    } else if (ch === ')') {
      parens -= 1;
    } else if (ch === '[') {
      brackets += 1;
    } else if (ch === ']') {
      brackets -= 1;
    } else if (parens === 0 && brackets === 0 && (ch === '>' || ch === '+' || ch === '~' || /\s/.test(ch))) {
      start = i + 1;
    }
  }

  if (parens !== 0 || brackets !== 0 || quote !== null) return null;
  return selector.slice(start);
}

/**
 * Index of the bracket closing the one at `openIndex`, honoring nesting and quoted strings; `-1` if unbalanced.
 */
function matchingClose(value: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '\\') {
      i += 1;
    } else if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === '\'') {
      quote = ch;
    } else if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
