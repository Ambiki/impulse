import { expect } from '@open-wc/testing';
import Sinon from 'sinon';
import { invokeReporting, reportUncaught } from '../../src/helpers/errors';
import { captureReportedErrors } from '../support/capture_reported_errors';

describe('reportUncaught', () => {
  it('reports the error through window.onerror without throwing', () => {
    const errors = captureReportedErrors('reported');
    try {
      expect(() => reportUncaught(new Error('reported'))).not.to.throw();
      expect(errors.reported.length).to.eq(1);
    } finally {
      errors.release();
    }
  });

  it('falls back to rethrowing from a fresh task when reportError is unavailable', async () => {
    const errors = captureReportedErrors('reported later');
    const original = window.reportError;
    try {
      (window as { reportError?: typeof reportError }).reportError = undefined;
      reportUncaught(new Error('reported later'));
      expect(errors.reported.length).to.eq(0);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(errors.reported.length).to.eq(1);
    } finally {
      window.reportError = original;
      errors.release();
    }
  });
});

describe('invokeReporting', () => {
  it('runs the callback', () => {
    const callback = Sinon.spy();
    invokeReporting(callback);
    expect(callback.calledOnce).to.be.true;
  });

  it('reports a thrown error instead of propagating it', () => {
    const errors = captureReportedErrors('callback failed');
    try {
      expect(() =>
        invokeReporting(() => {
          throw new Error('callback failed');
        }),
      ).not.to.throw();
      expect(errors.reported.length).to.eq(1);
    } finally {
      errors.release();
    }
  });
});
