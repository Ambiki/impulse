/**
 * Walks `value` from index `from`, skipping over quoted strings and tracking `(...)` / `[...]` nesting. `visit` is
 * called for every unquoted character with the nesting depth *after* that character is applied (so a closing bracket
 * is visited at the depth of its opener) and may return `true` to stop early. Returns the index the walk stopped at,
 * or `-1` if it reached the end - `null` if quotes or nesting were unbalanced.
 */
function scan(
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
function matchingClose(value: string, openIndex: number): number | null {
  const end = scan(value, openIndex, (_ch, i, depth) => i > openIndex && depth === 0);
  return end === null || end === -1 ? null : end;
}

// CSS identifiers may contain any non-ASCII code point, so `\u00A0` (which `CSS.escape` leaves unescaped) is part of
// an identifier, not whitespace.
const IDENT_PATTERN = /^[\w\u0080-\uFFFF-]+/;
const TAG_PATTERN = /^[a-z][\w\u0080-\uFFFF-]*/i;
// The contents of `[...]` up to the operator: a plain attribute name, optionally followed by an operator. A namespace
// prefix (`ns|attr`, `*|attr`) does not match.
const ATTRIBUTE_NAME_PATTERN = /^[\t\n\f\r ]*([\w\u0080-\uFFFF-]+)[\t\n\f\r ]*(?:[~|^$*]?=|$)/;

/**
 * Whether this parser will read `selector` at all.
 *
 * An escape can hide a quote or a bracket from the scanner, and can carry a space of its own - `CSS.escape('1foo')` is
 * `\\31 foo`, whose trailing space would read as a descendant combinator. A comment can hide a quote too, and so a
 * combinator. Either would be read as a selector meaning something else entirely, so neither is read at all.
 */
export function isReadableSelector(selector: string): boolean {
  return !selector.includes('\\') && !selector.includes('/*');
}

/**
 * Throws a `SyntaxError` unless `selector` can be registered next to others: the browser has to accept it, and it has
 * to end with nothing left open.
 *
 * The second half is stricter than the browser, which closes whatever is still open at the end of its input and so
 * accepts `[data-x` on its own. Registered selectors are queried joined into one list, though, and there the open
 * bracket runs on into the selectors after it: `[data-x, .other` is invalid, and fails for every selector in the list.
 * An open paren, string or comment takes the selectors after it without an error at all.
 */
export function assertValidSelector(selector: string): void {
  // Queried against nothing, so parsing the selector is the only thing that can fail.
  document.createDocumentFragment().querySelector(selector);
  if (!endsClosed(selector)) {
    throw new DOMException(
      `'${selector}' is not a valid selector: a bracket, parenthesis, string, comment or escape is left open.`,
      'SyntaxError',
    );
  }
}

const BLOCK_CLOSERS: Record<string, string | undefined> = { '(': ')', '[': ']', '{': '}' };
const CSS_NEWLINE = /[\n\f\r]/;

/**
 * Whether a selector the browser accepts ends with every block, string and comment closed, and with no escape still
 * waiting for its character.
 *
 * Being accepted does not make a selector well formed: `:is()` and `:where()` drop an argument they cannot parse, so
 * `div:is([data-x)]` is accepted with its paren still open. It is read here the way CSS reads it instead - a block is
 * closed only by its own closer, and a string also ends at a raw newline.
 *
 * Unlike {@link scan}, this reads escapes and comments. A selector with either is as easy to leave open as one
 * without (`.a\`, `.a /*`, `[data-x\]`), and one that is closed is safe in a list, so there is no reason to turn it
 * away. An unquoted `url()` is the one thing not read, which no selector has a use for.
 */
function endsClosed(selector: string): boolean {
  // The closer each open block is waiting for, innermost last.
  const closers: string[] = [];
  let quote: string | null = null;

  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (quote) {
      // An escaped newline carries the string on to the next line, and `\r\n` is one newline.
      if (ch === '\\') i += selector.startsWith('\r\n', i + 1) ? 2 : 1;
      else if (ch === quote || CSS_NEWLINE.test(ch)) quote = null;
    } else if (ch === '\\') {
      // An escape takes the next character whatever it is. With none left, it takes the first one appended.
      i += 1;
      if (i === selector.length) return false;
    } else if (ch === '"' || ch === '\'') {
      quote = ch;
    } else if (ch === '/' && selector[i + 1] === '*') {
      const end = selector.indexOf('*/', i + 2);
      if (end === -1) return false;
      i = end + 1;
    } else if (ch === closers[closers.length - 1]) {
      // Only the closer the innermost block is waiting for. Any other is one more token inside it and closes nothing.
      closers.pop();
    } else {
      const closer = BLOCK_CLOSERS[ch];
      if (closer) closers.push(closer);
    }
  }

  return closers.length === 0 && quote === null;
}

