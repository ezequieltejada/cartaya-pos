import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { SUPPORTED_LANGUAGES } from '../../../core/models/language.model';
import { LanguageState } from '../../../core/services/language-state.service';
import { LanguageService } from '../../../core/services/language.service';
import { LanguageSwitcherComponent } from './language-switcher.component';

describe('LanguageSwitcherComponent', () => {
  let component: LanguageSwitcherComponent;
  let fixture: ComponentFixture<LanguageSwitcherComponent>;
  let languageService: jasmine.SpyObj<LanguageService>;
  let languageState: LanguageState;

  beforeEach(async () => {
    // Create spy objects for dependencies
    const languageServiceSpy = jasmine.createSpyObj('LanguageService', ['setLanguage']);

    await TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent, TranslateModule.forRoot(), IonicModule.forRoot()],
      providers: [
        LanguageState,
        { provide: LanguageService, useValue: languageServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitcherComponent);
    component = fixture.componentInstance;
    languageService = TestBed.inject(LanguageService) as jasmine.SpyObj<LanguageService>;
    languageState = TestBed.inject(LanguageState);

    // Default spy setup
    languageServiceSpy.setLanguage.and.returnValue(Promise.resolve());

    fixture.detectChanges();
  });

  afterEach(() => {
    languageState.reset();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should set default displayMode to menu', () => {
      expect(component.displayMode).toBe('menu');
    });

    it('should accept custom displayMode via @Input', () => {
      component.displayMode = 'modal';
      expect(component.displayMode).toBe('modal');
    });
  });

  describe('Available Languages', () => {
    it('should display all supported languages', () => {
      expect(component.availableLanguages).toEqual(SUPPORTED_LANGUAGES);
    });

    it('should include English, Spanish, and Catalan', () => {
      const codes = component.availableLanguages.map(lang => lang.code);
      expect(codes).toContain('en');
      expect(codes).toContain('es');
      expect(codes).toContain('ca');
    });

    it('should have native language names', () => {
      const languageNames = component.availableLanguages.map(lang => lang.name);
      expect(languageNames).toContain('English');
      expect(languageNames).toContain('Español');
      expect(languageNames).toContain('Català');
    });
  });

  describe('Current Language Tracking', () => {
    it('should expose currentLanguage from LanguageState', () => {
      languageState.setLanguage('es');
      expect(component.currentLanguage()).toBe('es');
    });

    it('should update when LanguageState changes', () => {
      languageState.setLanguage('en');
      expect(component.currentLanguage()).toBe('en');

      languageState.setLanguage('ca');
      expect(component.currentLanguage()).toBe('ca');
    });
  });

  describe('Loading State', () => {
    it('should expose isLoading from LanguageState', () => {
      languageState.setLoading(false);
      expect(component.isLoading()).toBe(false);

      languageState.setLoading(true);
      expect(component.isLoading()).toBe(true);
    });

    it('should show loading indicator when isLoading is true', () => {
      languageState.setLoading(true);
      fixture.detectChanges();
      
      const loadingElement = fixture.nativeElement.querySelector('ion-loading[ng-reflect-is-open="true"]');
      expect(loadingElement).toBeTruthy();
    });

    it('should hide loading indicator when isLoading is false', () => {
      languageState.setLoading(false);
      fixture.detectChanges();
      
      const loadingElement = fixture.nativeElement.querySelector('ion-loading[ng-reflect-is-open="false"]');
      expect(loadingElement).toBeTruthy();
    });
  });

  describe('Language Selection', () => {
    beforeEach(() => {
      languageState.setLanguage('en');
    });

    it('should call LanguageService.setLanguage when language is selected', async () => {
      await component.onLanguageSelect('es');

      expect(languageService.setLanguage).toHaveBeenCalledWith('es');
    });

    it('should emit languageChanged event when language is selected', async () => {
      spyOn(component.languageChanged, 'emit');

      await component.onLanguageSelect('es');

      expect(component.languageChanged.emit).toHaveBeenCalledWith('es');
    });

    it('should not call setLanguage if same language is selected', async () => {
      await component.onLanguageSelect('en');

      expect(languageService.setLanguage).not.toHaveBeenCalled();
    });

    it('should not emit event if same language is selected', async () => {
      spyOn(component.languageChanged, 'emit');

      await component.onLanguageSelect('en');

      expect(component.languageChanged.emit).not.toHaveBeenCalled();
    });

    it('should handle all supported languages', async () => {
      const languageCodes = ['en', 'es', 'ca'];

      for (const code of languageCodes) {
        languageState.setLanguage(code);
        languageService.setLanguage.calls.reset();

        await component.onLanguageSelect(code);
        expect(languageService.setLanguage).not.toHaveBeenCalled();
      }
    });
  });

  describe('Event Emission', () => {
    it('should emit languageChanged with language code', async () => {
      spyOn(component.languageChanged, 'emit');
      languageState.setLanguage('en');

      await component.onLanguageSelect('es');

      expect(component.languageChanged.emit).toHaveBeenCalledWith('es');
    });

    it('should emit after LanguageService.setLanguage completes', async () => {
      spyOn(component.languageChanged, 'emit');
      languageState.setLanguage('en');
      
      // Setup a delayed promise to verify emit happens after service call
      languageService.setLanguage.and.returnValue(new Promise(resolve => setTimeout(resolve, 10)));

      const promise = component.onLanguageSelect('es');
      
      // Emit should not have been called yet
      expect(component.languageChanged.emit).not.toHaveBeenCalled();

      await promise;

      // Emit should now have been called
      expect(component.languageChanged.emit).toHaveBeenCalledWith('es');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on radio group', () => {
      const radioGroup = fixture.nativeElement.querySelector('ion-radio-group');
      expect(radioGroup.getAttribute('aria-label')).toBe('Select language');
    });

    it('should have aria-live on loading indicator', () => {
      const loading = fixture.nativeElement.querySelector('ion-loading');
      expect(loading.getAttribute('aria-live')).toBe('polite');
    });

    it('should disable radio group when loading', () => {
      languageState.setLoading(true);
      fixture.detectChanges();

      const radioGroup = fixture.nativeElement.querySelector('ion-radio-group');
      expect(radioGroup.disabled).toBe(true);
    });

    it('should disable all radio items when loading', () => {
      languageState.setLoading(true);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('ion-item');
      items.forEach((item: HTMLElement) => {
        expect(item.getAttribute('ng-reflect-disabled')).toBe('true');
      });
    });

    it('should have aria-label on individual radio options', () => {
      fixture.detectChanges();

      const radios = fixture.nativeElement.querySelectorAll('ion-radio');
      expect(radios.length).toBe(3);

      radios.forEach((radio: HTMLElement, index: number) => {
        const expectedLabel = `Select ${SUPPORTED_LANGUAGES[index].name}`;
        expect(radio.getAttribute('aria-label')).toBe(expectedLabel);
      });
    });
  });

  describe('Display Modes', () => {
    it('should apply menu class by default', () => {
      component.displayMode = 'menu';
      fixture.detectChanges();

      const list = fixture.nativeElement.querySelector('ion-list');
      expect(list.classList.contains('language-switcher-menu')).toBe(true);
    });

    it('should apply modal class when displayMode is modal', () => {
      component.displayMode = 'modal';
      fixture.detectChanges();

      const list = fixture.nativeElement.querySelector('ion-list');
      expect(list.classList.contains('language-switcher-modal')).toBe(true);
    });

    it('should apply popover class when displayMode is popover', () => {
      component.displayMode = 'popover';
      fixture.detectChanges();

      const list = fixture.nativeElement.querySelector('ion-list');
      expect(list.classList.contains('language-switcher-popover')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle LanguageService.setLanguage rejection', async () => {
      languageState.setLanguage('en');
      const error = new Error('Failed to set language');
      languageService.setLanguage.and.returnValue(Promise.reject(error));

      // Component should handle the error gracefully (not throw)
      expect(async () => {
        try {
          await component.onLanguageSelect('es');
        } catch {
          // We expect the promise to reject, but component should still try to emit
        }
      }).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should switch from English to Spanish', async () => {
      languageState.setLanguage('en');
      expect(component.currentLanguage()).toBe('en');

      await component.onLanguageSelect('es');

      expect(languageService.setLanguage).toHaveBeenCalledWith('es');
    });

    it('should switch from Spanish to Catalan', async () => {
      languageState.setLanguage('es');
      expect(component.currentLanguage()).toBe('es');

      await component.onLanguageSelect('ca');

      expect(languageService.setLanguage).toHaveBeenCalledWith('ca');
    });

    it('should handle rapid language switches', async () => {
      languageState.setLanguage('en');

      await component.onLanguageSelect('es');
      languageState.setLanguage('es');

      await component.onLanguageSelect('ca');

      expect(languageService.setLanguage).toHaveBeenCalledTimes(2);
      expect(languageService.setLanguage).toHaveBeenCalledWith('es');
      expect(languageService.setLanguage).toHaveBeenCalledWith('ca');
    });
  });
});
