import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { SUPPORTED_LANGUAGES, type Language } from '../models/language.model';
import { LanguageState } from './language-state.service';
import { StorageService } from './storage.service';

/**
 * Main coordinator service for language management across the application.
 * Orchestrates language changes, storage persistence, and TranslateService integration.
 * 
 * Responsibilities:
 * - Initialize language on app startup with fallback chain
 * - Handle language changes with validation and state management
 * - Persist language preferences to Ionic Storage
 * - Provide language metadata (current language, available languages, support checks)
 */
@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly LANGUAGE_PREFERENCE_KEY = 'user_language_preference';

  private translateService = inject(TranslateService);
  private storageService = inject(StorageService);
  private languageState = inject(LanguageState);

  /**
   * Initialize language on app startup.
   * 
   * Priority chain:
   * 1. Load saved preference from Ionic Storage
   * 2. Detect browser/device language
   * 3. Fallback to 'en'
   * 
   * Will set TranslateService, persist to storage, and update LanguageState
   */
  async init(): Promise<void> {
    try {
      this.languageState.setLoading(true);

      // Attempt to load saved language preference from storage
      const savedLanguage = await this.storageService.get<string>(this.LANGUAGE_PREFERENCE_KEY);

      if (savedLanguage && this.isLanguageSupported(savedLanguage)) {
        // Use saved preference
        await this.setLanguage(savedLanguage);
      } else {
        // Fallback to browser language
        const browserLang = this.translateService.getBrowserLang() || 'en';
        const fallbackLang = this.isLanguageSupported(browserLang) ? browserLang : 'en';
        await this.setLanguage(fallbackLang);
      }
    } catch (error) {
      console.error('Failed to initialize language:', error);
      // Ultimate fallback to English
      try {
        await this.setLanguage('en');
      } catch (fallbackError) {
        console.error('Failed to set fallback language:', fallbackError);
      }
    } finally {
      this.languageState.setLoading(false);
    }
  }

  /**
   * Change the application language.
   * 
   * Flow:
   * 1. Validate language code
   * 2. Update TranslateService (may trigger HTTP request for JSON)
   * 3. Persist to Ionic Storage
   * 4. Update LanguageState
   * 
   * @param languageCode - Language code to set ('en' | 'es' | 'ca')
   * @throws Does not throw - errors are logged and state is updated
   */
  async setLanguage(languageCode: string): Promise<void> {
    let targetLanguage = languageCode;

    // Validate language is supported, fallback to 'en' if not
    if (!this.isLanguageSupported(targetLanguage)) {
      console.warn(`Unsupported language: ${targetLanguage}, falling back to 'en'`);
      targetLanguage = 'en';
    }

    try {
      this.languageState.setLoading(true);

      // Update TranslateService (may load translation JSON)
      await this.translateService.use(targetLanguage).toPromise();

      // Persist to storage
      await this.storageService.set(this.LANGUAGE_PREFERENCE_KEY, targetLanguage);

      // Update state
      this.languageState.setLanguage(targetLanguage);
      this.languageState.setSyncStatus(false); // Will sync in Phase 4
      this.languageState.setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Failed to set language:', error);
      this.languageState.setError(error as Error);
    } finally {
      this.languageState.setLoading(false);
    }
  }

  /**
   * Get the currently active language code.
   * 
   * @returns Language code ('en' | 'es' | 'ca')
   */
  getCurrentLanguage(): string {
    return this.languageState.currentLanguage();
  }

  /**
   * Get all available/supported languages.
   * 
   * @returns Array of available Language objects with code, name, and englishName
   */
  getAvailableLanguages(): Language[] {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Check if a language code is supported by the application.
   * 
   * @param code - Language code to check
   * @returns True if language is supported, false otherwise
   */
  isLanguageSupported(code: string): boolean {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
  }

  /**
   * Placeholder for backend synchronization.
   * 
   * Phase 4 feature: Will sync language preference with backend when implemented.
   * For now, this is a no-op placeholder.
   * 
   * @returns Promise that resolves when sync is complete
   */
  async syncWithBackend(): Promise<void> {
    // Placeholder for Phase 4: Backend sync implementation
    // Will be implemented when backend API is ready
  }
}
