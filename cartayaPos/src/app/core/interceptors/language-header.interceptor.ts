import {
    HttpEvent,
    HttpHandlerFn,
    HttpInterceptorFn,
    HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LanguageState } from '../services/language-state.service';

/**
 * HTTP Interceptor for language localization
 * Automatically adds the Accept-Language header to all outgoing HTTP requests
 * based on the current language from LanguageState.
 *
 * This allows the backend to return localized content (e.g., error messages,
 * date formats) in the user's preferred language.
 */
export const languageHeaderInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const languageState = inject(LanguageState);
  const currentLang = languageState.currentLanguage();

  // Clone request and add Accept-Language header with current language
  const clonedReq = req.clone({
    setHeaders: {
      'Accept-Language': currentLang,
    },
  });

  return next(clonedReq);
};
