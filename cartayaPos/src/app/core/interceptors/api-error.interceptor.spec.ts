import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { apiErrorInterceptor } from './api-error.interceptor';

describe('apiErrorInterceptor', () => {
  const req = new HttpRequest('GET', `${environment.apiUrl}/x`);
  const run = (error: HttpErrorResponse) =>
    TestBed.runInInjectionContext(() =>
      firstValueFrom(apiErrorInterceptor(req, (() => throwError(() => error)) as HttpHandlerFn))
    ).catch((e: unknown) => e as HttpErrorResponse) as Promise<HttpErrorResponse>;

  it('parses a string JSON body into an object', async () => {
    const result = await run(new HttpErrorResponse({ status: 403, error: '{"code":"MISSING_PERMISSIONS"}' }));
    expect(result.status).toBe(403);
    expect((result.error as { code: string }).code).toBe('MISSING_PERMISSIONS');
  });

  it('leaves object bodies untouched', async () => {
    const original = new HttpErrorResponse({ status: 404, error: { code: 'POS_NOT_FOUND' } });
    expect(await run(original)).toBe(original);
  });
});
