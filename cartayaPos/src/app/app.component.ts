import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Device } from '@capacitor/device';
import { IonApp, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonMenuToggle, IonRouterOutlet, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { cartOutline, checkmarkCircleOutline, closeCircleOutline, gridOutline, homeOutline, imageOutline, logOutOutline, menu, receiptOutline, settingsOutline } from 'ionicons/icons';
import { AuthService } from './core/services/auth.service';
import { PosService } from './core/services/pos.service';
import { StorageService } from './core/services/storage.service';
import { SyncCoordinatorService } from './core/services/sync-coordinator.service';
import { TenantService } from './core/services/tenant.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonMenuToggle, RouterLink, RouterLinkActive, TranslateModule],
})
export class AppComponent implements OnInit, OnDestroy {
  private storageService = inject(StorageService);
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);
  private posService = inject(PosService);
  private syncCoordinator = inject(SyncCoordinatorService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  currentLanguage = 'en';

  constructor() {
    addIcons({ menu, imageOutline, cartOutline, checkmarkCircleOutline, logOutOutline, homeOutline, gridOutline, settingsOutline, closeCircleOutline, receiptOutline });
  }

  async ngOnInit() {
    // Initialize storage first
    try {
      await this.storageService.init();
      
      // After storage is initialized, restore tenant and PoS selections
      await this.tenantService.restoreSelectedTenant();
      await this.posService.restoreSelectedPos();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }

    // Initialize SyncCoordinator
    this.syncCoordinator.initialize();

    // Check for existing session
    this.authService.checkSession().subscribe({
      next: (user) => {
        if (user) {
          // User has valid session, navigate to products
          this.router.navigate(['/products']);
        } else {
          // No session, navigate to login
          this.router.navigate(['/auth/login']);
        }
      },
      error: () => {
        // Error checking session, navigate to login
        this.router.navigate(['/auth/login']);
      },
    });

    // Initialize the translation service with default language
    this.translate.setDefaultLang('en');

    // Get device or browser language
    const detectedLanguage = await this.getDetectedLanguage();
    this.translate.use(detectedLanguage);
    this.currentLanguage = detectedLanguage;
  }

  /**
   * Clean up on component destruction
   * Destroys the SyncCoordinator service
   */
  ngOnDestroy(): void {
    this.syncCoordinator.destroy();
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
      es: 'es',
      en: 'en',
      // Add more mappings as needed (e.g., 'fr': 'fr', 'de': 'de')
    };

    return supportedLanguages[primaryLanguage] || 'en';
  }

  switchLanguage(language: string) {
    this.translate.use(language);
    this.currentLanguage = language;
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
    });
  }
}
