import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LanguageState } from '../services/language-state.service';
import { languageHeaderInterceptor } from './language-header.interceptor';

describe('languageHeaderInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let languageState: LanguageState;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideHttpClient(withInterceptors([languageHeaderInterceptor])),
        LanguageState,
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    languageState = TestBed.inject(LanguageState);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Accept-Language header with default language', () => {
    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Accept-Language')).toBe('en');
    req.flush({});
  });

  it('should add Accept-Language header with current language when set to Spanish', () => {
    languageState.setLanguage('es');

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Accept-Language')).toBe('es');
    req.flush({});
  });

  it('should add Accept-Language header with current language when set to Catalan', () => {
    languageState.setLanguage('ca');

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Accept-Language')).toBe('ca');
    req.flush({});
  });

  it('should update header when language changes between requests', () => {
    languageState.setLanguage('es');

    httpClient.get('/api/test1').subscribe();

    let req = httpMock.expectOne('/api/test1');
    expect(req.request.headers.get('Accept-Language')).toBe('es');
    req.flush({});

    // Change language
    languageState.setLanguage('ca');

    httpClient.get('/api/test2').subscribe();

    req = httpMock.expectOne('/api/test2');
    expect(req.request.headers.get('Accept-Language')).toBe('ca');
    req.flush({});
  });

  it('should add header to POST requests', () => {
    languageState.setLanguage('es');

    httpClient.post('/api/test', { data: 'test' }).subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Accept-Language')).toBe('es');
    req.flush({});
  });

  it('should add header to PUT requests', () => {
    languageState.setLanguage('ca');

    httpClient.put('/api/test/1', { data: 'test' }).subscribe();

    const req = httpMock.expectOne('/api/test/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Accept-Language')).toBe('ca');
    req.flush({});
  });

  it('should add header to DELETE requests', () => {
    languageState.setLanguage('es');

    httpClient.delete('/api/test/1').subscribe();

    const req = httpMock.expectOne('/api/test/1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('Accept-Language')).toBe('es');
    req.flush({});
  });

  it('should preserve existing headers while adding Accept-Language', () => {
    languageState.setLanguage('es');

    httpClient.get('/api/test', {
      headers: {
        'Custom-Header': 'custom-value',
      },
    }).subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Accept-Language')).toBe('es');
    expect(req.request.headers.get('Custom-Header')).toBe('custom-value');
    req.flush({});
  });

  it('should work with multiple concurrent requests', () => {
    languageState.setLanguage('es');

    httpClient.get('/api/test1').subscribe();
    httpClient.get('/api/test2').subscribe();
    httpClient.get('/api/test3').subscribe();

    const requests = httpMock.match(() => true);
    expect(requests.length).toBe(3);
    requests.forEach((req) => {
      expect(req.request.headers.get('Accept-Language')).toBe('es');
      req.flush({});
    });
  });

  it('should handle requests with query parameters', () => {
    languageState.setLanguage('ca');

    httpClient.get('/api/test', { params: { filter: 'active' } }).subscribe();

    const req = httpMock.expectOne('/api/test?filter=active');
    expect(req.request.headers.get('Accept-Language')).toBe('ca');
    req.flush({});
  });

  it('should not modify the original request object', () => {
    languageState.setLanguage('es');

    const testData = { data: 'test' };
    httpClient.post('/api/test', testData).subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.body).toEqual(testData);
    expect(req.request.headers.get('Accept-Language')).toBe('es');
    req.flush({});
  });

  it('should continue to work after language is reset', () => {
    languageState.setLanguage('es');
    languageState.reset();

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Accept-Language')).toBe('en');
    req.flush({});
  });
});
