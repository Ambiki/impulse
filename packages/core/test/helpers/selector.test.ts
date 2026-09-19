import { expect } from '@open-wc/testing';
import { selectorAttributes, subjectSelectors } from '../../src/helpers/selector';

describe('selectorAttributes', () => {
  it('returns the attribute an attribute selector names', () => {
    expect(selectorAttributes('[data-action]')).to.deep.equal(['data-action']);
  });

  it('returns class for a class selector and id for an id selector', () => {
    expect(selectorAttributes('.menu')).to.deep.equal(['class']);
    expect(selectorAttributes('#main')).to.deep.equal(['id']);
  });

  it('returns nothing for a type or universal selector, since no attribute can change them', () => {
    expect(selectorAttributes('button')).to.deep.equal([]);
    expect(selectorAttributes('my-element')).to.deep.equal([]);
    expect(selectorAttributes('*')).to.deep.equal([]);
  });

  it('returns every attribute a compound names, once each', () => {
    expect(selectorAttributes('input.a.b#c[type=checkbox][data-x="y]" i]')).to.have.members([
      'class',
      'id',
      'type',
      'data-x',
    ]);
  });

  it('returns the attributes of every part of a selector list', () => {
    expect(selectorAttributes('button, .menu, [data-toggle="tooltip"]')).to.have.members([
      'class',
      'data-toggle',
    ]);
  });

  it('reads every attribute selector operator', () => {
    for (const operator of ['=', '~=', '|=', '^=', '$=', '*=']) {
      expect(selectorAttributes(`[data-x${operator}"v"]`)).to.deep.equal(['data-x']);
    }
    expect(selectorAttributes('[ data-x = v s ]')).to.deep.equal(['data-x']);
  });

  it('returns an attribute name as written and lowercased, since HTML lowercases names but SVG keeps their case', () => {
    expect(selectorAttributes('[viewBox]')).to.have.members(['viewBox', 'viewbox']);
    expect(selectorAttributes('[DATA-ACTION]')).to.have.members(['DATA-ACTION', 'data-action']);
  });

  it('reads through :is(), :where(), and :not() whose arguments are self-contained', () => {
    expect(selectorAttributes(':not(.a)')).to.deep.equal(['class']);
    expect(selectorAttributes(':where(#main)')).to.deep.equal(['id']);
    expect(selectorAttributes('button:is(.a, [data-x])')).to.have.members(['class', 'data-x']);
    expect(selectorAttributes('div:not(:is([hidden], .b))')).to.have.members(['hidden', 'class']);
    expect(selectorAttributes('div:NOT( .a )')).to.deep.equal(['class']);
  });

  describe('selectors not read as self-contained', () => {
    it('rejects :is(), :where(), and :not() whose arguments are not self-contained', () => {
      for (const selector of [':is(.a .b)', ':not(:hover)', 'div:where(.a, li:first-child)', ':is()']) {
        expect(selectorAttributes(selector), selector).to.be.null;
      }
    });

    it('rejects every combinator, since an ancestor or sibling can change the match', () => {
      for (const selector of ['.open .item', 'ul > li', 'h1 + p', 'h1 ~ p', 'form button']) {
        expect(selectorAttributes(selector), selector).to.be.null;
      }
    });

    it('rejects pseudo-classes that element state, structure, or ancestors decide', () => {
      for (const selector of [
        'input:focus',
        'a:hover',
        'input:checked',
        'button:disabled',
        'li:first-child',
        'div:empty',
        'p:lang(en)',
        'my-element:defined',
        'li:nth-child(2 of .a)',
        'div:has(> .a)',
      ]) {
        expect(selectorAttributes(selector), selector).to.be.null;
      }
    });

    it('rejects pseudo-elements', () => {
      expect(selectorAttributes('p::before')).to.be.null;
    });

    it('rejects the whole list when one part is not self-contained', () => {
      expect(selectorAttributes('[data-x], .open .item')).to.be.null;
    });

    it('rejects escapes, namespaces, and nesting it does not read', () => {
      for (const selector of [
        '.a\\:b',
        '#\\31 foo',
        '[data-x="a\\"b"]',
        'svg|rect',
        '*|*',
        '[xlink|href]',
        '[*|href]',
        '[|href]',
        '& .a',
      ]) {
        expect(selectorAttributes(selector), selector).to.be.null;
      }
    });

    it('rejects comments, which can hide a quote and so a combinator from the scanner', () => {
      expect(selectorAttributes('[data-x=a/*"*/] .open .item[data-y=b/*"*/]')).to.be.null;
      expect(selectorAttributes('.a/* comment */')).to.be.null;
    });

    it('rejects malformed and empty selectors', () => {
      for (const selector of ['[data-x', 'div)', '.', '#', '', ',']) {
        expect(selectorAttributes(selector), JSON.stringify(selector)).to.be.null;
      }
    });
  });
});

