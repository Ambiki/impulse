import { expect, fixture, html } from '@open-wc/testing';
import SelectorSet from '../../src/data_structures/selector_set';

describe('SelectorSet', () => {
  it('indexes by id and returns matches for an element with that id', async () => {
    const set = new SelectorSet<string>();
    set.add('#main', 'a');
    set.add('#other', 'b');
    const el = await fixture<HTMLElement>(html`<div id="main"></div>`);

    const matches = set.matches(el);
    expect(matches.map((m) => m.selector)).to.deep.equal(['#main']);
    expect(matches.map((m) => m.value)).to.deep.equal(['a']);
  });

  it('indexes by class and returns matches across multiple classes', async () => {
    const set = new SelectorSet<string>();
    set.add('.foo', 'a');
    set.add('.bar', 'b');
    set.add('.baz', 'c');
    const el = await fixture<HTMLElement>(html`<div class="foo bar"></div>`);

    const matches = set.matches(el);
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['a', 'b']);
  });

  it('indexes by tag name', async () => {
    const set = new SelectorSet<string>();
    set.add('button', 'a');
    set.add('div', 'b');
    const el = await fixture<HTMLElement>(html`<button></button>`);

    const matches = set.matches(el);
    expect(matches.map((m) => m.value)).to.deep.equal(['a']);
  });

  it('puts attribute and pseudo selectors in the fallback bucket', async () => {
    const set = new SelectorSet<string>();
    set.add('[data-foo]', 'attr');
    set.add(':is(a, button)', 'pseudo');
    const el = await fixture<HTMLElement>(html`<div data-foo="x"></div>`);

    const matches = set.matches(el);
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['attr', 'pseudo']);
  });

  it('returns candidates from id, class, tag, and fallback together', async () => {
    const set = new SelectorSet<string>();
    set.add('#main', 'id');
    set.add('.foo', 'class');
    set.add('div', 'tag');
    set.add('[data-x]', 'fallback');
    set.add('#other', 'unrelated-id');
    set.add('span', 'unrelated-tag');
    const el = await fixture<HTMLElement>(html`<div id="main" class="foo" data-x></div>`);

    const matches = set.matches(el);
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['class', 'fallback', 'id', 'tag']);
  });

  it('returns no matches for an element that does not match any indexed selector', async () => {
    const set = new SelectorSet<string>();
    set.add('#main', 'a');
    set.add('.foo', 'b');
    const el = await fixture<HTMLElement>(html`<section></section>`);

    expect(set.matches(el)).to.deep.equal([]);
  });

  it('tracks size on add and delete', () => {
    const set = new SelectorSet<string>();
    expect(set.size).to.equal(0);

    set.add('.foo', 'a');
    set.add('.foo', 'b');
    set.add('#bar', 'c');
    expect(set.size).to.equal(3);

    set.delete('.foo', 'a');
    expect(set.size).to.equal(2);

    set.delete('.foo', 'missing');
    expect(set.size).to.equal(2);
  });

  it('removes entries cleanly so subsequent matches do not return them', async () => {
    const set = new SelectorSet<string>();
    set.add('.foo', 'a');
    set.add('.foo', 'b');
    set.delete('.foo', 'a');

    const el = await fixture<HTMLElement>(html`<div class="foo"></div>`);
    const matches = set.matches(el);
    expect(matches.map((m) => m.value)).to.deep.equal(['b']);
  });

  it('indexes a combinator selector by its rightmost compound', async () => {
    const set = new SelectorSet<string>();
    set.add('form button', 'descendant');
    set.add('form > button', 'child');
    set.add('label + button', 'adjacent');
    set.add('label ~ button', 'sibling');
    set.add('form div', 'unrelated');
    const root = await fixture<HTMLElement>(html`<form><label></label><button></button></form>`);
    const button = root.querySelector('button')!;

    const matches = set.matches(button);
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['adjacent', 'child', 'descendant', 'sibling']);
  });

  it('indexes every part of a selector list', async () => {
    const set = new SelectorSet<string>();
    set.add('div, span', 'list');
    set.add('#main, .foo', 'mixed');
    const span = await fixture<HTMLElement>(html`<span class="foo"></span>`);

    const matches = set.matches(span);
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['list', 'mixed']);
  });

  it('returns a selector list entry at most once per element', async () => {
    const set = new SelectorSet<string>();
    set.add('div, .foo, #main', 'list');
    const el = await fixture<HTMLElement>(html`<div id="main" class="foo"></div>`);

    expect(set.matches(el).map((m) => m.value)).to.deep.equal(['list']);
  });

  it('prefers id over class over tag within a compound', async () => {
    const set = new SelectorSet<string>();
    set.add('div.foo#main', 'compound');
    set.add('div.foo', 'class-compound');
    set.add('.other', 'other');
    const el = await fixture<HTMLElement>(html`<div id="main" class="foo"></div>`);

    expect(set.matches(el).map((m) => m.value).sort()).to.deep.equal(['class-compound', 'compound']);
  });

  it('ignores commas and combinators inside brackets, parens, and quotes', async () => {
    const set = new SelectorSet<string>();
    set.add('[data-list="a, b > c"]', 'attr');
    set.add(':is(a, b) > .foo', 'pseudo');
    set.add('.foo:not(.bar, .baz)', 'not');
    set.add('[data-x="#nope"].foo', 'quoted-hash');
    const el = await fixture<HTMLElement>(html`<div class="foo" data-list="a, b > c" data-x="#nope"></div>`);

    const matches = set.matches(el);
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['attr', 'not', 'pseudo', 'quoted-hash']);
  });

  it('falls back when any part of a selector list is not indexable', async () => {
    const set = new SelectorSet<string>();
    set.add('div, [data-x]', 'list');
    const el = await fixture<HTMLElement>(html`<span data-x></span>`);

    expect(set.matches(el).map((m) => m.value)).to.deep.equal(['list']);
  });

  it('deletes combinator and list selectors', async () => {
    const set = new SelectorSet<string>();
    set.add('form button', 'a');
    set.add('div, span', 'b');
    set.delete('form button', 'a');
    set.delete('div, span', 'b');
    expect(set.size).to.equal(0);

    const root = await fixture<HTMLElement>(html`<form><button></button></form>`);
    expect(set.matches(root.querySelector('button')!)).to.deep.equal([]);
    const span = await fixture<HTMLElement>(html`<span></span>`);
    expect(set.matches(span)).to.deep.equal([]);
  });
});
