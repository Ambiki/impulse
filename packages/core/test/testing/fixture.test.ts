import { expect } from '@open-wc/testing';
import { ImpulseElement, isInitialized } from '../../src';
import { fixture } from '../../src/testing';
import { defineImpulseElement, rejectionOf, uniqueTag } from './support';

describe('fixture', () => {
  it('resolves with the first element of the markup, in a container of its own on <body>', async () => {
    const element = await fixture<HTMLParagraphElement>('<p>one</p><p>two</p>');

    expect(element.textContent).to.equal('one');
    const container = element.parentElement!;
    expect(container.localName).to.equal('div');
    expect(container.parentElement).to.equal(document.body);
    expect(Array.from(container.children, (child) => child.textContent)).to.eql(['one', 'two']);
  });

  it('skips the text and comments before the first element', async () => {
    const element = await fixture(`
      <!-- a comment -->
      some text
      <section></section>
    `);

    expect(element.localName).to.equal('section');
  });

  it('gives each fixture a container of its own', async () => {
    const first = await fixture('<p></p>');
    const second = await fixture('<p></p>');

    expect(first.parentElement).not.to.equal(second.parentElement);
  });

  it('resolves once the document is Settled', async () => {
    const outer = defineImpulseElement('fixture-outer');
    const inner = defineImpulseElement('fixture-inner');
    const element = await fixture(`<${outer}><${inner}></${inner}></${outer}>`);

    expect(isInitialized(element)).to.be.true;
    expect(isInitialized(element.firstElementChild!)).to.be.true;
  });

  it('waits for a custom element in the markup to be defined', async () => {
    const tag = uniqueTag('fixture-defined-later');
    setTimeout(() => customElements.define(tag, class extends ImpulseElement {}), 20);

    const element = await fixture(`<${tag}></${tag}>`);
    expect(isInitialized(element)).to.be.true;
  });

  it('rejects at the deadline it is given, naming what it was waiting on', async () => {
    const tag = uniqueTag('fixture-typo');

    const error = await rejectionOf(fixture(`<${tag}></${tag}>`, { timeout: 50 }));
    expect(error.message).to.equal(`Not settled within 50ms: <${tag}> is not defined.`);
  });

  it('rejects markup that holds no element, and leaves the document as it was', async () => {
    const children = document.body.children.length;

    for (const html of ['', '   ', 'only text', '<!-- only a comment -->']) {
      const error = await rejectionOf(fixture(html));
      expect(error.message).to.equal(`fixture() was given markup with no element: ${JSON.stringify(html)}.`);
    }
    expect(document.body.children.length).to.equal(children);
  });

  it('rejects anything but a string', async () => {
    const error = await rejectionOf(fixture({ strings: ['<p></p>'] } as unknown as string));

    expect(error).to.be.instanceOf(TypeError);
    expect(error.message).to.equal('fixture() takes the markup as a string, not object.');
  });
});
