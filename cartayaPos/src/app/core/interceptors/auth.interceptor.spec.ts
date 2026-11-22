import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let toastController: jasmine.SpyObj<ToastController>;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getAccessToken',
      'getRefreshToken',
      'refreshAccessToken',
      'clearSession',
    ]);
    authServiceSpy.getAccessToken.and.returnValue('access-1');
    authServiceSpy.getRefreshToken.and.returnValue('refresh-1');
    authServiceSpy.clearSession.and.returnValue(Promise.resolve());

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    const toastSpy = jasmine.createSpyObj('ToastController', ['create']);
    toastSpy.create.and.returnValue(Promise.resolve(jasmine.createSpyObj('Toast', ['present'])));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastController, useValue: toastSpy },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    toastController = TestBed.inject(ToastController) as jasmine.SpyObj<ToastController>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add the Bearer token to API requests', () => {
    httpClient.get('/test').subscribe();

    const req = httpMock.expectOne('/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('should not add the token to auth endpoints', () => {
    httpClient.post('/api/auth/sign-in/email', {}).subscribe();

    const req = httpMock.expectOne('/api/auth/sign-in/email');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should pass successful requests through', (done) => {
    httpClient.get('/test').subscribe((body) => {
      expect(body).toEqual({ ok: true });
      done();
    });

    httpMock.expectOne('/test').flush({ ok: true });
  });

  it('should pass non-401 errors through without touching the session', (done) => {
    httpClient.get('/test').subscribe({
      next: () => fail('should have errored'),
      error: (error) => {
        expect(error.status).toBe(500);
        expect(authService.clearSession).not.toHaveBeenCalled();
        done();
      },
    });

    httpMock.expectOne('/test').flush({}, { status: 500, statusText: 'Server Error' });
  });

  it('should not try to refresh when a sign-in attempt itself returns 401', (done) => {
    httpClient.post('/api/auth/sign-in/email', {}).subscribe({
      next: () => fail('should have errored'),
      error: (error) => {
        expect(error.status).toBe(401);
        expect(authService.refreshAccessToken).not.toHaveBeenCalled();
        done();
      },
    });

    httpMock
      .expectOne('/api/auth/sign-in/email')
      .flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('should refresh the token on 401 and retry the request with the new token', (done) => {
    authService.refreshAccessToken.and.returnValue(
      of({ accessToken: 'access-2', refreshToken: 'refresh-2' }) as unknown as ReturnType<AuthService['refreshAccessToken']>
    );

    httpClient.get('/test').subscribe((body) => {
      expect(body).toEqual({ ok: true });
      done();
    });

    httpMock.expectOne('/test').flush({}, { status: 401, statusText: 'Unauthorized' });

    const retry = httpMock.expectOne('/test');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ ok: true });
  });

  it('should clear the session, warn with a translated toast and go to login when the refresh fails', (done) => {
    authService.refreshAccessToken.and.returnValue(throwError(() => new Error('refresh failed')));

    httpClient.get('/test').subscribe({
      next: () => fail('should have errored'),
      error: () => {
        expect(authService.clearSession).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { replaceUrl: true });
        expect(toastController.create).toHaveBeenCalledWith(
          jasmine.objectContaining({ message: 'API_ERRORS.SESSION_EXPIRED' })
        );
        done();
      },
    });

    httpMock.expectOne('/test').flush({}, { status: 401, statusText: 'Unauthorized' });
  });

  it('should go to login without refreshing when there is no refresh token', (done) => {
    authService.getRefreshToken.and.returnValue(null);

    httpClient.get('/test').subscribe({
      next: () => fail('should have errored'),
      error: () => {
        expect(authService.refreshAccessToken).not.toHaveBeenCalled();
        expect(authService.clearSession).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { replaceUrl: true });
        done();
      },
    });

    httpMock.expectOne('/test').flush({}, { status: 401, statusText: 'Unauthorized' });
  });
});
