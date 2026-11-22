import { HttpErrorResponse } from '@angular/common/http';
import { API_ERROR_CODES, API_FIELD_ERROR_CODES, parseApiError, translateApiError } from './api-error';
import en from '../../../assets/i18n/en.json';
import es from '../../../assets/i18n/es.json';
import ca from '../../../assets/i18n/ca.json';

describe('api-error', () => {
  const err = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

  it('reads code, params and details', () => {
    const parsed = parseApiError(
      err(422, { statusCode: 422, code: 'VALIDATION_ERROR', message: 'English', details: [{ field: 'name', code: 'REQUIRED' }] })
    );
    expect(parsed.code).toBe('VALIDATION_ERROR');
    expect(parsed.details).toEqual([{ field: 'name', code: 'REQUIRED' }]);
  });

  it('parses a JSON string body (native HTTP)', () => {
    expect(parseApiError(err(403, '{"code":"MISSING_PERMISSIONS"}')).code).toBe('MISSING_PERMISSIONS');
  });

  it('falls back to UNKNOWN_ERROR for missing or unlisted codes', () => {
    expect(parseApiError(err(500, null)).code).toBe('UNKNOWN_ERROR');
    expect(parseApiError(err(403, { code: 'FORBIDDEN' })).code).toBe('UNKNOWN_ERROR');
    expect(parseApiError(new Error('x')).code).toBe('UNKNOWN_ERROR');
  });

  it('translates by code with params and never uses message', () => {
    const translate = jasmine.createSpyObj('TranslateService', ['instant']);
    translate.instant.and.returnValue('ok');
    translateApiError(translate, err(422, { code: 'CURRENCY_MISMATCH', message: 'English', params: { expected: 'EUR' } }));
    expect(translate.instant).toHaveBeenCalledWith('API_ERRORS.CURRENCY_MISMATCH', { expected: 'EUR' });
  });

  [['en', en], ['es', es], ['ca', ca]].forEach(([lang, file]) => {
    it(`has every API code in ${lang}.json`, () => {
      const json = file as { API_ERRORS: Record<string, string>; API_FIELD_ERRORS: Record<string, string> };
      API_ERROR_CODES.forEach((c) => expect(json.API_ERRORS[c]).withContext(c).toBeTruthy());
      API_FIELD_ERROR_CODES.forEach((c) => expect(json.API_FIELD_ERRORS[c]).withContext(c).toBeTruthy());
    });
  });
});
