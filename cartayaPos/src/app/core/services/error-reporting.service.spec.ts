import { TestBed } from '@angular/core/testing';
import * as Sentry from '@sentry/capacitor';

import { ErrorReportingService } from './error-reporting.service';

function mockWithScope(
  first: unknown,
  second?: unknown
): unknown {
  const callback = typeof first === 'function'
    ? first as (scope: {
        setLevel: () => void;
        setTag: () => void;
        setContext: () => void;
      }) => unknown
    : second as (scope: {
        setLevel: () => void;
        setTag: () => void;
        setContext: () => void;
      }) => unknown;

  return callback({
    setLevel: () => undefined,
    setTag: () => undefined,
    setContext: () => undefined,
  });
}

describe('ErrorReportingService', () => {
  let service: ErrorReportingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorReportingService);
  });

  afterEach(() => {
    service.restoreConsoleError();
  });

  it('should forward console.error messages to Sentry and preserve console output', () => {
    const originalConsoleErrorSpy = spyOn(console, 'error').and.callFake(() => undefined);
    const captureMessageSpy = spyOn(Sentry, 'captureMessage');
    const withScopeSpy = spyOn(Sentry, 'withScope').and.callFake(mockWithScope as typeof Sentry.withScope);

    service.installConsoleErrorCapture();
    console.error('Order submission failed', { orderId: '123' });

    expect(originalConsoleErrorSpy).toHaveBeenCalledWith('Order submission failed', { orderId: '123' });
    expect(withScopeSpy).toHaveBeenCalled();
    expect(captureMessageSpy).toHaveBeenCalledWith('Order submission failed {"orderId":"123"}');
  });

  it('should forward Error instances from console.error as exceptions', () => {
    const captureExceptionSpy = spyOn(Sentry, 'captureException');
    spyOn(Sentry, 'withScope').and.callFake(mockWithScope as typeof Sentry.withScope);
    spyOn(console, 'error').and.callFake(() => undefined);

    const error = new Error('Printer offline');

    service.installConsoleErrorCapture();
    console.error('Print failed', error);

    expect(captureExceptionSpy).toHaveBeenCalledWith(error);
  });

  it('should capture handled exceptions with normalized errors', () => {
    const captureExceptionSpy = spyOn(Sentry, 'captureException');
    spyOn(Sentry, 'withScope').and.callFake(mockWithScope as typeof Sentry.withScope);

    service.captureHandledException({
      feature: 'order-summary',
      action: 'submit-order',
      error: 'API Error',
      extra: {
        posId: 'pos-1',
      },
    });

    expect(captureExceptionSpy).toHaveBeenCalledWith(jasmine.any(Error));
    expect((captureExceptionSpy.calls.mostRecent().args[0] as Error).message).toBe('API Error');
  });
});