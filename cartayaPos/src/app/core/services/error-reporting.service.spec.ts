import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import type * as SentryNs from '@sentry/capacitor';

import { ErrorReportingService, SENTRY_CLIENT } from './error-reporting.service';

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
  let Sentry: {
    captureMessage: jasmine.Spy;
    captureException: jasmine.Spy;
    withScope: jasmine.Spy;
  };

  beforeEach(() => {
    Sentry = {
      captureMessage: jasmine.createSpy('captureMessage'),
      captureException: jasmine.createSpy('captureException'),
      withScope: jasmine.createSpy('withScope').and.callFake(mockWithScope),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SENTRY_CLIENT, useValue: Sentry as unknown as typeof SentryNs }],
    });
    service = TestBed.inject(ErrorReportingService);
  });

  afterEach(() => {
    service.restoreConsoleError();
  });

  it('should forward console.error messages to Sentry and preserve console output', () => {
    const originalConsoleErrorSpy = spyOn(console, 'error').and.callFake(() => undefined);
    const captureMessageSpy = Sentry.captureMessage;
    const withScopeSpy = Sentry.withScope;

    service.installConsoleErrorCapture();
    console.error('Order submission failed', { orderId: '123' });

    expect(originalConsoleErrorSpy).toHaveBeenCalledWith('Order submission failed', { orderId: '123' });
    expect(withScopeSpy).toHaveBeenCalled();
    expect(captureMessageSpy).toHaveBeenCalledWith('Order submission failed {"orderId":"123"}');
  });

  it('should forward Error instances from console.error as exceptions', () => {
    const captureExceptionSpy = Sentry.captureException;
    spyOn(console, 'error').and.callFake(() => undefined);

    const error = new Error('Printer offline');

    service.installConsoleErrorCapture();
    console.error('Print failed', error);

    expect(captureExceptionSpy).toHaveBeenCalledWith(error);
  });

  it('should capture handled exceptions with normalized errors', () => {
    const captureExceptionSpy = Sentry.captureException;

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

  it('should report HTTP errors by status and code, never the English message', () => {
    const scope = { setLevel: jasmine.createSpy(), setTag: jasmine.createSpy(), setContext: jasmine.createSpy() };
    Sentry.withScope.and.callFake((cb: (s: typeof scope) => void) => cb(scope));

    service.captureHandledException({
      feature: 'order-summary',
      action: 'submit-order',
      error: new HttpErrorResponse({
        status: 403,
        error: { code: 'POS_NOT_ASSIGNED', message: 'English text' },
      }),
    });

    expect((Sentry.captureException.calls.mostRecent().args[0] as Error).message).toBe('HTTP 403 POS_NOT_ASSIGNED');
    expect(scope.setContext).toHaveBeenCalledWith(
      'handled_exception',
      jasmine.objectContaining({ statusCode: 403, code: 'POS_NOT_ASSIGNED' })
    );
  });
});
