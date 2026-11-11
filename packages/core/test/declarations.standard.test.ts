import { expect } from '@open-wc/testing';
import { ImpulseElement, property, target } from '../src';

// Placements only standard decorators can express, so only the standard profiles compile this file.
describe('Declaring a field with standard decorators', () => {
  it('throws for a private field', () => {
    expect(() => {
      class Private extends ImpulseElement {
        // @ts-expect-error A private field can't be read by name.
        @property() #size = 1;

        get size() {
          return this.#size;
        }
      }
      return Private;
    }).to.throw(TypeError, '@property() can only decorate a public instance field, not the private field "#size".');
  });

  it('throws for an auto-accessor', () => {
    expect(() => {
      class Accessor extends ImpulseElement {
        // @ts-expect-error `accessor` fields are not supported yet (#252).
        @target() accessor panel: HTMLElement | null = null;
      }
      return Accessor;
    }).to.throw(TypeError, '@target() can only decorate a public instance field, not the accessor "panel".');
  });

  it('throws when the compiler hands it no metadata', () => {
    const context = {
      kind: 'field',
      name: 'size',
      static: false,
      private: false,
      metadata: undefined,
      access: { has: () => true, get: () => undefined, set: () => {} },
      addInitializer: () => {},
    } as unknown as ClassFieldDecoratorContext<ImpulseElement, number> & { name: string; private: false; static: false };

    expect(() => property()(undefined, context)).to.throw(TypeError, '@property() needs decorator metadata');
  });
});
