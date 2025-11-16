import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { SUPPORTED_LANGUAGES, type Language } from '../models/language.model';
import { AuthService } from './auth.service';
import { LanguageState } from './language-state.service';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

/**
 * Main coordinator service for language management across the application.
 * Orchestrates language changes, storage persistence, backend sync, and TranslateService integration.
 * 
 * Responsibilities:
 * - Initialize language on app startup with fallback chain (backend → local → browser → default)
 * - Handle language changes with validation and state management
 * - Persist language preferences to Ionic Storage
 * - Synchronize language preferences with backend when available
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
  private authService = inject(AuthService);
  private settingsService = inject(SettingsService);

  /**
   * Initialize language on app startup.
   * 
   * Priority chain:
   * 1. Load from backend user settings (if authenticated)
   * 2. Load saved preference from Ionic Storage
   * 3. Detect browser/device language
   * 4. Fallback to 'en'
   * 
   * Will set TranslateService, persist to storage, and update LanguageState
   */
  async init(): Promise<void> {
    try {
      this.languageState.setLoading(true);

      // First, try to get language from authenticated user's backend settings
      const user = this.authService.getCurrentUser();
      if (user?.settings?.preferredLanguage) {
        const userLanguage = user.settings.preferredLanguage;
        if (this.isLanguageSupported(userLanguage)) {
          await this.setLanguage(userLanguage);
          return;
        }
      }

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

      // Check if there are any unsynchronized changes and retry sync
      await this.checkSyncStatus();
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
   * 5. Sync to backend (fire-and-forget)
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
      this.languageState.setError(null); // Clear any previous errors

      // Sync to backend asynchronously (fire-and-forget)
      try {
        await this.syncWithBackend(targetLanguage);
        this.languageState.setSyncStatus(true);
      } catch (error) {
        console.error('Backend sync failed:', error);
        this.languageState.setSyncStatus(false);
        // Continue - local storage is source of truth
      }
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
   * Check if there are any unsynchronized changes and retry sync
   * Called during app initialization to ensure pending changes are persisted to backend
   * 
   * If sync status is false, attempts to sync the current language preference
   */
  private async checkSyncStatus(): Promise<void> {
    if (!this.languageState.isSynced()) {
      const currentLang = this.languageState.currentLanguage();
      try {
        await this.syncWithBackend(currentLang);
      } catch (error) {
        console.error('Failed to retry language sync on startup:', error);
        // Continue - will retry on next app startup
      }
    }
  }

  /**
   * Synchronize language preference with backend
   * Fire-and-forget approach that doesn't block UI
   * Updates LanguageState sync status and logs errors but doesn't throw
   * 
   * @param languageCode - Language code to sync
   */
  private async syncWithBackend(languageCode: string): Promise<void> {
    try {
      const accessToken = this.authService.getAccessToken();
      if (!accessToken) {
        // Skip backend sync when the user is not authenticated yet
        this.languageState.setSyncStatus(false);
        return;
      }

      await firstValueFrom(
        this.settingsService.setUserLanguage(languageCode)
      );
      this.languageState.setSyncStatus(true);
      this.languageState.setError(null);
    } catch (error) {
      console.error('Failed to sync language with backend:', error);
      this.languageState.setSyncStatus(false);
      this.languageState.setError(error as Error);
      // Don't throw - local storage is source of truth
    }
  }
}

