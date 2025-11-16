import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TenantSettings } from '../models/tenant-settings.model';
import { UserSettings } from '../models/user.model';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:3000/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SettingsService]
    });

    service = TestBed.inject(SettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Tenant Settings', () => {
    describe('fetchTenantSettings()', () => {
      it('should fetch tenant settings from the backend', () => {
        const mockSettings: TenantSettings = {
          timezone: 'America/New_York',
          currency: 'USD'
        };

        service.fetchTenantSettings('tenant-123').subscribe((settings) => {
          expect(settings).toEqual(mockSettings);
          expect(service.getSettings()).toEqual(mockSettings);
        });

        const req = httpMock.expectOne(`${apiUrl}/tenants/tenant-123/settings`);
        expect(req.request.method).toBe('GET');
        req.flush(mockSettings);
      });

      it('should set isLoading signal during fetch', () => {
        const mockSettings: TenantSettings = { timezone: 'UTC', currency: 'EUR' };

        service.fetchTenantSettings('tenant-123').subscribe();

        expect(service.isLoading()).toBe(true);

        const req = httpMock.expectOne(`${apiUrl}/tenants/tenant-123/settings`);
        req.flush(mockSettings);

        expect(service.isLoading()).toBe(false);
      });

      it('should handle fetch errors gracefully', () => {
        spyOn(console, 'error');

        service.fetchTenantSettings('tenant-123').subscribe({
          error: () => {
            expect(service.isLoading()).toBe(false);
            expect(service.error()).not.toBeNull();
          }
        });

        const req = httpMock.expectOne(`${apiUrl}/tenants/tenant-123/settings`);
        req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getCurrentCurrency()', () => {
      it('should return currency from tenant settings', () => {
        service.tenantSettings.set({ timezone: 'UTC', currency: 'GBP' });

        expect(service.getCurrentCurrency()).toBe('GBP');
      });

      it('should return default EUR when settings not loaded', () => {
        service.tenantSettings.set(null);

        expect(service.getCurrentCurrency()).toBe('EUR');
      });
    });

    describe('getCurrentTimezone()', () => {
      it('should return timezone from tenant settings', () => {
        service.tenantSettings.set({ timezone: 'Europe/Madrid', currency: 'EUR' });

        expect(service.getCurrentTimezone()).toBe('Europe/Madrid');
      });

      it('should return default UTC when settings not loaded', () => {
        service.tenantSettings.set(null);

        expect(service.getCurrentTimezone()).toBe('UTC');
      });
    });

    describe('clearSettings()', () => {
      it('should clear tenant settings and errors', () => {
        service.tenantSettings.set({ timezone: 'UTC', currency: 'EUR' });
        service.error.set('Some error');

        service.clearSettings();

        expect(service.getSettings()).toBeNull();
        expect(service.error()).toBeNull();
      });
    });

    describe('getSettings()', () => {
      it('should return current tenant settings', () => {
        const mockSettings: TenantSettings = { timezone: 'UTC', currency: 'EUR' };
        service.tenantSettings.set(mockSettings);

        expect(service.getSettings()).toEqual(mockSettings);
      });

      it('should return null when settings not loaded', () => {
        service.tenantSettings.set(null);

        expect(service.getSettings()).toBeNull();
      });
    });
  });

  describe('User Settings', () => {
    describe('getUserLanguage()', () => {
      it('should return language from user settings', () => {
        service.userSettings.set({ preferredLanguage: 'es' });

        expect(service.getUserLanguage()).toBe('es');
      });

      it('should return null when user settings not loaded', () => {
        service.userSettings.set(null);

        expect(service.getUserLanguage()).toBeNull();
      });

      it('should return null when language not set', () => {
        service.userSettings.set({});

        expect(service.getUserLanguage()).toBeUndefined();
      });
    });

    describe('setUserLanguage()', () => {
      it('should send PATCH request to update user language', () => {
        const newLanguage = 'es';
        const mockResponse: UserSettings = { preferredLanguage: newLanguage };

        service.setUserLanguage(newLanguage).subscribe((settings) => {
          expect(settings).toEqual(mockResponse);
          expect(service.getUserLanguage()).toBe(newLanguage);
        });

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ preferredLanguage: newLanguage });
        req.flush(mockResponse);
      });

      it('should update user settings signal on success', () => {
        const newLanguage = 'ca';
        const mockResponse: UserSettings = { preferredLanguage: newLanguage };

        service.setUserLanguage(newLanguage).subscribe();

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.flush(mockResponse);

        expect(service.getUserLanguage()).toBe(newLanguage);
      });

      it('should merge new language with existing settings', () => {
        service.userSettings.set({ preferredLanguage: 'en' });

        const newLanguage = 'es';
        const mockResponse: UserSettings = { preferredLanguage: newLanguage };

        service.setUserLanguage(newLanguage).subscribe();

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.flush(mockResponse);

        expect(service.getUserLanguage()).toBe(newLanguage);
      });

      it('should handle errors gracefully', () => {
        spyOn(console, 'error');

        service.setUserLanguage('es').subscribe({
          error: () => {
            expect(console.error).toHaveBeenCalledWith(
              'Failed to update user language preference:',
              jasmine.any(Object)
            );
          }
        });

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      });

      it('should handle network errors', () => {
        spyOn(console, 'error');

        service.setUserLanguage('es').subscribe({
          error: () => {
            expect(console.error).toHaveBeenCalled();
          }
        });

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.error(new ProgressEvent('error'));
      });

      it('should handle 404 errors', () => {
        spyOn(console, 'error');

        service.setUserLanguage('es').subscribe({
          error: () => {
            expect(console.error).toHaveBeenCalled();
          }
        });

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
      });
    });

    describe('fetchUserSettings()', () => {
      it('should fetch user settings from the backend', () => {
        const mockSettings: UserSettings = { preferredLanguage: 'es' };

        service.fetchUserSettings().subscribe((settings) => {
          expect(settings).toEqual(mockSettings);
          expect(service.getUserSettings()).toEqual(mockSettings);
        });

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        expect(req.request.method).toBe('GET');
        req.flush(mockSettings);
      });

      it('should update user settings signal on success', () => {
        const mockSettings: UserSettings = { preferredLanguage: 'ca' };

        service.fetchUserSettings().subscribe();

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.flush(mockSettings);

        expect(service.getUserLanguage()).toBe('ca');
      });

      it('should handle fetch errors gracefully', () => {
        spyOn(console, 'error');

        service.fetchUserSettings().subscribe({
          error: () => {
            expect(console.error).toHaveBeenCalledWith(
              'Failed to fetch user settings:',
              jasmine.any(Object)
            );
          }
        });

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
      });

      it('should handle network errors', () => {
        spyOn(console, 'error');

        service.fetchUserSettings().subscribe({
          error: () => {
            expect(console.error).toHaveBeenCalled();
          }
        });

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.error(new ProgressEvent('error'));
      });
    });

    describe('getUserSettings()', () => {
      it('should return current user settings', () => {
        const mockSettings: UserSettings = { preferredLanguage: 'es' };
        service.userSettings.set(mockSettings);

        expect(service.getUserSettings()).toEqual(mockSettings);
      });

      it('should return null when user settings not loaded', () => {
        service.userSettings.set(null);

        expect(service.getUserSettings()).toBeNull();
      });
    });
  });

  describe('Signal-based state management', () => {
    it('should maintain separate tenant and user settings signals', () => {
      const tenantSettings: TenantSettings = { timezone: 'UTC', currency: 'EUR' };
      const userSettings: UserSettings = { preferredLanguage: 'es' };

      service.tenantSettings.set(tenantSettings);
      service.userSettings.set(userSettings);

      expect(service.getSettings()).toEqual(tenantSettings);
      expect(service.getUserSettings()).toEqual(userSettings);
    });

    it('should support computed currency and timezone signals', () => {
      service.tenantSettings.set({ timezone: 'Europe/Paris', currency: 'EUR' });

      expect(service.currency()).toBe('EUR');
      expect(service.timezone()).toBe('Europe/Paris');
    });

    it('should provide null fallbacks for uninitialized settings', () => {
      service.userSettings.set(null);
      service.tenantSettings.set(null);

      expect(service.getUserLanguage()).toBeNull();
      expect(service.getCurrentCurrency()).toBe('EUR');
      expect(service.getCurrentTimezone()).toBe('UTC');
    });
  });

  describe('Error handling', () => {
    it('should set error signal on tenant settings fetch failure', () => {
      service.fetchTenantSettings('tenant-123').subscribe({
        error: () => {
          expect(service.error()).not.toBeNull();
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/tenants/tenant-123/settings`);
      req.flush({ message: 'Error message' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('Backward compatibility', () => {
    it('should work with user settings containing only language field', () => {
      const settings: UserSettings = { preferredLanguage: 'en' };
      service.userSettings.set(settings);

      expect(service.getUserLanguage()).toBe('en');
    });

    it('should handle optional user settings gracefully', () => {
      service.userSettings.set(null);

      expect(service.getUserLanguage()).toBeNull();
      expect(service.getUserSettings()).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rapid language changes', () => {
      const languages = ['en', 'es', 'ca', 'en'];
      let callCount = 0;

      languages.forEach((lang) => {
        service.setUserLanguage(lang).subscribe();

        const req = httpMock.expectOne(`${apiUrl}/users/me/settings`);
        req.flush({ preferredLanguage: lang });
        callCount++;

        expect(service.getUserLanguage()).toBe(lang);
      });

      expect(callCount).toBe(languages.length);
    });

    it('should handle concurrent fetch and set operations', () => {
      service.fetchUserSettings().subscribe();
      service.setUserLanguage('es').subscribe();

      const reqs = httpMock.match(`${apiUrl}/users/me/settings`);
      expect(reqs.length).toBe(2);

      reqs[0].flush({ preferredLanguage: 'en' });
      reqs[1].flush({ preferredLanguage: 'es' });

      expect(service.getUserLanguage()).toBe('es');
    });
  });
});
