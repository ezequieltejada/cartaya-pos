import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

export class CustomMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    const key = params.key;

    // Log missing key in development
    if (!environment.production) {
      console.warn(`Missing translation for key: "${key}" in language: "${params.translateService.currentLang}"`);
    }

    // Return the key itself as fallback
    return key;
  }
}