describe('subjectSelectors', () => {
  it('returns a single compound selector unchanged', () => {
    expect(subjectSelectors('[data-action]')).to.deep.equal(['[data-action]']);
    expect(subjectSelectors('.menu')).to.deep.equal(['.menu']);
    expect(subjectSelectors('#main')).to.deep.equal(['#main']);
    expect(subjectSelectors('my-element')).to.deep.equal(['my-element']);
  });

  it('returns only the rightmost compound of a complex selector', () => {
    expect(subjectSelectors('.button > a')).to.deep.equal(['a']);
    expect(subjectSelectors('.open .item')).to.deep.equal(['.item']);
    expect(subjectSelectors('label + button')).to.deep.equal(['button']);
    expect(subjectSelectors('label ~ button')).to.deep.equal(['button']);
  });

  it('keeps every simple selector of the subject compound', () => {
    expect(subjectSelectors('form input.a#b[type=checkbox]')).to.deep.equal(['input.a#b[type=checkbox]']);
  });

  it('drops pseudo-classes and pseudo-elements, since the result only has to be a superset', () => {
    expect(subjectSelectors('.open .item:hover')).to.deep.equal(['.item']);
    expect(subjectSelectors('a:has(img)')).to.deep.equal(['a']);
    expect(subjectSelectors('li:nth-child(2)')).to.deep.equal(['li']);
    expect(subjectSelectors('.foo:not(.bar, .baz)')).to.deep.equal(['.foo']);
    expect(subjectSelectors('p::before')).to.deep.equal(['p']);
  });

  it('maps every part of a selector list', () => {
    expect(subjectSelectors('.a, .b .c')).to.deep.equal(['.a', '.c']);
    expect(subjectSelectors('div, span')).to.deep.equal(['div', 'span']);
  });

  it('returns null when a subject has nothing to query on', () => {
    expect(subjectSelectors('*')).to.equal(null);
    expect(subjectSelectors('.open *')).to.equal(null);
    expect(subjectSelectors(':is(a, button)')).to.equal(null);
    expect(subjectSelectors('.a, *')).to.equal(null);
  });

  it('returns null for syntax the scanner cannot read, rather than a selector that means something else', () => {
    // `CSS.escape('1foo')` ends in a space, which the scanner would read as a descendant combinator.
    expect(subjectSelectors(`.${CSS.escape('1foo')}`)).to.equal(null);
    expect(subjectSelectors('.fake[data-a=x/*"*/] .real')).to.equal(null);
    expect(subjectSelectors('[data-x="unclosed')).to.equal(null);
  });

  it('ignores combinators inside brackets, parens, and quotes', () => {
    expect(subjectSelectors('[data-list="a, b > c"]')).to.deep.equal(['[data-list="a, b > c"]']);
    expect(subjectSelectors(':is(a, b) > .foo')).to.deep.equal(['.foo']);
  });
});
