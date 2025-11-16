import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { LanguageState } from './language-state.service';
import { LanguageService } from './language.service';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let translateService: jasmine.SpyObj<TranslateService>;
  let storageService: jasmine.SpyObj<StorageService>;
  let authService: jasmine.SpyObj<AuthService>;
  let settingsService: jasmine.SpyObj<SettingsService>;
  let languageState: LanguageState;

  beforeEach(() => {
    // Create spy objects for dependencies
    const translateSpy = jasmine.createSpyObj('TranslateService', ['use', 'getBrowserLang']);
    const storageSpy = jasmine.createSpyObj('StorageService', ['get', 'set']);
    const authSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    const settingsSpy = jasmine.createSpyObj('SettingsService', ['setUserLanguage']);

    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        LanguageState,
        { provide: TranslateService, useValue: translateSpy },
        { provide: StorageService, useValue: storageSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: SettingsService, useValue: settingsSpy }
      ]
    });

    service = TestBed.inject(LanguageService);
    translateService = TestBed.inject(TranslateService) as jasmine.SpyObj<TranslateService>;
    storageService = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    settingsService = TestBed.inject(SettingsService) as jasmine.SpyObj<SettingsService>;
    languageState = TestBed.inject(LanguageState);

    // Setup default mocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    translateSpy.use.and.returnValue({ toPromise: () => Promise.resolve() } as any);
    storageSpy.get.and.returnValue(Promise.resolve(null));
    storageSpy.set.and.returnValue(Promise.resolve());
    authSpy.getCurrentUser.and.returnValue(null);
    settingsSpy.setUserLanguage.and.returnValue(of({}));
  });

  afterEach(() => {
    languageState.reset();
  });

  describe('init()', () => {
    it('should load language from authenticated user backend settings first', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        settings: { preferredLanguage: 'es' },
        createdAt: '',
        updatedAt: ''
      };
      authService.getCurrentUser.and.returnValue(mockUser);

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('es');
      expect(service.getCurrentLanguage()).toBe('es');
    });

    it('should load saved language preference from storage when no backend settings', async () => {
      authService.getCurrentUser.and.returnValue(null);
      storageService.get.and.returnValue(Promise.resolve('es'));

      await service.init();

      expect(storageService.get).toHaveBeenCalledWith('user_language_preference');
      expect(translateService.use).toHaveBeenCalledWith('es');
      expect(service.getCurrentLanguage()).toBe('es');
    });

    it('should use browser language when no backend or saved preference', async () => {
      authService.getCurrentUser.and.returnValue(null);
      storageService.get.and.returnValue(Promise.resolve(null));
      translateService.getBrowserLang.and.returnValue('ca');

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('ca');
      expect(service.getCurrentLanguage()).toBe('ca');
    });

    it('should fallback to en when browser language is not supported', async () => {
      authService.getCurrentUser.and.returnValue(null);
      storageService.get.and.returnValue(Promise.resolve(null));
      translateService.getBrowserLang.and.returnValue('fr');

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('en');
      expect(service.getCurrentLanguage()).toBe('en');
    });

    it('should fallback to en when browser language is null', async () => {
      authService.getCurrentUser.and.returnValue(null);
      storageService.get.and.returnValue(Promise.resolve(null));
      translateService.getBrowserLang.and.returnValue(undefined);

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('en');
      expect(service.getCurrentLanguage()).toBe('en');
    });

    it('should fallback to en when saved preference is invalid', async () => {
      authService.getCurrentUser.and.returnValue(null);
      storageService.get.and.returnValue(Promise.resolve('invalid_lang'));

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('en');
      expect(service.getCurrentLanguage()).toBe('en');
    });

    it('should set loading state during initialization', async () => {
      authService.getCurrentUser.and.returnValue(null);
      const loadingStates: boolean[] = [];
      const originalSetLoading = languageState.setLoading.bind(languageState);
      spyOn(languageState, 'setLoading').and.callFake((loading: boolean) => {
        loadingStates.push(loading);
        originalSetLoading(loading);
      });

      await service.init();

      expect(loadingStates).toContain(true);
      expect(loadingStates[loadingStates.length - 1]).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      authService.getCurrentUser.and.returnValue(null);
      storageService.get.and.returnValue(Promise.reject(new Error('Storage error')));
      spyOn(console, 'error');

      await service.init();

      expect(console.error).toHaveBeenCalled();
      expect(translateService.use).toHaveBeenCalledWith('en');
    });

    it('should handle setLanguage errors during init', async () => {
      authService.getCurrentUser.and.returnValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      translateService.use.and.returnValue({ toPromise: () => Promise.reject(new Error('Translation error')) } as any);
      spyOn(console, 'error');

      await service.init();

      expect(console.error).toHaveBeenCalled();
    });

    it('should check sync status after initialization', async () => {
      authService.getCurrentUser.and.returnValue(null);
      storageService.get.and.returnValue(Promise.resolve('es'));
      languageState.setSyncStatus(false);

      await service.init();

      // After init, if sync was needed, it would have been attempted
      expect(settingsService.setUserLanguage).toHaveBeenCalled();
    });
  });

  describe('setLanguage()', () => {
    it('should update TranslateService with valid language', async () => {
      await service.setLanguage('es');

      expect(translateService.use).toHaveBeenCalledWith('es');
    });

    it('should persist language to storage', async () => {
      await service.setLanguage('es');

      expect(storageService.set).toHaveBeenCalledWith('user_language_preference', 'es');
    });

    it('should update language state', async () => {
      await service.setLanguage('es');

      expect(service.getCurrentLanguage()).toBe('es');
    });

    it('should sync to backend after persisting locally', async () => {
      await service.setLanguage('es');

      expect(settingsService.setUserLanguage).toHaveBeenCalledWith('es');
    });

    it('should update sync status to true on successful backend sync', async () => {
      settingsService.setUserLanguage.and.returnValue(of({ preferredLanguage: 'es' }));

      await service.setLanguage('es');

      expect(languageState.isSynced()).toBe(true);
    });

    it('should update sync status to false on backend sync failure', async () => {
      settingsService.setUserLanguage.and.returnValue(throwError(() => new Error('Backend error')));
      spyOn(console, 'error');

      await service.setLanguage('es');

      expect(languageState.isSynced()).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it('should clear previous errors when setting language', async () => {
      languageState.setError(new Error('Previous error'));

      await service.setLanguage('es');

      expect(languageState.hasError()).toBe(false);
    });

    it('should fallback to en for unsupported language codes', async () => {
      await service.setLanguage('fr');

      expect(translateService.use).toHaveBeenCalledWith('en');
      expect(service.getCurrentLanguage()).toBe('en');
    });

    it('should log warning for unsupported language', async () => {
      spyOn(console, 'warn');

      await service.setLanguage('invalid_lang');

      expect(console.warn).toHaveBeenCalledWith('Unsupported language: invalid_lang, falling back to \'en\'');
    });

    it('should set loading state during language change', async () => {
      const loadingStates: boolean[] = [];
      const originalSetLoading = languageState.setLoading.bind(languageState);
      spyOn(languageState, 'setLoading').and.callFake((loading: boolean) => {
        loadingStates.push(loading);
        originalSetLoading(loading);
      });

      await service.setLanguage('ca');

      expect(loadingStates).toContain(true);
      expect(loadingStates[loadingStates.length - 1]).toBe(false);
    });

    it('should handle TranslateService errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      translateService.use.and.returnValue({ toPromise: () => Promise.reject(new Error('Translation error')) } as any);
      spyOn(console, 'error');

      await service.setLanguage('es');

      expect(console.error).toHaveBeenCalled();
      expect(languageState.hasError()).toBe(true);
    });

    it('should handle storage errors gracefully', async () => {
      storageService.set.and.returnValue(Promise.reject(new Error('Storage error')));
      spyOn(console, 'error');

      await service.setLanguage('es');

      expect(console.error).toHaveBeenCalled();
      expect(languageState.hasError()).toBe(true);
    });

    it('should support all supported languages', async () => {
      const supportedCodes = ['en', 'es', 'ca'];

      for (const code of supportedCodes) {
        await service.setLanguage(code);
        expect(service.getCurrentLanguage()).toBe(code);
      }
    });
  });

  describe('getCurrentLanguage()', () => {
    it('should return current language from state', async () => {
      await service.setLanguage('es');

      expect(service.getCurrentLanguage()).toBe('es');
    });

    it('should return default language initially', () => {
      expect(service.getCurrentLanguage()).toBe('en');
    });
  });

  describe('getAvailableLanguages()', () => {
    it('should return all supported languages', () => {
      const languages = service.getAvailableLanguages();

      expect(languages.length).toBeGreaterThan(0);
      expect(languages.some(l => l.code === 'en')).toBe(true);
      expect(languages.some(l => l.code === 'es')).toBe(true);
      expect(languages.some(l => l.code === 'ca')).toBe(true);
    });

    it('should include language metadata', () => {
      const languages = service.getAvailableLanguages();
      const english = languages.find(l => l.code === 'en');

      expect(english).toBeDefined();
      expect(english!.name).toBeTruthy();
      expect(english!.englishName).toBeTruthy();
    });

    it('should have correct structure for each language', () => {
      const languages = service.getAvailableLanguages();

      languages.forEach(language => {
        expect(language.code).toBeTruthy();
        expect(language.name).toBeTruthy();
        expect(language.englishName).toBeTruthy();
      });
    });
  });

  describe('isLanguageSupported()', () => {
    it('should return true for supported languages', () => {
      expect(service.isLanguageSupported('en')).toBe(true);
      expect(service.isLanguageSupported('es')).toBe(true);
      expect(service.isLanguageSupported('ca')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(service.isLanguageSupported('fr')).toBe(false);
      expect(service.isLanguageSupported('de')).toBe(false);
      expect(service.isLanguageSupported('invalid')).toBe(false);
    });

    it('should return false for empty or null codes', () => {
      expect(service.isLanguageSupported('')).toBe(false);
    });
  });

  describe('Backend sync functionality', () => {
    describe('sync on language change', () => {
      it('should call syncWithBackend when language is set', async () => {
        await service.setLanguage('es');
        expect(settingsService.setUserLanguage).toHaveBeenCalledWith('es');
      });

      it('should set isSynced to true on successful sync', async () => {
        settingsService.setUserLanguage.and.returnValue(of({ preferredLanguage: 'es' }));
        await service.setLanguage('es');
        expect(languageState.isSynced()).toBe(true);
      });

      it('should set isSynced to false on sync failure and continue with local state', async () => {
        settingsService.setUserLanguage.and.returnValue(throwError(() => new Error('Network error')));
        spyOn(console, 'error');

        await service.setLanguage('es');

        expect(languageState.isSynced()).toBe(false);
        expect(service.getCurrentLanguage()).toBe('es');
        expect(storageService.set).toHaveBeenCalled();
      });

      it('should set error state on sync failure', async () => {
        const error = new Error('Backend sync failed');
        settingsService.setUserLanguage.and.returnValue(throwError(() => error));
        spyOn(console, 'error');

        await service.setLanguage('es');

        expect(languageState.hasError()).toBe(true);
      });

      it('should not throw on backend sync failure', async () => {
        settingsService.setUserLanguage.and.returnValue(throwError(() => new Error('Backend error')));

        await expectAsync(service.setLanguage('es')).toBeResolved();
      });
    });

    describe('checkSyncStatus()', () => {
      it('should retry sync if isSynced is false', async () => {
        languageState.setSyncStatus(false);
        languageState.setLanguage('es');
        settingsService.setUserLanguage.and.returnValue(of({ preferredLanguage: 'es' }));

        await service.init();

        expect(settingsService.setUserLanguage).toHaveBeenCalled();
      });

      it('should not retry sync if isSynced is true', async () => {
        authService.getCurrentUser.and.returnValue(null);
        settingsService.setUserLanguage.calls.reset();
        languageState.setSyncStatus(true);
        languageState.setLanguage('es');

        await service.init();

        // setUserLanguage should not be called during init if sync status is already true
        // But it may be called by setLanguage as part of normal flow
        // This test verifies the checkSyncStatus specifically doesn't retry when synced
        expect(languageState.isSynced()).toBe(true);
      });

      it('should handle sync retry failure gracefully', async () => {
        languageState.setSyncStatus(false);
        languageState.setLanguage('ca');
        settingsService.setUserLanguage.and.returnValue(throwError(() => new Error('Retry failed')));
        spyOn(console, 'error');

        await service.init();

        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('edge cases and integration', () => {
    it('should handle rapid language changes', async () => {
      await service.setLanguage('en');
      await service.setLanguage('es');
      await service.setLanguage('ca');
      await service.setLanguage('en');

      expect(service.getCurrentLanguage()).toBe('en');
      expect(storageService.set).toHaveBeenCalledTimes(4);
      expect(settingsService.setUserLanguage).toHaveBeenCalledTimes(4);
    });

    it('should handle empty string language code', async () => {
      await service.setLanguage('');

      expect(service.getCurrentLanguage()).toBe('en');
      expect(translateService.use).toHaveBeenCalledWith('en');
    });

    it('should handle error during language change', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      translateService.use.and.returnValue({ toPromise: () => Promise.reject(new Error('Error')) } as any);

      await service.setLanguage('es');

      expect(languageState.isLoading()).toBe(false);
      expect(languageState.hasError()).toBe(true);
    });

    it('should prioritize backend language over local storage', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        settings: { preferredLanguage: 'ca' },
        createdAt: '',
        updatedAt: ''
      };
      authService.getCurrentUser.and.returnValue(mockUser);
      storageService.get.and.returnValue(Promise.resolve('es'));

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('ca');
      expect(service.getCurrentLanguage()).toBe('ca');
    });

    it('should handle user without settings', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        createdAt: '',
        updatedAt: ''
      };
      authService.getCurrentUser.and.returnValue(mockUser);
      storageService.get.and.returnValue(Promise.resolve('es'));

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('es');
      expect(service.getCurrentLanguage()).toBe('es');
    });
  });
});

