import { expect } from '@open-wc/testing';
import { camelize, dasherize, decamelize, parseJSON } from '../../src/helpers/string';

it('camelize', () => {
  expect(camelize('innerHTML')).to.eq('innerHTML');
  expect(camelize('action_name')).to.eq('actionName');
  expect(camelize('css-class-name')).to.eq('cssClassName');
  expect(camelize('my favorite items')).to.eq('myFavoriteItems');
  expect(camelize('My Favorite Items')).to.eq('myFavoriteItems');
  expect(camelize('private-docs/owner-invoice')).to.eq('privateDocs/ownerInvoice');
});

it('dasherize', () => {
  expect(dasherize('innerHTML')).to.eq('inner-html');
  expect(dasherize('action_name')).to.eq('action-name');
});

it('decamelize', () => {
  expect(decamelize('innerHTML')).to.eq('inner_html');
  expect(decamelize('actionName')).to.eq('action_name');
});

it('parseJSON', () => {
  expect(parseJSON('[]')).to.eql([]);
  expect(parseJSON(undefined)).to.eq('');
  expect(parseJSON(undefined, 'apple')).to.eq('apple');
  expect(parseJSON(JSON.stringify({ foo: 'bar' }))).to.eql({ foo: 'bar' });
});