/**
 * One simple selector of a compound. Every one carries the `source` it was read from, and concatenating those in order
 * reproduces the compound exactly, so a caller can rebuild one out of the simple selectors it keeps.
 *
 * Names are reported as written, except a pseudo-class's, which is lowercased because CSS matches it case-insensitively
 * while a tag or attribute name's case can matter (an SVG element keeps `viewBox`, an HTML one lowercases it). A
 * caller that needs a tag name folded does it itself.
 *
 * An attribute's `name` is `null` when the selector namespaces it (`[xlink|href]`), which this parser does not read. A
 * pseudo's `element` marks the `::` form, and its `argument` is the text between the parens, or `null` when it has
 * none.
 */
export type SimpleSelector =
  { kind: 'tag'; source: string; name: string } |
  { kind: 'universal'; source: string } |
  { kind: 'id'; source: string; name: string } |
  { kind: 'class'; source: string; name: string } |
  { kind: 'attribute'; source: string; name: string | null } |
  { kind: 'pseudo'; source: string; name: string; element: boolean; argument: string | null };

/**
 * The simple selectors of a single compound - a type or universal selector, `#id`, `.class`, `[attribute]` and
 * pseudo-classes - in source order. `input.a:not(.b)` reads as a tag, a class, and a pseudo-class holding `.b`.
 *
 * Returns `null` when the compound is not one this parser can read: an identifier that is missing, a bracket or paren
 * that is unbalanced, or a combinator, which belongs between compounds rather than inside one. Pass a whole complex
 * selector through {@link rightmostCompound} first.
 *
 * Nothing here decides what a compound *means* - a namespaced attribute keeps its source and loses its name, and a
 * pseudo-class is reported rather than judged. Callers differ on which of those they can accept, so each reads the
 * list on its own terms.
 */
export function tokenizeCompound(compound: string): SimpleSelector[] | null {
  const tokens: SimpleSelector[] = [];
  let i = 0;

  const tagMatch = TAG_PATTERN.exec(compound);
  if (tagMatch) {
    tokens.push({ kind: 'tag', source: tagMatch[0], name: tagMatch[0] });
    i = tagMatch[0].length;
  } else if (compound[0] === '*') {
    tokens.push({ kind: 'universal', source: '*' });
    i = 1;
  }

  while (i < compound.length) {
    const ch = compound[i];
    if (ch === '#' || ch === '.') {
      const match = IDENT_PATTERN.exec(compound.slice(i + 1));
      if (!match) return null;
      const end = i + 1 + match[0].length;
      tokens.push({ kind: ch === '#' ? 'id' : 'class', source: compound.slice(i, end), name: match[0] });
      i = end;
    } else if (ch === '[') {
      const close = matchingClose(compound, i);
      if (close === null) return null;
      const match = ATTRIBUTE_NAME_PATTERN.exec(compound.slice(i + 1, close));
      tokens.push({ kind: 'attribute', source: compound.slice(i, close + 1), name: match ? match[1] : null });
      i = close + 1;
    } else if (ch === ':') {
      const element = compound[i + 1] === ':';
      const nameStart = i + (element ? 2 : 1);
      const match = IDENT_PATTERN.exec(compound.slice(nameStart));
      if (!match) return null;
      let end = nameStart + match[0].length;
      let argument: string | null = null;
      if (compound[end] === '(') {
        const close = matchingClose(compound, end);
        if (close === null) return null;
        argument = compound.slice(end + 1, close);
        end = close + 1;
      }
      // Pseudo-class names are matched case-insensitively, so the name is lowercased and the source kept as written.
      tokens.push({
        kind: 'pseudo',
        source: compound.slice(i, end),
        name: match[0].toLowerCase(),
        element,
        argument,
      });
      i = end;
    } else {
      return null;
    }
  }

  return tokens;
}

