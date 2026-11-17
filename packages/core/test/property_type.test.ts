import type { PropertyType } from '../src';
import { expect } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, property, registerElement, whenInitialized } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';

/** The Date Type the Properties reference documents: a full ISO 8601 timestamp. */
const dateType = {
  fromAttribute(attribute) {
    const date = new Date(attribute);
    return Number.isNaN(date.getTime()) ? undefined : date;
  },
  toAttribute: (date) => date.toISOString(),
} satisfies PropertyType<Date>;

/** Appends a new `tagName` to the document and waits for it to initialize. */
async function connect<T extends ImpulseElement>(tagName: string, attributes: Record<string, string> = {}) {
  const element = document.createElement(tagName) as T;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  await whenInitialized(element);
  return element;
}

describe('@property() with a custom Type', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('should read the attribute through the Type', async () => {
    @registerElement('property-type-read-test')
    class ReadTest extends ImpulseElement {
      @property({ type: dateType }) publishedAt: Date | null;
    }

    const element = await connect<ReadTest>('property-type-read-test', { 'published-at': '2026-11-17T10:00:00.000Z' });

    expect(element.publishedAt).to.be.an.instanceOf(Date);
    expect(element.publishedAt!.getTime()).to.equal(Date.UTC(2026, 10, 17, 10));
  });

  it('should write an assigned value through the Type, and remove the attribute when the Type writes null', async () => {
    // Leaves zero off the element, as a Boolean leaves `false`, since a missing attribute reads the Default of zero.
    const countType = {
      fromAttribute: (attribute) => Number(attribute),
      toAttribute: (count) => (count === 0 ? null : String(count)),
    } satisfies PropertyType<number>;

    @registerElement('property-type-write-test')
    class WriteTest extends ImpulseElement {
      @property({ type: dateType }) publishedAt: Date | null;
      @property({ type: countType }) count = 0;
    }

    const element = await connect<WriteTest>('property-type-write-test');
    element.publishedAt = new Date(Date.UTC(2026, 10, 17, 10));
    element.count = 3;
    expect(element.getAttribute('published-at')).to.equal('2026-11-17T10:00:00.000Z');
    expect(element.getAttribute('count')).to.equal('3');

    element.count = 0;
    expect(element.hasAttribute('count')).to.be.false;
    expect(element.count).to.equal(0);
  });

  it('should read a null Default when the field has no initializer and the Type names no Empty value', async () => {
    @registerElement('property-type-null-test')
    class NullTest extends ImpulseElement {
      @property({ type: dateType }) publishedAt: Date | null;
      @property({ type: dateType }) archivedAt: Date | null = null;
    }

    const element = await connect<NullTest>('property-type-null-test');
    expect(element.publishedAt).to.be.null;
    expect(element.archivedAt).to.be.null;

    element.setAttribute('published-at', 'not a date');
    expect(element.publishedAt).to.be.null;
  });

  it('should read a fresh copy of the Empty value a Type names', async () => {
    const tokensType = {
      fromAttribute: (attribute) => new Set(attribute.split(/\s+/).filter(Boolean)),
      toAttribute: (tokens) => Array.from(tokens).join(' '),
      emptyValue: new Set<string>(),
    } satisfies PropertyType<Set<string>>;

    @registerElement('property-type-empty-test')
    class EmptyTest extends ImpulseElement {
      @property({ type: tokensType }) tags: Set<string>;
    }

    const element = await connect<EmptyTest>('property-type-empty-test');
    expect(element.tags).to.be.an.instanceOf(Set);
    expect(element.tags.size).to.equal(0);

    element.tags.add('urgent');
    expect(element.tags.size).to.equal(0);
    expect(tokensType.emptyValue.size).to.equal(0);
  });

  it('should read the Default as the attribute holding it would read, so mutating it changes nothing', async () => {
    @registerElement('property-type-default-test')
    class DefaultTest extends ImpulseElement {
      @property({ type: dateType }) publishedAt = new Date(Date.UTC(2026, 0, 1));
    }

    const element = await connect<DefaultTest>('property-type-default-test');
    element.publishedAt.setUTCFullYear(2000);
    expect(element.publishedAt.getTime()).to.equal(Date.UTC(2026, 0, 1));
    expect(element.hasAttribute('published-at')).to.be.false;

    element.setAttribute('published-at', 'not a date');
    expect(element.publishedAt.getTime()).to.equal(Date.UTC(2026, 0, 1));
  });

  it('should report a change only when the new value writes a different attribute, when the Type has no isEqual', async () => {
    @registerElement('property-type-change-test')
    class ChangeTest extends ImpulseElement {
      publishedAtChanged = Sinon.fake();
      @property({ type: dateType }) publishedAt = new Date(Date.UTC(2026, 0, 1));
    }

    const element = await connect<ChangeTest>('property-type-change-test', {
      'published-at': '2026-11-17T10:00:00.000Z',
    });

    // The same instant, written another way.
    element.setAttribute('published-at', '2026-11-17T14:00:00+04:00');
    expect(element.publishedAtChanged.called).to.be.false;

    element.setAttribute('published-at', '2026-11-18T10:00:00.000Z');
    expect(element.publishedAtChanged.calledOnce).to.be.true;
    const [newValue, oldValue] = element.publishedAtChanged.firstCall.args as [Date, Date];
    expect(newValue.getTime()).to.equal(Date.UTC(2026, 10, 18, 10));
    expect(oldValue.getTime()).to.equal(Date.UTC(2026, 10, 17, 10));
  });

  it('should compare with the Type\'s isEqual, and decide itself when either value is null', async () => {
    // Compares calendar days, ignoring the time of day.
    const dayType = {
      ...dateType,
      isEqual(left, right) {
        if (left === null || right === null) throw new TypeError('isEqual was handed null.');
        return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
      },
    } satisfies PropertyType<Date>;

    @registerElement('property-type-is-equal-test')
    class IsEqualTest extends ImpulseElement {
      dueAtChanged = Sinon.fake();
      @property({ type: dayType }) dueAt: Date | null;
    }

    const element = await connect<IsEqualTest>('property-type-is-equal-test');

    element.setAttribute('due-at', '2026-11-17T10:00:00.000Z');
    expect(element.dueAtChanged.callCount).to.equal(1);
    expect(element.dueAtChanged.firstCall.args[1]).to.be.null;

    element.setAttribute('due-at', '2026-11-17T18:00:00.000Z');
    expect(element.dueAtChanged.callCount).to.equal(1);

    element.removeAttribute('due-at');
    expect(element.dueAtChanged.callCount).to.equal(2);
    expect(element.dueAtChanged.secondCall.args[0]).to.be.null;

    element.setAttribute('due-at', 'not a date');
    expect(element.dueAtChanged.callCount).to.equal(2);
  });

  it('should let an error the Type throws reach whoever read or wrote the property', async () => {
    const strictType = {
      fromAttribute: () => {
        throw new SyntaxError('Unreadable.');
      },
      toAttribute: () => {
        throw new RangeError('Unwritable.');
      },
    } satisfies PropertyType<string>;

    @registerElement('property-type-throw-test')
    class ThrowTest extends ImpulseElement {
      @property({ type: strictType }) code: string | null;
    }

    const element = await connect<ThrowTest>('property-type-throw-test', { code: 'x' });
    expect(() => element.code).to.throw(SyntaxError, 'Unreadable.');
    expect(() => {
      element.code = 'y';
    }).to.throw(RangeError, 'Unwritable.');
    expect(element.getAttribute('code')).to.equal('x');
  });

  it('should throw rather than hand out an Empty value its Type cannot write and read back', async () => {
    // Writes an empty Set as no attribute, so its Empty value, shared by every element, never survives the trip.
    const sparseTokensType = {
      fromAttribute: (attribute) => new Set(attribute.split(/\s+/).filter(Boolean)),
      toAttribute: (tokens) => (tokens.size ? Array.from(tokens).join(' ') : null),
      emptyValue: new Set<string>(),
    } satisfies PropertyType<Set<string>>;

    @registerElement('property-type-sparse-empty-test')
    class SparseEmptyTest extends ImpulseElement {
      @property({ type: sparseTokensType }) tags: Set<string>;
    }

    const element = await connect<SparseEmptyTest>('property-type-sparse-empty-test');
    expect(() => element.tags).to.throw(TypeError, '@property() on the field "tags" cannot read its Default');

    element.setAttribute('tags', 'news');
    expect(Array.from(element.tags)).to.deep.equal(['news']);
  });

  it('should report an error the Type throws as the attribute changes, and still run the other fields\' callbacks', async () => {
    const strictType = {
      fromAttribute: () => {
        throw new SyntaxError('Unreadable foo-url.');
      },
      toAttribute: String,
    } satisfies PropertyType<string>;

    @registerElement('property-type-shared-attribute-test')
    class SharedAttributeTest extends ImpulseElement {
      fooURLChanged = Sinon.fake();
      fooUrlChanged = Sinon.fake();
      @property({ type: strictType }) fooURL: string | null;
      @property() fooUrl: string;
    }

    const element = await connect<SharedAttributeTest>('property-type-shared-attribute-test');
    const { reported, release } = captureReportedErrors('Unreadable foo-url.');
    try {
      element.setAttribute('foo-url', 'a');
    } finally {
      release();
    }

    expect(reported.map((error) => error.message)).to.deep.equal(['Unreadable foo-url.']);
    expect(element.fooURLChanged.called).to.be.false;
    expect(element.fooUrlChanged.calledOnceWith('a', '')).to.be.true;
  });
});

