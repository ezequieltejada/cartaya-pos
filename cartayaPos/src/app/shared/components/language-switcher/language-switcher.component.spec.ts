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
    const languageServiceSpy = jasmine.createSpyObj('LanguageService', ['setLanguage']);
    languageServiceSpy.setLanguage.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent, TranslateModule.forRoot(), IonicModule.forRoot()],
      providers: [LanguageState, { provide: LanguageService, useValue: languageServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitcherComponent);
    component = fixture.componentInstance;
    languageService = TestBed.inject(LanguageService) as jasmine.SpyObj<LanguageService>;
    languageState = TestBed.inject(LanguageState);
    fixture.detectChanges();
  });

  afterEach(() => {
    languageState.reset();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list all supported languages', () => {
    expect(component.availableLanguages).toEqual(SUPPORTED_LANGUAGES);
  });

  it('should not render a separate apply/save button', () => {
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();
  });

  describe('applying the language on selection', () => {
    it('should call LanguageService.setLanguage as soon as an option is selected', async () => {
      component.languageForm.get('selectedLanguage')?.setValue('es');
      await new Promise((resolve) => setTimeout(resolve));

      expect(languageService.setLanguage).toHaveBeenCalledWith('es');
    });

    it('should emit languageChanged with the selected code', async () => {
      const emitted: string[] = [];
      component.languageChanged.subscribe((code) => emitted.push(code));

      component.languageForm.get('selectedLanguage')?.setValue('ca');
      await new Promise((resolve) => setTimeout(resolve));

      expect(emitted).toEqual(['ca']);
    });

    it('should do nothing when the current language is selected again', async () => {
      const emitted: string[] = [];
      component.languageChanged.subscribe((code) => emitted.push(code));

      component.languageForm.get('selectedLanguage')?.setValue('en');
      await new Promise((resolve) => setTimeout(resolve));

      expect(languageService.setLanguage).not.toHaveBeenCalled();
      expect(emitted).toEqual([]);
    });
  });
});
