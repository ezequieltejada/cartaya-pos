import { Injectable } from '@angular/core';
import * as Sentry from '@sentry/capacitor';

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

  captureHandledException(report: HandledExceptionReport): void {
    const normalizedError = this.normalizeError(report.error);

    Sentry.withScope((scope) => {
      scope.setLevel('error');
      scope.setTag('handled', 'true');
      scope.setTag('feature', report.feature);
      scope.setTag('action', report.action);
      scope.setContext('handled_exception', {
        feature: report.feature,
        action: report.action,
        ...(report.extra ?? {}),
      });

      Sentry.captureException(normalizedError);
    });
  }

  private captureConsoleError(args: unknown[]): void {
    const errorArg = args.find((arg): arg is Error => arg instanceof Error);
    const formattedArgs = args.map((arg) => this.serializeForContext(arg));

    Sentry.withScope((scope) => {
      scope.setLevel('error');
      scope.setTag('source', 'console.error');
      scope.setContext('console_error', {
        arguments: formattedArgs,
      });

      if (errorArg) {
        Sentry.captureException(errorArg);
        return;
      }

      Sentry.captureMessage(this.formatConsoleMessage(args));
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

  private normalizeError(error: unknown): Error {
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