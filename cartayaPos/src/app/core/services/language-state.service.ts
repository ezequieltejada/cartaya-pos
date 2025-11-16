import { computed, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { SUPPORTED_LANGUAGES } from '../models/language.model';

/**
 * Signal-based reactive state service to manage language state throughout the application.
 * Provides a single source of truth for the current language and sync status.
 */
@Injectable({
  providedIn: 'root'
})
export class LanguageState {
  // Writable Signals
  readonly currentLanguage: WritableSignal<string> = signal('en');
  readonly isLoading: WritableSignal<boolean> = signal(false);
  readonly isSynced: WritableSignal<boolean> = signal(false);
  readonly lastSyncError: WritableSignal<Error | null> = signal(null);

  // Computed Signals
  readonly currentLanguageName: Signal<string> = computed(() => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === this.currentLanguage());
    return lang?.name ?? 'English';
  });

  readonly hasError: Signal<boolean> = computed(() => this.lastSyncError() !== null);

  /**
   * Update the current language code
   * @param code - Language code ('en' | 'es' | 'ca')
   */
  setLanguage(code: string): void {
    this.currentLanguage.set(code);
  }

  /**
   * Update the loading state during language change operations
   * @param loading - Whether a language change operation is in progress
   */
  setLoading(loading: boolean): void {
    this.isLoading.set(loading);
  }

  /**
   * Update the sync status with backend
   * @param synced - Whether local state is synced with backend
   */
  setSyncStatus(synced: boolean): void {
    this.isSynced.set(synced);
  }

  /**
   * Set or clear the last sync error
   * @param error - Error object if sync failed, null to clear error
   */
  setError(error: Error | null): void {
    this.lastSyncError.set(error);
  }

  /**
   * Reset the service to its default state
   * - language: 'en'
   * - loading: false
   * - synced: false
   * - error: null
   */
  reset(): void {
    this.currentLanguage.set('en');
    this.isLoading.set(false);
    this.isSynced.set(false);
    this.lastSyncError.set(null);
  }
}
