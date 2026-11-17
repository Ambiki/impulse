// Jest only. What the testing entry point does when it is imported before the runner has defined `afterEach`, as a
// `setupFiles` script imports it: Jest is the runner that defines its globals after such a script has run, and a
// second copy of the entry point, imported in that state, takes Jest's module registry.

/* global afterEach, beforeEach, describe, expect, it, jest */
const { fixture } = require('@ambiki/impulse/testing');

const NOT_REGISTERED =
  '[impulse] @ambiki/impulse/testing was imported before the test runner defined afterEach (from Jest\'s setupFiles, ' +
  'say), so it did not register cleanup() to run after each test. Import it from a test file or from ' +
  'setupFilesAfterEnv instead.';

/** Runs `callback` while the runner has no `afterEach`, which is put back afterwards. */
function withoutAfterEach(callback) {
  const { afterEach } = globalThis;
  delete globalThis.afterEach;
  const restore = () => {
    globalThis.afterEach = afterEach;
  };
  let result;
  try {
    result = callback();
  } catch (error) {
    restore();
    throw error;
  }
  return result instanceof Promise ? result.finally(restore) : (restore(), result);
}

/** A copy of the entry point of its own, imported while the runner has no `afterEach`. */
function importBeforeAfterEach() {
  return withoutAfterEach(() => {
    let testing;
    jest.isolateModules(() => {
      testing = require('@ambiki/impulse/testing');
    });
    return testing;
  });
}

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('the testing entry point, imported before the runner has `afterEach`', () => {
  it('warns, from the first fixture only, that it did not register `cleanup()`', async () => {
    const testing = importBeforeAfterEach();

    try {
      await testing.fixture('<p></p>');
      await testing.fixture('<p></p>');
    } finally {
      testing.cleanup();
    }
    expect(warn.mock.calls).toEqual([[NOT_REGISTERED]]);
  });

  it('says nothing to a runner that has no `afterEach` at all', async () => {
    const testing = importBeforeAfterEach();

    try {
      await withoutAfterEach(() => testing.fixture('<p></p>'));
    } finally {
      testing.cleanup();
    }
    expect(warn.mock.calls).toEqual([]);
  });
});

describe('the testing entry point, imported once the runner has `afterEach`', () => {
  it('says nothing', async () => {
    await fixture('<p></p>');

    expect(warn.mock.calls).toEqual([]);
  });
});
