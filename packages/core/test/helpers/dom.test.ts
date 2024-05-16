import { expect, fixture, html } from '@open-wc/testing';
import { getAttributeValues } from '../../src/helpers/dom';

it('getAttributeValues', async () => {
  const el = await fixture(html`<div data-action="foo bar"></div>`);

  expect(getAttributeValues(el, 'data-action')).to.eql(['foo', 'bar']);
  expect(getAttributeValues(el, 'invalid')).to.eql([]);
});
