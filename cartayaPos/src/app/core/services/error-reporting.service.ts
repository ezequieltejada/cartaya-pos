import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import * as Sentry from '@sentry/capacitor';
import { parseApiError } from '../utils/api-error';

/**
 * The Sentry client used for reporting. Injected so specs can provide a fake
 * (ES module namespaces cannot be spied on).
 */
export const SENTRY_CLIENT = new InjectionToken<typeof Sentry>('SENTRY_CLIENT', {
  providedIn: 'root',
  factory: () => Sentry,
});

export interface HandledExceptionReport {
  feature: string;
  action: string;
  error: unknown;
  extra?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root',
})
export class ErrorReportingService {
  private readonly sentry = inject(SENTRY_CLIENT);
  private originalConsoleError: typeof console.error | null = null;
  private isConsoleErrorInstalled = false;
  private isForwardingConsoleError = false;

  installConsoleErrorCapture(): void {
    if (this.isConsoleErrorInstalled) {
      return;
    }

    this.originalConsoleError = console.error.bind(console);

    console.error = (...args: unknown[]) => {
      this.originalConsoleError?.(...args);

      if (this.isForwardingConsoleError) {
        return;
      }

      this.isForwardingConsoleError = true;

      try {
        this.captureConsoleError(args);
      } catch {
        // Never let telemetry break application logging paths.
      } finally {
        this.isForwardingConsoleError = false;
      }
    };

    this.isConsoleErrorInstalled = true;
  }

  restoreConsoleError(): void {
    if (!this.isConsoleErrorInstalled || !this.originalConsoleError) {
      return;
    }

    console.error = this.originalConsoleError;
    this.originalConsoleError = null;
    this.isConsoleErrorInstalled = false;
  }

  /**
   * Sends a structured log to Rustrak ("Logs" section, via `Sentry.logger`).
   * Only delivered when `enableLogs` is on (development); otherwise the SDK drops it.
   * Keep `message` static and put variable values in `data` so logs stay searchable.
   */
  captureLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    scope: string,
    message: string,
    data: Record<string, unknown> = {}
  ): void {
    this.sentry.logger[level](`[${scope}] ${message}`, { scope, ...this.logAttributes(data) });
  }

  /** Log attributes must be flat primitives: objects are serialized to JSON strings. */
  private logAttributes(data: Record<string, unknown>): Record<string, string | number | boolean> {
    const attributes: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      attributes[key] =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? value
          : this.serializeForLog(value);
    }
    return attributes;
  }

  private serializeForLog(value: unknown): string {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
    }
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }

  captureHandledException(report: HandledExceptionReport): void {
    const normalizedError = this.normalizeError(report.error);

    this.sentry.withScope((scope) => {
      scope.setLevel('error');
      scope.setTag('handled', 'true');
      scope.setTag('feature', report.feature);
      scope.setTag('action', report.action);
      scope.setContext('handled_exception', {
        feature: report.feature,
        action: report.action,
        ...(report.extra ?? {}),
        ...this.apiErrorContext(report.error),
      });

      this.sentry.captureException(normalizedError);
    });
  }

  private captureConsoleError(args: unknown[]): void {
    const errorArg = args.find((arg): arg is Error => arg instanceof Error);
    const formattedArgs = args.map((arg) => this.serializeForContext(arg));

    this.sentry.withScope((scope) => {
      scope.setLevel('error');
      scope.setTag('source', 'console.error');
      scope.setContext('console_error', {
        arguments: formattedArgs,
      });

      if (errorArg) {
        this.sentry.captureException(errorArg);
        return;
      }

      this.sentry.captureMessage(this.formatConsoleMessage(args));
    });
  }

  private formatConsoleMessage(args: unknown[]): string {
    const message = args
      .map((arg) => this.stringifyArgument(arg))
      .filter((value) => value.length > 0)
      .join(' ')
      .trim();

    return message || 'console.error called with no message';
  }

  /** For API failures report the stable code/status, never the English message. */
  private apiErrorContext(error: unknown): Record<string, unknown> {
    if (!(error instanceof HttpErrorResponse)) {
      return {};
    }
    const { code, params } = parseApiError(error);
    return { statusCode: error.status, code, params };
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const { code } = parseApiError(error);
      return new Error(`HTTP ${error.status} ${code}`);
    }
    if (error instanceof Error) {
      return error;
    }

    return new Error(this.stringifyArgument(error) || 'Unknown handled exception');
  }

  private serializeForContext(value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return value;
    }

    if (value === undefined) {
      return 'undefined';
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }

  private stringifyArgument(value: unknown): string {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value === undefined) {
      return 'undefined';
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}