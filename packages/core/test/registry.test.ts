import type { PropertyDeclaration } from '../src/decorators/property';
import { expect } from '@open-wc/testing';
import { PROPERTIES, register, registered, TARGETS } from '../src/registry';

describe('registry', () => {
  it('returns an empty map for a prototype with no registrations', () => {
    class Unregistered {}

    expect(registered(Unregistered.prototype, PROPERTIES).size).to.equal(0);
  });

  it('does not write to a prototype it only reads from', () => {
    class Unregistered {}

    registered(Unregistered.prototype, PROPERTIES);

    expect(Object.getOwnPropertySymbols(Unregistered.prototype)).to.deep.equal([]);
  });

  it('reads back every registered entry', () => {
    class Element {}
    register(Element.prototype, PROPERTIES, { key: 'src', type: String });
    register(Element.prototype, PROPERTIES, { key: 'open', type: Boolean });

    const keys = Array.from(registered(Element.prototype, PROPERTIES).keys());
    expect(keys).to.deep.equal(['src', 'open']);
  });

  it('looks an entry up by its key', () => {
    class Element {}
    register(Element.prototype, TARGETS, { key: 'result', multiple: false });
    register(Element.prototype, TARGETS, { key: 'items', multiple: true });

    expect(registered(Element.prototype, TARGETS).get('items')).to.deep.equal({ key: 'items', multiple: true });
    expect(registered(Element.prototype, TARGETS).get('missing')).to.equal(undefined);
  });

  it('replaces an entry registered again under the same key', () => {
    class Element {}
    register(Element.prototype, PROPERTIES, { key: 'src', type: String });
    register(Element.prototype, PROPERTIES, { key: 'src', type: Number });

    expect(Array.from(registered(Element.prototype, PROPERTIES).values())).to.deep.equal([{ key: 'src', type: Number }]);
  });

  it('keeps registries with different names apart', () => {
    class Element {}
    register(Element.prototype, PROPERTIES, { key: 'src', type: String });
    register(Element.prototype, TARGETS, { key: 'result', multiple: false });

    expect(Array.from(registered(Element.prototype, PROPERTIES).values())).to.deep.equal([{ key: 'src', type: String }]);
    expect(Array.from(registered(Element.prototype, TARGETS).values())).to.deep.equal([{ key: 'result', multiple: false }]);
  });

  it('keeps unrelated prototypes apart', () => {
    class First {}
    class Second {}
    register(First.prototype, TARGETS, { key: 'result', multiple: false });

    expect(registered(Second.prototype, TARGETS).size).to.equal(0);
  });

  it('hides the registry from enumeration of the prototype', () => {
    class Element {}
    register(Element.prototype, PROPERTIES, { key: 'src', type: String });

    // Symbols are skipped by `Object.keys`, so spreading and asking for the symbols is what tells a non-enumerable
    // definition apart from a plain `proto[REGISTRIES] = ...` assignment.
    expect(Object.getOwnPropertySymbols({ ...Element.prototype })).to.deep.equal([]);
  });

  it('does not hand out a shared empty map on a miss', () => {
    class First {}
    class Second {}

    const entries = registered(First.prototype, PROPERTIES) as Map<string, PropertyDeclaration>;
    entries.set('leaked', { key: 'leaked', type: String });

    expect(registered(Second.prototype, PROPERTIES).size).to.equal(0);
  });
});
