import { expect } from '@open-wc/testing';
import Sinon from 'sinon';
import { reportUncaught } from '../../src/helpers/errors';
import { captureReportedErrors } from './capture_reported_errors';

describe('captureReportedErrors', () => {
  let consoleError: Sinon.SinonStub;

  beforeEach(() => {
    // `@web/browser-logs` installs its own `error` listener that funnels every reported error into `console.error`,
    // which the test runner then prints. Stub it so these tests can assert on it without printing anything.
    consoleError = Sinon.stub(console, 'error');
  });

  afterEach(() => {
    consoleError.restore();
  });

  it('keeps a captured error out of the console', () => {
    const errors = captureReportedErrors('captured');
    try {
      reportUncaught(new Error('captured'));
      expect(errors.reported.length).to.eq(1);
      expect(consoleError.called).to.be.false;
    } finally {
      errors.release();
    }
  });

  it('lets an error it does not capture through to the console', () => {
    const errors = captureReportedErrors('captured');
    try {
      console.error(new Error('unrelated'));
      expect(consoleError.calledOnce).to.be.true;
    } finally {
      errors.release();
    }
  });

  it('lets a captured error through when it is logged alongside other context', () => {
    const errors = captureReportedErrors('captured');
    try {
      console.error('while doing the thing:', new Error('captured'));
      expect(consoleError.calledOnce).to.be.true;
    } finally {
      errors.release();
    }
  });

  it('lets a non-error argument through to the console', () => {
    const errors = captureReportedErrors('captured');
    try {
      console.error('captured');
      expect(consoleError.calledOnce).to.be.true;
    } finally {
      errors.release();
    }
  });

  it('restores console.error when released', () => {
    const errors = captureReportedErrors('captured');
    errors.release();
    expect(console.error).to.eq(consoleError);
  });
});
