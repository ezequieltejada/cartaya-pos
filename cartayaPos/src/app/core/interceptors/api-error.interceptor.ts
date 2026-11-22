import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { parseApiError } from '../utils/api-error';

/**
 * Normalises API error responses so every consumer can rely on `error.error`
 * being an object carrying the stable `code` (native HTTP can hand back the
 * JSON body as a string). It never rewrites or exposes the English `message`;
 * UI text comes from `API_ERRORS.<code>` via translateApiError().
 * Sits right outside the Capacitor HTTP interceptor.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        typeof error.error !== 'string' ||
        !req.url.startsWith(environment.apiUrl)
      ) {
        return throwError(() => error);
      }

      let body: unknown = error.error;
      try {
        body = JSON.parse(error.error);
      } catch {
        return throwError(() => error);
      }

      const normalised = new HttpErrorResponse({
        error: body,
        headers: error.headers,
        status: error.status,
        statusText: error.statusText,
        url: error.url ?? undefined,
      });
      // Log (never display) unrecognised codes
      parseApiError(normalised);
      return throwError(() => normalised);
    })
  );
