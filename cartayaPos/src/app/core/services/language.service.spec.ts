import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { LanguageState } from './language-state.service';
import { LanguageService } from './language.service';
import { StorageService } from './storage.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let translateService: jasmine.SpyObj<TranslateService>;
  let storageService: jasmine.SpyObj<StorageService>;
  let languageState: LanguageState;

  beforeEach(() => {
    // Create spy objects for dependencies
    const translateSpy = jasmine.createSpyObj('TranslateService', ['use', 'getBrowserLang']);
    const storageSpy = jasmine.createSpyObj('StorageService', ['get', 'set']);

    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        LanguageState,
        { provide: TranslateService, useValue: translateSpy },
        { provide: StorageService, useValue: storageSpy }
      ]
    });

    service = TestBed.inject(LanguageService);
    translateService = TestBed.inject(TranslateService) as jasmine.SpyObj<TranslateService>;
    storageService = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    languageState = TestBed.inject(LanguageState);

    // Setup default mocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    translateSpy.use.and.returnValue({ toPromise: () => Promise.resolve() } as any);
    storageSpy.get.and.returnValue(Promise.resolve(null));
    storageSpy.set.and.returnValue(Promise.resolve());
  });

  afterEach(() => {
    languageState.reset();
  });

  describe('init()', () => {
    it('should load saved language preference from storage', async () => {
      storageService.get.and.returnValue(Promise.resolve('es'));

      await service.init();

      expect(storageService.get).toHaveBeenCalledWith('user_language_preference');
      expect(translateService.use).toHaveBeenCalledWith('es');
      expect(service.getCurrentLanguage()).toBe('es');
    });

    it('should use browser language when no saved preference', async () => {
      storageService.get.and.returnValue(Promise.resolve(null));
      translateService.getBrowserLang.and.returnValue('ca');

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('ca');
      expect(service.getCurrentLanguage()).toBe('ca');
    });

    it('should fallback to en when browser language is not supported', async () => {
      storageService.get.and.returnValue(Promise.resolve(null));
      translateService.getBrowserLang.and.returnValue('fr');

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('en');
      expect(service.getCurrentLanguage()).toBe('en');
    });

    it('should fallback to en when browser language is null', async () => {
      storageService.get.and.returnValue(Promise.resolve(null));
      translateService.getBrowserLang.and.returnValue(undefined);

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('en');
      expect(service.getCurrentLanguage()).toBe('en');
    });

    it('should fallback to en when saved preference is invalid', async () => {
      storageService.get.and.returnValue(Promise.resolve('invalid_lang'));

      await service.init();

      expect(translateService.use).toHaveBeenCalledWith('en');
      expect(service.getCurrentLanguage()).toBe('en');
    });

    it('should set loading state during initialization', async () => {
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
      storageService.get.and.returnValue(Promise.reject(new Error('Storage error')));
      spyOn(console, 'error');

      await service.init();

      expect(console.error).toHaveBeenCalled();
      expect(translateService.use).toHaveBeenCalledWith('en');
    });

    it('should handle setLanguage errors during init', async () => {
      translateService.use.and.returnValue({ toPromise: () => Promise.reject(new Error('Translation error')) } as any);
      spyOn(console, 'error');

      await service.init();

      expect(console.error).toHaveBeenCalled();
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

    it('should set sync status to false', async () => {
      await service.setLanguage('es');

      expect(languageState.isSynced()).toBe(false);
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

  describe('syncWithBackend()', () => {
    it('should be callable without errors', async () => {
      await expectAsync(service.syncWithBackend()).toBeResolved();
    });

    it('should be a placeholder for Phase 4', async () => {
      // This is a placeholder that does nothing - just verify it doesn't throw
      const result = service.syncWithBackend();
      expect(result).toBeDefined();
      await result;
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
    });

    it('should handle empty string language code', async () => {
      await service.setLanguage('');

      expect(service.getCurrentLanguage()).toBe('en');
      expect(translateService.use).toHaveBeenCalledWith('en');
    });

    it('should handle error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      translateService.use.and.returnValue({ toPromise: () => Promise.reject(new Error('Error')) } as any);

      await service.setLanguage('es');

      expect(languageState.isLoading()).toBe(false);
      expect(languageState.hasError()).toBe(true);
    });
  });
});
