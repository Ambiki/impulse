import type { PropertyDeclaration } from '../src/decorators/property';
import { expect } from '@open-wc/testing';
import { classMetadata, PROPERTIES, register, registered, TARGETS } from '../src/registry';

const metadataKey = (Symbol as unknown as { metadata: symbol }).metadata;

describe('registry', () => {
  it('defines Symbol.metadata as the symbol the emitters fall back to', () => {
    expect(metadataKey).to.equal(Symbol.for('Symbol.metadata'));
  });

  it('returns an empty map for a class with no Declarations', () => {
    class Unregistered {}

    expect(registered(Unregistered, PROPERTIES).size).to.equal(0);
  });

  it('does not write to a class it only reads from', () => {
    class Unregistered {}

    registered(Unregistered, PROPERTIES);

    expect(Object.getOwnPropertySymbols(Unregistered)).to.deep.equal([]);
  });

  it('reads back every registered entry, in the order registered', () => {
    class Element {}
    register(classMetadata(Element), PROPERTIES, { key: 'src', type: String });
    register(classMetadata(Element), PROPERTIES, { key: 'open', type: Boolean });

    expect(Array.from(registered(Element, PROPERTIES).keys())).to.deep.equal(['src', 'open']);
  });

  it('looks an entry up by its key', () => {
    class Element {}
    register(classMetadata(Element), TARGETS, { key: 'result', multiple: false });
    register(classMetadata(Element), TARGETS, { key: 'items', multiple: true });

    expect(registered(Element, TARGETS).get('items')).to.deep.equal({ key: 'items', multiple: true });
    expect(registered(Element, TARGETS).get('missing')).to.equal(undefined);
  });

  it('throws when a class registers the same field twice', () => {
    class Element {}
    register(classMetadata(Element), PROPERTIES, { key: 'label', type: String });

    expect(() => register(classMetadata(Element), TARGETS, { key: 'label', multiple: false })).to.throw(
      TypeError,
      'The field "label" is declared twice in one class.',
    );
  });

  it('keeps registries with different names apart', () => {
    class Element {}
    register(classMetadata(Element), PROPERTIES, { key: 'src', type: String });
    register(classMetadata(Element), TARGETS, { key: 'result', multiple: false });

    expect(Array.from(registered(Element, PROPERTIES).values())).to.deep.equal([{ key: 'src', type: String }]);
    expect(Array.from(registered(Element, TARGETS).values())).to.deep.equal([{ key: 'result', multiple: false }]);
  });

  it('keeps unrelated classes apart', () => {
    class First {}
    class Second {}
    register(classMetadata(First), TARGETS, { key: 'result', multiple: false });

    expect(registered(Second, TARGETS).size).to.equal(0);
  });

  it('hides the Declarations from enumeration of the metadata', () => {
    class Element {}
    register(classMetadata(Element), PROPERTIES, { key: 'src', type: String });

    expect(Object.getOwnPropertySymbols({ ...classMetadata(Element) })).to.deep.equal([]);
  });

  it('does not hand out a shared empty map on a miss', () => {
    class First {}
    class Second {}

    const entries = registered(First, PROPERTIES) as Map<string, PropertyDeclaration>;
    entries.set('leaked', { key: 'leaked', type: String });

    expect(registered(Second, PROPERTIES).size).to.equal(0);
  });

  describe('a subclass', () => {
    it('reads the entries of the classes it extends', () => {
      class Base {}
      register(classMetadata(Base), PROPERTIES, { key: 'src', type: String });
      class Middle extends Base {}
      class Leaf extends Middle {}
      register(classMetadata(Leaf), PROPERTIES, { key: 'open', type: Boolean });

      expect(Array.from(registered(Middle, PROPERTIES).keys())).to.deep.equal(['src']);
      expect(Array.from(registered(Leaf, PROPERTIES).keys())).to.deep.equal(['src', 'open']);
    });

    it('replaces an inherited entry of the same field, in any registry', () => {
      class Base {}
      register(classMetadata(Base), PROPERTIES, { key: 'src', type: String });
      register(classMetadata(Base), PROPERTIES, { key: 'label', type: String });
      class Child extends Base {}
      register(classMetadata(Child), PROPERTIES, { key: 'src', type: Number });
      register(classMetadata(Child), TARGETS, { key: 'label', multiple: false });

      expect(Array.from(registered(Child, PROPERTIES).values())).to.deep.equal([{ key: 'src', type: Number }]);
      expect(Array.from(registered(Child, TARGETS).values())).to.deep.equal([{ key: 'label', multiple: false }]);
    });

    it('leaves the entries of the classes it extends alone', () => {
      class Base {}
      register(classMetadata(Base), PROPERTIES, { key: 'src', type: String });
      class Child extends Base {}
      register(classMetadata(Child), PROPERTIES, { key: 'src', type: Number });
      register(classMetadata(Child), PROPERTIES, { key: 'open', type: Boolean });

      expect(Array.from(registered(Base, PROPERTIES).values())).to.deep.equal([{ key: 'src', type: String }]);
    });

    it('reads entries made on metadata a standard emitter created', () => {
      class Base {}
      register(classMetadata(Base), PROPERTIES, { key: 'src', type: String });
      class Child extends Base {}
      // What a standard emitter defines on a class once its decorators have run.
      const metadata = Object.create((Base as unknown as Record<symbol, object>)[metadataKey]);
      register(metadata, PROPERTIES, { key: 'open', type: Boolean });
      Object.defineProperty(Child, metadataKey, { value: metadata, enumerable: true, configurable: true, writable: true });

      expect(classMetadata(Child)).to.equal(metadata);
      expect(Array.from(registered(Child, PROPERTIES).keys())).to.deep.equal(['src', 'open']);
    });
  });
});
