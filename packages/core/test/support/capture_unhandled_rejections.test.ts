import { expect } from '@open-wc/testing';
import Sinon from 'sinon';
import { captureUnhandledRejections } from './capture_unhandled_rejections';

describe('captureUnhandledRejections', () => {
  const OUTSIDE_A_TEST = 'An error was thrown in a Promise outside a test. Did you forget to await a function or assertion?';
  let consoleError: Sinon.SinonStub;

  beforeEach(() => {
    // Stubbed so these tests can assert on what reaches the console without printing anything.
    consoleError = Sinon.stub(console, 'error');
  });

  afterEach(() => {
    consoleError.restore();
  });

  it('captures a matching rejection and keeps the test runner\'s report of it out of the console', async () => {
    const rejections = captureUnhandledRejections('captured');
    try {
      void Promise.reject(new Error('captured'));
      await rejections.caught();
      expect(rejections.rejected.map((error) => error.message)).to.deep.equal(['captured']);
      expect(consoleError.called).to.be.false;
    } finally {
      rejections.release();
    }
  });

  it('lets the report of a rejection it does not capture through to the console', () => {
    const rejections = captureUnhandledRejections('captured');
    const unrelated = new Error('unrelated');
    try {
      console.error(OUTSIDE_A_TEST);
      console.error(unrelated);
      expect(consoleError.args).to.deep.equal([[OUTSIDE_A_TEST], [unrelated]]);
    } finally {
      rejections.release();
    }
  });

  it('lets a line it held through on release when no error follows it', () => {
    const rejections = captureUnhandledRejections('captured');
    console.error(OUTSIDE_A_TEST);
    rejections.release();
    expect(consoleError.args).to.deep.equal([[OUTSIDE_A_TEST]]);
  });
});
