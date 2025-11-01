import { Component, OnInit } from '@angular/core';
import { Device } from '@capacitor/device';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, TranslateModule],
})
export class AppComponent implements OnInit {
  currentLanguage = 'en';

  constructor(private translate: TranslateService) {}

  async ngOnInit() {
    // Initialize the translation service with default language
    this.translate.setDefaultLang('en');

    // Get device or browser language
    const detectedLanguage = await this.getDetectedLanguage();
    this.translate.use(detectedLanguage);
    this.currentLanguage = detectedLanguage;
  }

  /**
   * Detects the device/browser language
   * Priority: Device language (Capacitor) > Browser language > Default (en)
   */
  private async getDetectedLanguage(): Promise<string> {
    try {
      // Try to get device language using Capacitor Device plugin
      const languageCodeResult = await Device.getLanguageCode();
      const deviceLanguage = languageCodeResult.value;
      
      if (deviceLanguage) {
        console.log('Device language detected:', deviceLanguage);
        // Map common language codes to supported languages (en, es)
        return this.mapLanguageCode(deviceLanguage);
      }
    } catch (error) {
      console.warn('Could not retrieve device language:', error);
    }

    // Fallback to browser language
    const browserLanguage = this.getBrowserLanguage();
    if (browserLanguage) {
      console.log('Browser language detected:', browserLanguage);
      return this.mapLanguageCode(browserLanguage);
    }

    // Default to English
    console.log('Using default language: en');
    return 'en';
  }

  /**
   * Gets the browser language using navigator API
   */
  private getBrowserLanguage(): string | null {
    const language = navigator.language || (navigator as any).userLanguage;
    return language || null;
  }

  /**
   * Maps language codes to supported languages
   * Extracts the primary language code (e.g., 'es-MX' -> 'es')
   */
  private mapLanguageCode(languageCode: string): string {
    if (!languageCode) return 'en';

    // Extract primary language code (e.g., 'es' from 'es-MX')
    const primaryLanguage = languageCode.split('-')[0].toLowerCase();

    // Map to supported languages
    const supportedLanguages: { [key: string]: string } = {
      'es': 'es',
      'en': 'en',
      // Add more mappings as needed (e.g., 'fr': 'fr', 'de': 'de')
    };

    return supportedLanguages[primaryLanguage] || 'en';
  }

  switchLanguage(language: string) {
    this.translate.use(language);
    this.currentLanguage = language;
  }
}
