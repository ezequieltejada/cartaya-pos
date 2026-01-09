import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpHeaders,
    HttpInterceptorFn,
    HttpRequest,
    HttpResponse,
} from '@angular/common/http';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

type CapacitorHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
type SupportedResponseType = 'json' | 'text' | 'arraybuffer' | 'blob';

function isSupportedMethod(method: string): method is CapacitorHttpMethod {
  return (
    method === 'GET' ||
    method === 'POST' ||
    method === 'PUT' ||
    method === 'PATCH' ||
    method === 'DELETE' ||
    method === 'HEAD' ||
    method === 'OPTIONS'
  );
}

function buildPlainHeaders(headers: HttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of headers.keys()) {
    const value = headers.get(key);
    if (value != null) out[key] = value;
  }
  return out;
}

function hasHeader(headers: Record<string, string>, headerName: string): boolean {
  const needle = headerName.toLowerCase();
  return Object.keys(headers).some((h) => h.toLowerCase() === needle);
}

function normalizeResponseType(responseType: HttpRequest<unknown>['responseType']): SupportedResponseType {
  if (responseType === 'arraybuffer') return 'arraybuffer';
  if (responseType === 'blob') return 'blob';
  if (responseType === 'text') return 'text';
  return 'json';
}

function isPlainSupportedBody(body: unknown): boolean {
  if (body == null) return true;
  if (typeof body === 'string') return true;
  if (typeof body === 'number') return true;
  if (typeof body === 'boolean') return true;
  if (typeof body !== 'object') return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false;
  return true;
}

/**
 * Capacitor HTTP Interceptor
 *
 * In Android/iOS builds, HttpClient runs inside a WebView and is subject to CORS.
 * This interceptor routes backend calls through Capacitor's native HTTP stack,
 * which avoids WebView CORS restrictions.
 */
export const capacitorHttpInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  if (!Capacitor.isNativePlatform()) {
    return next(req);
  }

  // Only intercept backend API calls (skip assets/i18n relative requests)
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // Only intercept absolute http(s) URLs
  if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
    return next(req);
  }

  if (!isSupportedMethod(req.method)) {
    return next(req);
  }

  if (!isPlainSupportedBody(req.body)) {
    return next(req);
  }

  const url = req.urlWithParams;
  const headers = buildPlainHeaders(req.headers);

  // Angular HttpClient normally applies Content-Type automatically when sending JSON.
  // Since we're short-circuiting to CapacitorHttp, we must add it ourselves.
  const hasBody = req.body != null && req.method !== 'GET' && req.method !== 'HEAD';
  const isObjectBody = hasBody && typeof req.body === 'object';
  if (isObjectBody && !hasHeader(headers, 'Content-Type')) {
    headers['Content-Type'] = 'application/json';
  }

  if (!hasHeader(headers, 'Accept')) {
    headers['Accept'] = 'application/json';
  }
  const responseType = normalizeResponseType(req.responseType);

  return from(
    CapacitorHttp.request({
      method: req.method,
      url,
      headers,
      data: req.body as any,
      responseType,
    })
  ).pipe(
    switchMap((res) => {
      const responseHeaders = new HttpHeaders(res.headers ?? {});

      if (res.status >= 400) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: res.status,
              url,
              error: res.data,
              headers: responseHeaders,
            })
        );
      }

      return of(
        new HttpResponse({
          status: res.status,
          body: res.data,
          headers: responseHeaders,
          url,
        })
      );
    }),
    catchError((err) => {
      if (err instanceof HttpErrorResponse) {
        return throwError(() => err);
      }

      return throwError(
        () =>
          new HttpErrorResponse({
            status: 0,
            url,
            error: err,
          })
      );
    })
  );
};
