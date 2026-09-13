import { expect } from '@open-wc/testing';
import { parseTargetDescriptor } from '../src/target_descriptor';

describe('Target descriptor', () => {
  it('parses the identifier and key', () => {
    expect(parseTargetDescriptor('element-name.panel')).to.eql({ identifier: 'element-name', key: 'panel' });
  });

  it('leaves the key undefined when the descriptor has no dot', () => {
    expect(parseTargetDescriptor('element-name')).to.eql({ identifier: 'element-name', key: undefined });
  });

  it('keeps only the first two segments', () => {
    expect(parseTargetDescriptor('element-name.panel.extra')).to.eql({ identifier: 'element-name', key: 'panel' });
  });

  it('returns an empty identifier when the descriptor starts with a dot', () => {
    expect(parseTargetDescriptor('.panel')).to.eql({ identifier: '', key: 'panel' });
  });
});
