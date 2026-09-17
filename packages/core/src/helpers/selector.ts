/**
 * Walks `value` from index `from`, skipping over quoted strings and tracking `(...)` / `[...]` nesting. `visit` is
 * called for every unquoted character with the nesting depth *after* that character is applied (so a closing bracket
 * is visited at the depth of its opener) and may return `true` to stop early. Returns the index the walk stopped at,
 * or `-1` if it reached the end - `null` if quotes or nesting were unbalanced.
 */
export function scan(
  value: string,
  from: number,
  visit: (ch: string, index: number, depth: number) => boolean | void,
): number | null {
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

const CSS_TRIM = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

/**
 * Splits a selector list on top-level commas, ignoring commas inside `(...)`, `[...]`, and quoted strings.
 */
export function splitSelectorList(selector: string): string[] {
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
 * Index of the bracket or paren closing the one at `openIndex`, honoring nesting and quoted strings; `null` if
 * unbalanced.
 */
export function matchingClose(value: string, openIndex: number): number | null {
  const end = scan(value, openIndex, (_ch, i, depth) => i > openIndex && depth === 0);
  return end === null || end === -1 ? null : end;
}

// CSS identifiers may contain any non-ASCII code point, so `\u00A0` (which `CSS.escape` leaves unescaped) is part of
// an identifier, not whitespace.
export const IDENT_PATTERN = /^[\w\u0080-\uFFFF-]+/;
export const TAG_PATTERN = /^[a-z][\w\u0080-\uFFFF-]*/i;
// The contents of `[...]` up to the operator: a plain attribute name, optionally followed by an operator. A namespace
// prefix (`ns|attr`, `*|attr`) does not match.
const ATTRIBUTE_NAME_PATTERN = /^[\t\n\f\r ]*([\w\u0080-\uFFFF-]+)[\t\n\f\r ]*(?:[~|^$*]?=|$)/;

/**
 * The attribute names whose change on an element can make `selector` start or stop matching it, or `null` when the
 * selector is not read as a self-contained selector: its match could also change through something other than the
 * element's own attributes (an ancestor, a sibling, focus, user input), or it uses syntax this parser does not read.
 */
export function selectorAttributes(selector: string): string[] | null {
  // An escape or a comment can hide a quote or bracket from the scanner, so neither is ever read.
  if (selector.includes('\\') || selector.includes('/*')) return null;

  const names = new Set<string>();
  return readSelectorList(selector, names) ? Array.from(names) : null;
}

// Pseudo-classes that only combine their arguments, so they are self-contained exactly when those arguments are.
const LOGICAL_PSEUDO_CLASSES = new Set(['is', 'where', 'not']);

/**
 * Adds the attributes every part of `selectorList` depends on to `names`. Returns `false` when the list is empty or any
 * part is not a self-contained selector.
 */
function readSelectorList(selectorList: string, names: Set<string>): boolean {
  const parts = splitSelectorList(selectorList);
  return parts.length > 0 && parts.every((part) => readCompound(part, names));
}

/**
 * Adds the attributes `compound` depends on to `names`. Returns `false` for anything but a single compound of a type
 * or universal selector, `#id`, `.class`, attribute selectors, and `:is()`, `:where()`, or `:not()` over those.
 */
function readCompound(compound: string, names: Set<string>): boolean {
  let i = 0;
  const tagMatch = TAG_PATTERN.exec(compound);
  if (tagMatch) i = tagMatch[0].length;
  else if (compound[0] === '*') i = 1;

  while (i < compound.length) {
    const ch = compound[i];
    if (ch === '#' || ch === '.') {
      const match = IDENT_PATTERN.exec(compound.slice(i + 1));
      if (!match) return false;
      names.add(ch === '#' ? 'id' : 'class');
      i += 1 + match[0].length;
    } else if (ch === '[') {
      const end = matchingClose(compound, i);
      if (end === null) return false;
      const match = ATTRIBUTE_NAME_PATTERN.exec(compound.slice(i + 1, end));
      if (!match) return false;
      // HTML elements match attribute names case-insensitively and store them lowercased; SVG and MathML elements keep
      // the case they were written in.
      names.add(match[1]);
      names.add(match[1].toLowerCase());
      i = end + 1;
    } else if (ch === ':') {
      const match = IDENT_PATTERN.exec(compound.slice(i + 1));
      if (!match || !LOGICAL_PSEUDO_CLASSES.has(match[0].toLowerCase())) return false;
      const open = i + 1 + match[0].length;
      if (compound[open] !== '(') return false;
      const end = matchingClose(compound, open);
      if (end === null || !readSelectorList(compound.slice(open + 1, end), names)) return false;
      i = end + 1;
    } else {
      return false;
    }
  }
  return true;
}
