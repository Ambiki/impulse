import { expect, fixture, html } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, property, registerElement, target, targets, whenInitialized } from '../src';

describe('Declarations of a subclass', () => {
  class BaseInput extends ImpulseElement {
    disabledChanged = Sinon.fake();
    @property({ type: Boolean }) disabled = false;
    @target() label: HTMLElement | null;
    @targets() hints: HTMLElement[];
  }

  @registerElement('declarations-fancy-input')
  class FancyInput extends BaseInput {
    @property() placeholder = '';
  }

  it('observes and reads the properties its superclass declares', async () => {
    const element = await fixture<FancyInput>(html`
      <declarations-fancy-input disabled placeholder="Name"></declarations-fancy-input>
    `);
    await whenInitialized(element);

    expect(FancyInput.observedAttributes).to.have.members(['disabled', 'placeholder']);
    expect(element.disabled).to.be.true;
    expect(element.placeholder).to.eq('Name');

    element.disabled = false;
    expect(element.hasAttribute('disabled')).to.be.false;
    expect(element.disabledChanged.calledOnceWith(false, true)).to.be.true;
  });

  it('holds the targets its superclass declares', async () => {
    const element = await fixture<FancyInput>(html`
      <declarations-fancy-input>
        <label data-target="declarations-fancy-input.label"></label>
        <p data-target="declarations-fancy-input.hints"></p>
        <p data-target="declarations-fancy-input.hints"></p>
      </declarations-fancy-input>
    `);
    await whenInitialized(element);

    expect(element.label).to.eq(element.querySelector('label'));
    expect(element.hints).to.deep.eq(Array.from(element.querySelectorAll('p')));
  });

  it('inherits every Declaration when it declares none of its own', async () => {
    @registerElement('declarations-special-input')
    class SpecialInput extends BaseInput {}

    const element = await fixture<SpecialInput>(html`
      <declarations-special-input disabled>
        <label data-target="declarations-special-input.label"></label>
      </declarations-special-input>
    `);
    await whenInitialized(element);

    expect(SpecialInput.observedAttributes).to.deep.eq(['disabled']);
    expect(element.disabled).to.be.true;
    expect(element.label).to.eq(element.querySelector('label'));
  });

  it('keeps its own Declarations out of its superclass', () => {
    expect(BaseInput.observedAttributes).to.deep.eq(['disabled']);
  });
});

describe('A Declaration a subclass makes again', () => {
  @registerElement('declarations-base-meter')
  class BaseMeter extends ImpulseElement {
    @property() max = '10';
    @property() label = '';
    labelChanged = Sinon.fake();
  }

  @registerElement('declarations-meter')
  class Meter extends BaseMeter {
    // @ts-expect-error The subclass changes the type of the field it declares again.
    @property({ type: Number }) max = 10;
    // @ts-expect-error The subclass changes the type of the field it declares again.
    @target() label: HTMLElement | null;
  }

  it('replaces the inherited Declaration of the same kind', async () => {
    const meter = await fixture<Meter>(html`<declarations-meter max="5"></declarations-meter>`);
    const base = await fixture<BaseMeter>(html`<declarations-base-meter max="5"></declarations-base-meter>`);
    await whenInitialized(meter);
    await whenInitialized(base);

    expect(meter.max).to.equal(5);
    expect(base.max).to.equal('5');
  });

  it('replaces the inherited Declaration of another kind', async () => {
    const meter = await fixture<Meter>(html`
      <declarations-meter label="Volume"><span data-target="declarations-meter.label"></span></declarations-meter>
    `);
    await whenInitialized(meter);

    expect(Meter.observedAttributes).to.deep.eq(['max']);
    expect(meter.label).to.eq(meter.querySelector('span'));
    meter.setAttribute('label', 'Gain');
    expect(meter.labelChanged.called).to.be.false;
    expect(BaseMeter.observedAttributes).to.deep.eq(['max', 'label']);
  });
});

describe('Declaring a field', () => {
  it('throws when one class declares a field twice', () => {
    expect(() => {
      class Twice extends ImpulseElement {
        @property() @target() label: string;
      }
      return Twice;
    }).to.throw(TypeError, 'The field "label" is declared twice in one class.');
  });

  it('throws for a static member', () => {
    expect(() => {
      class Static extends ImpulseElement {
        // @ts-expect-error A static member is not an instance field.
        @property() static size = 1;
      }
      return Static;
    }).to.throw(TypeError, '@property() can only decorate a public instance field, not the static member "size".');
  });

  it('throws for a method', () => {
    expect(() => {
      class Method extends ImpulseElement {
        // @ts-expect-error A method is not a field.
        @target() open() {}
      }
      return Method;
    }).to.throw(TypeError, '@target() can only decorate a public instance field, not the method "open".');
  });

  it('throws for a getter', () => {
    expect(() => {
      class Getter extends ImpulseElement {
        // @ts-expect-error A getter is not a field.
        @targets() get items() {
          return [];
        }
      }
      return Getter;
    }).to.throw(TypeError, '@targets() can only decorate a public instance field, not the accessor "items".');
  });

  it('throws for a field named by a symbol', () => {
    class Symbolic extends ImpulseElement {}

    // Called directly: Babel's legacy decorators reject a computed field name before any decorator runs.
    // @ts-expect-error A Declaration is looked up by a string name.
    expect(() => property()(Symbolic.prototype, Symbol('size'))).to.throw(
      TypeError,
      '@property() can only decorate a public instance field, not the field Symbol(size).',
    );
  });
});
