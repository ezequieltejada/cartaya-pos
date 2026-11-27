import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ErrorReportingService } from './error-reporting.service';

export interface ScopedLogger {
  /** Diagnostic detail. Development only: console + Rustrak Logs (debug). Silent in production. */
  trace(message: string, data?: Record<string, unknown>): void;
  /** Recoverable problem. Same destinations as `trace`, level warning in the console. */
  warn(message: string, data?: unknown): void;
  /** Failure. Always logged; `console.error` becomes a Rustrak issue (ErrorReportingService), plus a log entry in development. */
  error(message: string, error?: unknown, data?: Record<string, unknown>): void;
}

/**
 * Central logging policy:
 * - development: traces, warnings and errors go to the console and to Rustrak;
 * - production: only errors (console + Rustrak).
 *
 * Messages must be static strings; put variable values in `data` so Rustrak groups repeated
 * events instead of creating one issue per value.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly reporting = inject(ErrorReportingService);

  scope(name: string): ScopedLogger {
    const tag = `[${name}]`;
    const verbose = !environment.production;

    return {
      trace: (message, data) => {
        if (!verbose) {
          return;
        }
        console.debug(tag, message, ...(data ? [data] : []));
        this.reporting.captureLog('debug', name, message, data);
      },
      warn: (message, data) => {
        if (!verbose) {
          return;
        }
        console.warn(tag, message, ...(data !== undefined ? [data] : []));
        this.reporting.captureLog('warn', name, message, data === undefined ? {} : { detail: data });
      },
      error: (message, error, data) => {
        // console.error is already captured as an issue in Rustrak (installConsoleErrorCapture).
        console.error(tag, message, ...(error !== undefined ? [error] : []), ...(data ? [data] : []));
        if (verbose) {
          // Development: also keep the failure in the Logs timeline next to the traces.
          this.reporting.captureLog('error', name, message, { ...(data ?? {}), ...(error !== undefined ? { error } : {}) });
        }
      },
    };
  }
}
