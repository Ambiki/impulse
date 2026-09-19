import { expect } from '@open-wc/testing';
import SetMap from '../../src/data_structures/set_map';

describe('SetMap', () => {
  describe('add', () => {
    it('creates the set on first use and holds many values under one key', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.add('a', 2);
      map.add('b', 3);

      expect(map.valuesForKey('a')).to.deep.equal([1, 2]);
      expect(map.valuesForKey('b')).to.deep.equal([3]);
    });

    it('does not store the same value twice under one key', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.add('a', 1);

      expect(map.valuesForKey('a')).to.deep.equal([1]);
    });

    it('returns the map so calls chain', () => {
      const map = new SetMap<string, number>();

      expect(map.add('a', 1)).to.equal(map);
      map.add('a', 2).add('b', 3);
      expect(map.keys).to.deep.equal(['a', 'b']);
    });
  });

  describe('delete', () => {
    it('removes the value and reports that it did', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.add('a', 2);

      expect(map.delete('a', 1)).to.be.true;
      expect(map.valuesForKey('a')).to.deep.equal([2]);
    });

    it('drops the key when its last value goes', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.delete('a', 1);

      expect(map.keys).to.deep.equal([]);
      expect(map.get('a')).to.be.undefined;
    });

    it('keeps the key while it still holds a value', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.add('a', 2);
      map.delete('a', 1);

      expect(map.keys).to.deep.equal(['a']);
    });

    it('returns false for a value the key does not hold', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);

      expect(map.delete('a', 2)).to.be.false;
      expect(map.valuesForKey('a')).to.deep.equal([1]);
    });

    it('returns false for an absent key without creating it', () => {
      const map = new SetMap<string, number>();

      expect(map.delete('missing', 1)).to.be.false;
      expect(map.keys).to.deep.equal([]);
      expect(map.get('missing')).to.be.undefined;
    });
  });

  describe('deleteKey', () => {
    it('drops the key and every value under it, reporting that it did', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.add('a', 2);
      map.add('b', 3);

      expect(map.deleteKey('a')).to.be.true;
      expect(map.keys).to.deep.equal(['b']);
      expect(map.valuesForKey('a')).to.deep.equal([]);
    });

    it('returns false for an absent key', () => {
      const map = new SetMap<string, number>();

      expect(map.deleteKey('missing')).to.be.false;
    });
  });

  describe('clear', () => {
    it('empties the map', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.add('b', 2);
      map.clear();

      expect(map.keys).to.deep.equal([]);
      expect(map.values).to.deep.equal([]);
    });
  });

  describe('valuesForKey', () => {
    it('returns an empty array for an absent key', () => {
      const map = new SetMap<string, number>();

      expect(map.valuesForKey('missing')).to.deep.equal([]);
    });

    it('returns a fresh array each call rather than the live set', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);

      const first = map.valuesForKey('a');
      first.push(2);

      expect(map.valuesForKey('a')).to.deep.equal([1]);
    });

    it('is a snapshot, so it is safe to iterate while deleting from the map', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.add('a', 2);
      map.add('a', 3);

      const seen: number[] = [];
      for (const value of map.valuesForKey('a')) {
        seen.push(value);
        map.delete('a', value);
      }

      expect(seen).to.deep.equal([1, 2, 3]);
      expect(map.keys).to.deep.equal([]);
    });
  });

  describe('keys', () => {
    it('returns every key in insertion order', () => {
      const map = new SetMap<string, number>();
      map.add('b', 1);
      map.add('a', 2);

      expect(map.keys).to.deep.equal(['b', 'a']);
    });
  });

  describe('values', () => {
    it('flattens every key in insertion order', () => {
      const map = new SetMap<string, number>();
      map.add('b', 1);
      map.add('a', 2);
      map.add('b', 3);

      expect(map.values).to.deep.equal([1, 3, 2]);
    });

    it('does not deduplicate a value stored under two keys', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.add('b', 1);

      expect(map.values).to.deep.equal([1, 1]);
    });

    it('is empty for an empty map', () => {
      expect(new SetMap<string, number>().values).to.deep.equal([]);
    });
  });

  describe('get', () => {
    it('returns the live set backing the key', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);

      const values = map.get('a')!;
      expect(Array.from(values)).to.deep.equal([1]);

      map.add('a', 2);
      expect(Array.from(values)).to.deep.equal([1, 2]);
    });

    it('returns undefined for an absent key', () => {
      expect(new SetMap<string, number>().get('missing')).to.be.undefined;
    });

    it('bypasses the empty-key cleanup when the set is emptied through it', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);
      map.get('a')!.delete(1);

      expect(map.keys).to.deep.equal(['a']);
      expect(map.valuesForKey('a')).to.deep.equal([]);
    });
  });

  describe('has', () => {
    it('reports whether the value is stored under the key', () => {
      const map = new SetMap<string, number>();
      map.add('a', 1);

      expect(map.has('a', 1)).to.be.true;
      expect(map.has('a', 2)).to.be.false;
      expect(map.has('missing', 1)).to.be.false;
    });
  });
});
