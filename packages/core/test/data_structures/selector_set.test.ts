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

  it('indexes by attribute and puts pseudo selectors in the fallback bucket', async () => {
    const set = new SelectorSet<string>();
    set.add('[data-foo]', 'attr');
    set.add('[data-bar]', 'unrelated-attr');
    set.add(':is(a, button)', 'pseudo');
    const el = await fixture<HTMLElement>(html`<div data-foo="x"></div>`);

    const matches = set.matches(el);
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['attr', 'pseudo']);
  });

  it('returns candidates from every index and the fallback bucket together', async () => {
    const set = new SelectorSet<string>();
    set.add('#main', 'id');
    set.add('.foo', 'class');
    set.add('div', 'tag');
    set.add('[data-x]', 'attribute');
    set.add(':is(a, div)', 'fallback');
    set.add('#other', 'unrelated-id');
    set.add('span', 'unrelated-tag');
    set.add('[data-y]', 'unrelated-attribute');
    const el = await fixture<HTMLElement>(html`<div id="main" class="foo" data-x></div>`);

    const matches = set.matches(el);
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['attribute', 'class', 'fallback', 'id', 'tag']);
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

  it('prefers id over attribute over class over tag within a compound', async () => {
    const set = new SelectorSet<string>();
    set.add('div.foo[data-x]#main', 'id-compound');
    set.add('div.foo[data-x]', 'attribute-compound');
    set.add('div.foo', 'class-compound');
    set.add('div', 'tag-compound');
    set.add('.other', 'other');
    const el = await fixture<HTMLElement>(html`<div id="main" class="foo" data-x></div>`);

    expect(set.matches(el).map((m) => m.value).sort()).to.deep.equal([
      'attribute-compound',
      'class-compound',
      'id-compound',
      'tag-compound',
    ]);

    // Each one reached through the index it was keyed on, so removing the keys removes the candidates.
    const bare = await fixture<HTMLElement>(html`<section></section>`);
    expect(set.matches(bare)).to.deep.equal([]);
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
    set.add('div, :is(a, span)', 'list');
    const el = await fixture<HTMLElement>(html`<span></span>`);

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

  it('matches ids that need CSS escapes', async () => {
    const set = new SelectorSet<string>();
    set.add(`#${CSS.escape('1foo')}`, 'escaped-id');
    set.add(`.${CSS.escape('a:b')}`, 'escaped-class');
    set.add(`form #${CSS.escape('1foo')}`, 'escaped-descendant');
    const root = await fixture<HTMLElement>(html`<form><div id="1foo" class="a:b"></div></form>`);
    const el = root.querySelector('div')!;

    const matches = set.matches(el).filter((m) => el.matches(m.selector));
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['escaped-class', 'escaped-descendant', 'escaped-id']);
  });

  it('matches selectors whose comments hide a quote from the index', async () => {
    const set = new SelectorSet<string>();
    // The quote inside each comment would make the combinator look quoted, filing the selector under `.fake`.
    const selector = '.fake[data-a=x/*"*/] .real[data-b=y/*"*/]';
    set.add(selector, 'commented');
    const root = await fixture<HTMLElement>(html`<div class="fake" data-a="x"><span class="real" data-b="y"></span></div>`);
    const el = root.querySelector('span')!;
    expect(el.matches(selector)).to.be.true;

    const matches = set.matches(el).filter((m) => el.matches(m.selector));
    expect(matches.map((m) => m.value)).to.deep.equal(['commented']);
  });

  it('matches camel-cased SVG elements by tag', async () => {
    const set = new SelectorSet<string>();
    set.add('svg linearGradient', 'camel');
    set.add('linearGradient', 'bare');
    const root = await fixture<SVGSVGElement>(html`<svg><linearGradient></linearGradient></svg>`);
    const el = root.querySelector('linearGradient')!;
    expect(el.localName).to.equal('linearGradient');

    const matches = set.matches(el).filter((m) => el.matches(m.selector));
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['bare', 'camel']);
  });

  it('treats only CSS whitespace as a descendant combinator', async () => {
    const set = new SelectorSet<string>();
    const nbspClass = 'foo\u00A0bar';
    set.add(`.${CSS.escape(nbspClass)}`, 'nbsp-class');
    set.add('form\n>\tbutton', 'tab-newline');
    set.add(' \f button\r', 'form-feed');
    const root = await fixture<HTMLElement>(html`<form><button class=${nbspClass}></button></form>`);
    const el = root.querySelector('button')!;
    expect(el.classList.contains(nbspClass)).to.be.true;

    const matches = set.matches(el).filter((m) => el.matches(m.selector));
    expect(matches.map((m) => m.value).sort()).to.deep.equal(['form-feed', 'nbsp-class', 'tab-newline']);
  });

  it('indexes an attribute under both the name as written and its lowercase form', async () => {
    const set = new SelectorSet<string>();
    set.add('[data-Case-Watch]', 'html');
    set.add('[viewBox]', 'svg');
    const root = await fixture<HTMLElement>(html`<div><span data-case-watch></span><svg viewBox="0 0 1 1"></svg></div>`);
    const span = root.querySelector('span')!;
    const svg = root.querySelector('svg')!;

    // An HTML element lowercases the attribute it stores; an SVG element keeps the case it was written in.
    expect(set.matches(span).map((m) => m.value)).to.deep.equal(['html']);
    expect(set.matches(svg).map((m) => m.value)).to.deep.equal(['svg']);
  });

  it('leaves a namespaced attribute selector unindexed rather than keying it on a name it does not have', async () => {
    const set = new SelectorSet<string>();
    set.add('[xlink|href]', 'namespaced');
    const el = await fixture<HTMLElement>(html`<div data-x></div>`);

    // It reaches the fallback bucket, so it is still offered as a candidate for every element.
    expect(set.matches(el).map((m) => m.value)).to.deep.equal(['namespaced']);
  });

  describe('queryAll', () => {
    it('returns the descendants matching any indexed selector, never the context itself', async () => {
      const set = new SelectorSet<string>();
      set.add('[data-target]', 'target');
      set.add('.item', 'item');
      const root = await fixture<HTMLElement>(html`
        <div data-target>
          <span data-target id="a"></span><b class="item" id="b"></b><i id="c"></i>
        </div>
      `);

      expect(Array.from(set.queryAll(root)).map((el) => el.id)).to.deep.equal(['a', 'b']);
    });

    it('resolves an anchored selector against the document, so an ancestor outside the context still counts', async () => {
      const set = new SelectorSet<string>();
      set.add('.open .item', 'anchored');
      const root = await fixture<HTMLElement>(html`<div class="open"><section><b class="item" id="a"></b></section></div>`);
      const context = root.querySelector('section')!;

      expect(Array.from(set.queryAll(context)).map((el) => el.id)).to.deep.equal(['a']);
    });

    it('returns nothing when no selector is indexed', async () => {
      const set = new SelectorSet<string>();
      const root = await fixture<HTMLElement>(html`<div><span></span></div>`);

      expect(Array.from(set.queryAll(root))).to.deep.equal([]);
    });

    it('reflects selectors added and removed after an earlier query', async () => {
      const set = new SelectorSet<string>();
      set.add('.item', 'item');
      const root = await fixture<HTMLElement>(html`<div><b class="item" id="a"></b><i data-x id="b"></i></div>`);
      expect(Array.from(set.queryAll(root)).map((el) => el.id)).to.deep.equal(['a']);

      set.add('[data-x]', 'x');
      expect(Array.from(set.queryAll(root)).map((el) => el.id)).to.deep.equal(['a', 'b']);

      set.delete('.item', 'item');
      expect(Array.from(set.queryAll(root)).map((el) => el.id)).to.deep.equal(['b']);
    });
  });

  describe('querySubjects', () => {
    it('finds elements by subject alone, in a detached subtree where the selector cannot match', async () => {
      const set = new SelectorSet<string>();
      set.add('.open .item', 'anchored');
      const root = await fixture<HTMLElement>(html`<div class="open"><section><b class="item" id="a"></b></section></div>`);
      const context = root.querySelector('section')!;
      context.remove();

      expect(Array.from(set.queryAll(context))).to.deep.equal([]);
      expect(Array.from(set.querySubjects(context)).map((el) => el.id)).to.deep.equal(['a']);
    });

    it('returns a superset, since the subject drops everything that narrowed the selector', async () => {
      const set = new SelectorSet<string>();
      set.add('.item:not(.skip)', 'narrowed');
      const root = await fixture<HTMLElement>(html`<div><b class="item" id="a"></b><i class="item skip" id="b"></i></div>`);

      expect(Array.from(set.querySubjects(root)).map((el) => el.id)).to.deep.equal(['a', 'b']);
    });

    it('contributes a subject shared between selectors only once', async () => {
      const set = new SelectorSet<string>();
      set.add('.open .item', 'open');
      set.add('.closed .item', 'closed');
      set.add('.a, .item', 'list');
      const root = await fixture<HTMLElement>(html`<div><b class="item" id="a"></b><i class="a" id="b"></i></div>`);

      // Querying costs more for every part the selector carries, so `.item` must appear in it once, not three times.
      expect(Array.from(set.querySubjects(root)).map((el) => el.id)).to.deep.equal(['a', 'b']);
      expect(set.querySubjects(root)).to.have.lengthOf(2);
    });

    it('degrades to every element when some selector has no queryable subject', async () => {
      const set = new SelectorSet<string>();
      set.add('.item', 'item');
      set.add('.open *', 'universal');
      const root = await fixture<HTMLElement>(html`<div><b class="item" id="a"></b><i id="b"></i></div>`);

      expect(Array.from(set.querySubjects(root)).map((el) => el.id)).to.deep.equal(['a', 'b']);
    });

    it('returns nothing when no selector is indexed', async () => {
      const set = new SelectorSet<string>();
      const root = await fixture<HTMLElement>(html`<div><span></span></div>`);

      expect(Array.from(set.querySubjects(root))).to.deep.equal([]);
    });

    it('stops degrading once the selector without a subject is removed', async () => {
      const set = new SelectorSet<string>();
      set.add('.item', 'item');
      set.add('.open *', 'universal');
      const root = await fixture<HTMLElement>(html`<div><b class="item" id="a"></b><i id="b"></i></div>`);
      expect(Array.from(set.querySubjects(root)).map((el) => el.id)).to.deep.equal(['a', 'b']);

      set.delete('.open *', 'universal');
      expect(Array.from(set.querySubjects(root)).map((el) => el.id)).to.deep.equal(['a']);
    });

    it('keeps a query while another entry still holds the same selector', async () => {
      const set = new SelectorSet<string>();
      set.add('.item', 'first');
      set.add('.item', 'second');
      const root = await fixture<HTMLElement>(html`<div><b class="item" id="a"></b></div>`);
      expect(Array.from(set.querySubjects(root)).map((el) => el.id)).to.deep.equal(['a']);

      set.delete('.item', 'first');
      expect(Array.from(set.querySubjects(root)).map((el) => el.id)).to.deep.equal(['a']);

      set.delete('.item', 'second');
      expect(Array.from(set.querySubjects(root))).to.deep.equal([]);
    });
  });
});
