import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { ActionSheetButton, ActionSheetController, IonicModule } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, languageOutline } from 'ionicons/icons';
import { SUPPORTED_LANGUAGES, type Language } from '../../../core/models/language.model';
import { LanguageState } from '../../../core/services/language-state.service';
import { LanguageService } from '../../../core/services/language.service';

/**
 * Reusable language switcher component that allows users to change the application language.
 * 
 * Features:
 * - Displays language options in an action sheet
 * - Shows currently selected language with checkmark indicator
 * - Button to trigger the action sheet with current language label
 * - Emits languageChanged event when user selects a language
 * - Shows loading spinner during language change
 * - Disables interaction while loading
 * - Keyboard accessible
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
  private actionSheetController = inject(ActionSheetController);
  private translateService = inject(TranslateService);

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
  readonly isActionSheetOpen = signal(false);

  constructor() {
    addIcons({ checkmarkCircleOutline, languageOutline });
  }

  /**
   * Get the name of the current language for the button label
   */
  getCurrentLanguageName(): string {
    const currentLang = this.currentLanguage();
    const language = this.availableLanguages.find(lang => lang.code === currentLang);
    return language?.name || currentLang;
  }

  /**
   * Open the action sheet with language options.
   */
  async openLanguageActionSheet(): Promise<void> {
    const buttons: ActionSheetButton[] = this.availableLanguages.map(lang => ({
      text: lang.name,
      icon: this.currentLanguage() === lang.code ? 'checkmark-circle-outline' : undefined,
      handler: () => {
        this.selectLanguage(lang.code);
        return true;
      },
      data: { code: lang.code }
    }));

    // Add dismiss button
    const cancelText = await this.translateService.get('COMMON.BUTTONS.CANCEL').toPromise();
    const headerText = await this.translateService.get('COMMON.LANGUAGE').toPromise();
    
    buttons.push({
      text: cancelText,
      role: 'cancel',
      icon: 'close'
    } as ActionSheetButton);

    const actionSheet = await this.actionSheetController.create({
      header: headerText,
      buttons: buttons,
      cssClass: `language-switcher-${this.displayMode}`,
      animated: true,
      keyboardClose: true
    });

    await actionSheet.present();

    // Handle dismiss
    await actionSheet.onDidDismiss();
    this.isActionSheetOpen.set(false);
  }

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
  private async selectLanguage(languageCode: string): Promise<void> {
    if (languageCode !== this.currentLanguage()) {
      await this.languageService.setLanguage(languageCode);
      this.languageChanged.emit(languageCode);
    }
  }
}
