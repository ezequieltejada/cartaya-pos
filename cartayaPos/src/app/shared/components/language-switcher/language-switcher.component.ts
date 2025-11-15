import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { SUPPORTED_LANGUAGES, type Language } from '../../../core/models/language.model';
import { LanguageState } from '../../../core/services/language-state.service';
import { LanguageService } from '../../../core/services/language.service';

/**
 * Reusable language switcher component that allows users to change the application language.
 * 
 * Features:
 * - Displays all supported languages with native names (English, Español, Català)
 * - Shows currently selected language with radio button indicator
 * - Supports different display modes: menu, modal, popover (CSS class binding)
 * - Emits languageChanged event when user selects a language
 * - Shows loading spinner during language change
 * - Disables interaction while loading
 * - Keyboard accessible (Tab, Arrow keys, Space/Enter to select)
 * 
 * Usage:
 * ```html
 * <app-language-switcher 
 *   [displayMode]="'menu'" 
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
  imports: [CommonModule, IonicModule, TranslateModule],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss']
})
export class LanguageSwitcherComponent {
  private languageService = inject(LanguageService);
  private languageState = inject(LanguageState);

  /**
   * Display mode for styling purposes
   * - 'menu': Used in slide menu (default)
   * - 'modal': Used in modal dialog
   * - 'popover': Used in popover overlay
   */
  @Input() displayMode: 'menu' | 'modal' | 'popover' = 'menu';

  /**
   * Event emitted when user selects a language
   * Payload: language code (e.g., 'en', 'es', 'ca')
   */
  @Output() languageChanged = new EventEmitter<string>();

  // Expose signals to template
  readonly availableLanguages: Language[] = SUPPORTED_LANGUAGES;
  readonly currentLanguage = this.languageState.currentLanguage;
  readonly isLoading = this.languageState.isLoading;

  /**
   * Handle language selection.
   * 
   * Flow:
   * 1. Check if selection is different from current language
   * 2. Call LanguageService.setLanguage() (handles TranslateService, storage, and state update)
   * 3. Emit languageChanged event
   * 4. Parent component can then close menu/modal if needed
   * 
   * @param languageCode - Language code selected by user ('en' | 'es' | 'ca')
   */
  async onLanguageSelect(languageCode: string): Promise<void> {
    if (languageCode !== this.currentLanguage()) {
      await this.languageService.setLanguage(languageCode);
      this.languageChanged.emit(languageCode);
    }
  }
}