describe('@property() with a type that is not a Type', () => {
  it('should throw for a constructor that is not built in', () => {
    expect(() => {
      class DateTest extends ImpulseElement {
        // @ts-expect-error Date has no built-in Type.
        @property({ type: Date }) publishedAt: Date;
      }
      return DateTest;
    }).to.throw(
      TypeError,
      '@property() on the field "publishedAt" takes a built-in Type (String, Number, Boolean, Array, or Object) or a ' +
      'Type with fromAttribute and toAttribute functions, not Date.',
    );
  });

  it('should throw for an object without fromAttribute and toAttribute functions', () => {
    expect(() => {
      class HalfTest extends ImpulseElement {
        // @ts-expect-error A Type writes as well as reads.
        @property({ type: { fromAttribute: String } }) code: string;
      }
      return HalfTest;
    }).to.throw(TypeError, 'or a Type with fromAttribute and toAttribute functions, not an object without both.');
  });

  it('should throw for null', () => {
    expect(() => {
      class NullTest extends ImpulseElement {
        // @ts-expect-error `null` is not a type.
        @property({ type: null }) code: string;
      }
      return NullTest;
    }).to.throw(TypeError, 'or a Type with fromAttribute and toAttribute functions, not null.');
  });

  it('should throw for a Type whose isEqual is not a function', () => {
    expect(() => {
      class IsEqualTest extends ImpulseElement {
        // @ts-expect-error isEqual is a function.
        @property({ type: { ...dateType, isEqual: true } }) publishedAt: Date;
      }
      return IsEqualTest;
    }).to.throw(
      TypeError,
      '@property() on the field "publishedAt" takes a Type whose isEqual, if it has one, is a function, not true.',
    );
  });
});
