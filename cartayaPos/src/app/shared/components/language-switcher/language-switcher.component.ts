import { CommonModule } from '@angular/common';
import { Component, DestroyRef, effect, EventEmitter, inject, Injector, Input, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonIcon, IonLoading, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmarkCircle, languageOutline } from 'ionicons/icons';
import { SUPPORTED_LANGUAGES, type Language } from '../../../core/models/language.model';
import { LanguageState } from '../../../core/services/language-state.service';
import { LanguageService } from '../../../core/services/language.service';

/**
 * Reusable language switcher component that allows users to change the application language.
 * 
 * Features:
 * - Displays language options in a select dropdown (reactive form)
 * - Language is applied as soon as an option is selected
 * - Shows currently selected language
 * - Emits languageChanged event when user saves a language
 * - Shows loading spinner during language change
 * - Disables interaction while loading
 * - Keyboard accessible
 * - iOS compatible (no action sheet)
 * 
 * Usage:
 * ```html
 * <app-language-switcher 
 *   [displayMode]="'modal'" 
 *   (languageChanged)="onLanguageChange($event)">
 * </app-language-switcher>
 * ```
 * 
 * Parent component should handle languageChanged event for any UI updates
 * needed after language change (e.g., closing menu).
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, IonSelect, IonIcon, IonSelectOption, IonLoading],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss']
})
export class LanguageSwitcherComponent implements OnInit {
  private languageService = inject(LanguageService);
  private languageState = inject(LanguageState);
  private formBuilder = inject(FormBuilder);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  /**
   * Display mode for styling purposes
   * - 'menu': Used in slide menu (default)
   * - 'modal': Used in modal dialog
   * - 'popover': Used in popover overlay
   */
  @Input() displayMode: 'menu' | 'modal' | 'popover' = 'menu';

  /**
   * Event emitted when user saves a language selection
   * Payload: language code (e.g., 'en', 'es', 'ca')
   */
  @Output() languageChanged = new EventEmitter<string>();

  // Expose to template
  readonly availableLanguages: Language[] = SUPPORTED_LANGUAGES;
  readonly currentLanguage = this.languageState.currentLanguage;
  readonly isLoading = this.languageState.isLoading;

  // Reactive form
  languageForm!: FormGroup;

  constructor() {
    addIcons({ languageOutline, checkmarkCircle });

    // Setup effect to watch loading state changes
    effect(() => {
      if (this.languageForm) {
        const isLoading = this.isLoading();
        const control = this.languageForm.get('selectedLanguage');
        if (control) {
          if (isLoading) {
            control.disable({ emitEvent: false });
          } else {
            control.enable({ emitEvent: false });
          }
        }
      }
    }, { injector: this.injector });
  }

  ngOnInit(): void {
    this.initializeForm();

    // Apply the language as soon as the user picks one (no extra button)
    this.languageForm
      .get('selectedLanguage')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.onSaveLanguage();
      });
  }

  /**
   * Initialize the reactive form with language selection
   */
  private initializeForm(): void {
    this.languageForm = this.formBuilder.group({
      selectedLanguage: [{
        value: this.currentLanguage(),
        disabled: this.isLoading()
      }, Validators.required]
    });
  }

  /**
   * Get the name of the current language for display
   */
  getCurrentLanguageName(): string {
    const currentLang = this.currentLanguage();
    const language = this.availableLanguages.find(lang => lang.code === currentLang);
    return language?.name || currentLang;
  }

  /**
   * Handle language save
   * 
   * Flow:
   * 1. Get selected language from form
   * 2. Check if selection is different from current language
   * 3. Call LanguageService.setLanguage() (handles TranslateService, storage, and state update)
   * 4. Emit languageChanged event
   * 5. Parent component can then close menu/modal if needed
   */
  async onSaveLanguage(): Promise<void> {
    if (this.languageForm.valid) {
      const selectedLanguage = this.languageForm.get('selectedLanguage')?.value;
      
      if (selectedLanguage && selectedLanguage !== this.currentLanguage()) {
        await this.languageService.setLanguage(selectedLanguage);
        this.languageChanged.emit(selectedLanguage);
      }
    }
  }
}
