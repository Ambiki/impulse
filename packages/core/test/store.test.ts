import type { PropertyType } from '../src/decorators/property';
import { expect } from '@open-wc/testing';
import { PROPERTIES, register, registered, TARGETS } from '../src/store';

describe('store', () => {
  it('returns an empty set for a prototype with no registrations', () => {
    class Unregistered {}

    expect(Array.from(registered(Unregistered.prototype, PROPERTIES))).to.deep.equal([]);
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

    const keys = Array.from(registered(Element.prototype, PROPERTIES)).map(({ key }) => key);
    expect(keys).to.deep.equal(['src', 'open']);
  });

  it('keeps registries with different names apart', () => {
    class Element {}
    register(Element.prototype, PROPERTIES, { key: 'src', type: String });
    register(Element.prototype, TARGETS, { key: 'result', multiple: false });

    expect(Array.from(registered(Element.prototype, PROPERTIES))).to.deep.equal([{ key: 'src', type: String }]);
    expect(Array.from(registered(Element.prototype, TARGETS))).to.deep.equal([{ key: 'result', multiple: false }]);
  });

  it('keeps unrelated prototypes apart', () => {
    class First {}
    class Second {}
    register(First.prototype, TARGETS, { key: 'result', multiple: false });

    expect(Array.from(registered(Second.prototype, TARGETS))).to.deep.equal([]);
  });

  it('hides the registry from enumeration of the prototype', () => {
    class Element {}
    register(Element.prototype, PROPERTIES, { key: 'src', type: String });

    // Symbols are skipped by `Object.keys`, so spreading and asking for the symbols is what tells a non-enumerable
    // definition apart from a plain `proto[REGISTRY] = ...` assignment.
    expect(Object.getOwnPropertySymbols({ ...Element.prototype })).to.deep.equal([]);
  });

  it('does not hand out a shared empty set on a miss', () => {
    class First {}
    class Second {}

    const entries = registered(First.prototype, PROPERTIES) as Set<PropertyType>;
    entries.add({ key: 'leaked', type: String });

    expect(Array.from(registered(Second.prototype, PROPERTIES))).to.deep.equal([]);
  });
});
