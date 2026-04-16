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
 * Indexes selectors by their leftmost token (`#id`, `.class`, `tag`) so a DOM mutation only needs to consult selectors
 * that could plausibly match the affected element. Selectors whose leftmost token is not one of those forms (e.g.
 * `[data-x]`, `:is(...)`, `*`) fall into a catch-all bucket and are checked against every element.
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
    const bucket = this.bucketFor(selector);
    if (bucket) {
      bucket.map.add(bucket.key, entry);
    } else {
      this.fallback.add(entry);
    }
    this.count += 1;
  }

  delete(selector: string, value: T): void {
    const bucket = this.bucketFor(selector);
    const entries = bucket ? bucket.map.get(bucket.key) : this.fallback;
    if (!entries) return;

    for (const entry of entries) {
      if (entry.selector === selector && entry.value === value) {
        if (bucket) {
          bucket.map.delete(bucket.key, entry);
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

    const tagSet = this.tagIndex.get(element.localName);
    if (tagSet) collect(tagSet, results);

    if (element.id) {
      const idSet = this.idIndex.get(element.id);
      if (idSet) collect(idSet, results);
    }

    for (const className of element.classList) {
      const classSet = this.classIndex.get(className);
      if (classSet) collect(classSet, results);
    }

    if (this.fallback.size > 0) collect(this.fallback, results);

    return results;
  }

  get size(): number {
    return this.count;
  }

  private bucketFor(selector: string): { map: SetMap<string, Entry<T>>; key: string } | null {
    const token = leftmostToken(selector);
    if (!token) return null;
    if (token.kind === 'id') return { map: this.idIndex, key: token.value };
    if (token.kind === 'class') return { map: this.classIndex, key: token.value };
    return { map: this.tagIndex, key: token.value };
  }
}

function collect<T>(set: Set<Entry<T>>, out: Match<T>[]) {
  for (const entry of set) {
    out.push({ selector: entry.selector, value: entry.value });
  }
}

interface Token {
  kind: 'id' | 'class' | 'tag';
  value: string;
}

const ID_PATTERN = /^#([\w-]+)/;
const CLASS_PATTERN = /^\.([\w-]+)/;
const TAG_PATTERN = /^([a-z][\w-]*)/i;

function leftmostToken(selector: string): Token | null {
  const trimmed = selector.replace(/^\s+/, '');

  let match = ID_PATTERN.exec(trimmed);
  if (match) return { kind: 'id', value: match[1] };

  match = CLASS_PATTERN.exec(trimmed);
  if (match) return { kind: 'class', value: match[1] };

  match = TAG_PATTERN.exec(trimmed);
  if (match) return { kind: 'tag', value: match[1].toLowerCase() };

  return null;
}
