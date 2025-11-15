import { TestBed } from '@angular/core/testing';
import { LanguageState } from './language-state.service';

describe('LanguageState', () => {
  let service: LanguageState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageState);
  });

  afterEach(() => {
    service.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(service.currentLanguage()).toBe('en');
      expect(service.isLoading()).toBe(false);
      expect(service.isSynced()).toBe(false);
      expect(service.lastSyncError()).toBeNull();
    });

    it('should have correct default computed values', () => {
      expect(service.currentLanguageName()).toBe('English');
      expect(service.hasError()).toBe(false);
    });
  });

  describe('setLanguage', () => {
    it('should update current language', () => {
      service.setLanguage('es');
      expect(service.currentLanguage()).toBe('es');
    });

    it('should update current language to catalan', () => {
      service.setLanguage('ca');
      expect(service.currentLanguage()).toBe('ca');
    });

    it('should allow setting to any string value', () => {
      service.setLanguage('fr');
      expect(service.currentLanguage()).toBe('fr');
    });
  });

  describe('setLoading', () => {
    it('should update loading state to true', () => {
      service.setLoading(true);
      expect(service.isLoading()).toBe(true);
    });

    it('should update loading state to false', () => {
      service.setLoading(true);
      service.setLoading(false);
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('setSyncStatus', () => {
    it('should update sync status to true', () => {
      service.setSyncStatus(true);
      expect(service.isSynced()).toBe(true);
    });

    it('should update sync status to false', () => {
      service.setSyncStatus(true);
      service.setSyncStatus(false);
      expect(service.isSynced()).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set an error', () => {
      const error = new Error('Test error');
      service.setError(error);
      expect(service.lastSyncError()).toBe(error);
    });

    it('should clear error when set to null', () => {
      const error = new Error('Test error');
      service.setError(error);
      service.setError(null);
      expect(service.lastSyncError()).toBeNull();
    });
  });

  describe('computed signal: currentLanguageName', () => {
    it('should return English for en language code', () => {
      service.setLanguage('en');
      expect(service.currentLanguageName()).toBe('English');
    });

    it('should return Español for es language code', () => {
      service.setLanguage('es');
      expect(service.currentLanguageName()).toBe('Español');
    });

    it('should return Català for ca language code', () => {
      service.setLanguage('ca');
      expect(service.currentLanguageName()).toBe('Català');
    });

    it('should recompute when language changes', () => {
      service.setLanguage('en');
      expect(service.currentLanguageName()).toBe('English');
      
      service.setLanguage('es');
      expect(service.currentLanguageName()).toBe('Español');
    });

    it('should return default English for unknown language code', () => {
      service.setLanguage('unknown');
      expect(service.currentLanguageName()).toBe('English');
    });
  });

  describe('computed signal: hasError', () => {
    it('should return false when no error is set', () => {
      expect(service.hasError()).toBe(false);
    });

    it('should return true when error is set', () => {
      service.setError(new Error('Test error'));
      expect(service.hasError()).toBe(true);
    });

    it('should return false when error is cleared', () => {
      service.setError(new Error('Test error'));
      service.setError(null);
      expect(service.hasError()).toBe(false);
    });

    it('should recompute when error changes', () => {
      expect(service.hasError()).toBe(false);
      
      service.setError(new Error('Test error'));
      expect(service.hasError()).toBe(true);
      
      service.setError(null);
      expect(service.hasError()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all signals to default values', () => {
      // Change all values
      service.setLanguage('es');
      service.setLoading(true);
      service.setSyncStatus(true);
      service.setError(new Error('Test error'));

      // Reset
      service.reset();

      // Verify all are back to defaults
      expect(service.currentLanguage()).toBe('en');
      expect(service.isLoading()).toBe(false);
      expect(service.isSynced()).toBe(false);
      expect(service.lastSyncError()).toBeNull();
    });

    it('should reset computed signals after reset', () => {
      // Change computed signal dependencies
      service.setLanguage('es');
      service.setError(new Error('Test error'));

      expect(service.currentLanguageName()).toBe('Español');
      expect(service.hasError()).toBe(true);

      // Reset
      service.reset();

      // Verify computed signals are reset
      expect(service.currentLanguageName()).toBe('English');
      expect(service.hasError()).toBe(false);
    });

    it('should work correctly when called multiple times', () => {
      service.setLanguage('ca');
      service.reset();
      expect(service.currentLanguage()).toBe('en');

      service.setLanguage('es');
      service.reset();
      expect(service.currentLanguage()).toBe('en');
    });
  });

  describe('multiple signal updates', () => {
    it('should handle multiple updates in sequence', () => {
      service.setLanguage('es');
      service.setLoading(true);
      service.setSyncStatus(true);
      const error = new Error('Sync failed');
      service.setError(error);

      expect(service.currentLanguage()).toBe('es');
      expect(service.isLoading()).toBe(true);
      expect(service.isSynced()).toBe(true);
      expect(service.lastSyncError()).toBe(error);
    });

    it('should allow updating signals independently', () => {
      const originalLang = service.currentLanguage();
      
      service.setLoading(true);
      expect(service.currentLanguage()).toBe(originalLang);
      expect(service.isLoading()).toBe(true);

      service.setSyncStatus(true);
      expect(service.currentLanguage()).toBe(originalLang);
      expect(service.isLoading()).toBe(true);
      expect(service.isSynced()).toBe(true);
    });
  });

  describe('service is singleton', () => {
    it('should share state across multiple injections', () => {
      const service1 = TestBed.inject(LanguageState);
      const service2 = TestBed.inject(LanguageState);

      service1.setLanguage('es');
      expect(service2.currentLanguage()).toBe('es');

      service2.setLanguage('ca');
      expect(service1.currentLanguage()).toBe('ca');
    });
  });
});