/**
 * The attribute names whose change on an element can make `selector` start or stop matching it, or `null` when the
 * selector is not read as a self-contained selector: its match could also change through something other than the
 * element's own attributes (an ancestor, a sibling, focus, user input), or it uses syntax this parser does not read.
 */
export function selectorAttributes(selector: string): string[] | null {
  if (!isReadableSelector(selector)) return null;

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
  const tokens = tokenizeCompound(compound);
  if (tokens === null) return false;

  for (const token of tokens) {
    if (token.kind === 'id') {
      names.add('id');
    } else if (token.kind === 'class') {
      names.add('class');
    } else if (token.kind === 'attribute') {
      // A namespaced attribute (`[xlink|href]`) has no name to watch, so the compound cannot be read as
      // self-contained.
      if (token.name === null) return false;
      // HTML elements match attribute names case-insensitively and store them lowercased; SVG and MathML elements keep
      // the case they were written in.
      names.add(token.name);
      names.add(token.name.toLowerCase());
    } else if (token.kind === 'pseudo') {
      // A pseudo-element never matches an element at all, and a pseudo-class outside the logical ones can turn on
      // something other than the element's own attributes.
      if (token.element || token.argument === null || !LOGICAL_PSEUDO_CLASSES.has(token.name)) return false;
      if (!readSelectorList(token.argument, names)) return false;
    }
    // A type or universal selector depends on no attribute at all.
  }

  return true;
}

// Only the five CSS whitespace characters separate compounds; `\u00A0` is part of an identifier.
const CSS_WHITESPACE = /[\t\n\f\r ]/;

/**
 * Returns the substring after the last top-level combinator (descendant whitespace, `>`, `+`, `~`), or `null` if the
 * selector is malformed (unbalanced brackets/parens/quotes).
 */
export function rightmostCompound(selector: string): string | null {
  let start = 0;
  const end = scan(selector, 0, (ch, i, depth) => {
    if (depth === 0 && (ch === '>' || ch === '+' || ch === '~' || CSS_WHITESPACE.test(ch))) start = i + 1;
  });
  return end === null ? null : selector.slice(start);
}

/**
 * One selector per part of `selector`, each matching a superset of that part by depending only on its subject: the
 * rightmost compound, with pseudo-classes and pseudo-elements dropped. `.open .item:hover, a` becomes
 * `['.item', 'a']`. Returned as parts rather than one joined selector so a caller combining several selectors can drop
 * the duplicates between them - the cost of querying with the result grows with the number of parts in it.
 *
 * A removed subtree is detached by the time its mutation record is delivered, so the ancestors and siblings an
 * anchored selector needs are out of reach and querying the selector itself would find nothing. The subject is enough
 * to enumerate the elements a watcher could have been tracking, which is all a disconnect needs.
 *
 * Returns `null` when no such selector exists - a subject of `*` or a bare `:is(...)` has nothing to query on - or for
 * a selector {@link isReadableSelector} rejects, where the subject read out would mean something else entirely rather
 * than a superset. Callers fall back to walking every element.
 */
export function subjectSelectors(selector: string): string[] | null {
  if (!isReadableSelector(selector)) return null;

  const subjects: string[] = [];
  for (const part of splitSelectorList(selector)) {
    const subject = subjectCompound(part);
    if (subject === null) return null;
    subjects.push(subject);
  }

  return subjects.length > 0 ? subjects : null;
}

/**
 * The simple selectors of `part`'s subject compound in source order, with pseudo-classes and pseudo-elements dropped.
 * Returns `null` when nothing is left to query on, or when the compound uses syntax this parser does not read.
 */
function subjectCompound(part: string): string | null {
  const compound = rightmostCompound(part);
  if (compound === null) return null;
  const tokens = tokenizeCompound(compound);
  if (tokens === null) return null;

  let subject = '';
  for (const token of tokens) {
    // A pseudo-class only narrows the compound, so dropping it keeps the result a superset, and the universal selector
    // narrows nothing - neither leaves anything to query on.
    if (token.kind === 'pseudo' || token.kind === 'universal') continue;
    subject += token.source;
  }

  return subject.length > 0 ? subject : null;
}
