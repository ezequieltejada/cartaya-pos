import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Device } from '@capacitor/device';
import { IonApp, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonMenu, IonMenuToggle, IonRouterOutlet, IonTitle, IonToolbar, MenuController, Platform } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { cartOutline, checkmarkCircleOutline, close, closeCircleOutline, cloudUploadOutline, gridOutline, homeOutline, imageOutline, logOutOutline, menu, receiptOutline, settingsOutline } from 'ionicons/icons';
import { AuthService } from './core/services/auth.service';
import { LanguageService } from './core/services/language.service';
import { OrderQueueService } from './core/services/order-queue.service';
import { PosService } from './core/services/pos.service';
import { StorageService } from './core/services/storage.service';
import { SyncCoordinatorService } from './core/services/sync-coordinator.service';
import { TenantService } from './core/services/tenant.service';
import { LanguageSwitcherComponent } from './shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonMenuToggle, RouterLink, RouterLinkActive, TranslateModule, IonBadge, IonItemDivider, LanguageSwitcherComponent, IonButtons, IonButton],
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private platform = inject(Platform);
  private menuController = inject(MenuController);
  private storageService = inject(StorageService);
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private tenantService = inject(TenantService);
  private posService = inject(PosService);
  private syncCoordinator = inject(SyncCoordinatorService);
  queueService = inject(OrderQueueService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  constructor() {
    addIcons({ menu, imageOutline, cartOutline, checkmarkCircleOutline, logOutOutline, homeOutline, gridOutline, settingsOutline, closeCircleOutline, receiptOutline, cloudUploadOutline, close });
  }

  async ngOnInit() {
    // Wait for platform to be ready
    await this.platform.ready();

    // Initialize storage first (required by LanguageService)
    try {
      await this.storageService.init();
      await this.authService.loadTokensFromStorage();

      // After storage is initialized, restore tenant and PoS selections
      await this.tenantService.restoreSelectedTenant();
      await this.posService.restoreSelectedPos();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }

    // Initialize language on app startup (depends on StorageService)
    try {
      await this.languageService.init();
    } catch (error) {
      console.error('Failed to initialize language:', error);
      // Continue with app startup even if language init fails
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
    const language = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage;
    return language || null;
  }

  /**
   * Maps language codes to supported languages
   * Extracts the primary language code (e.g., 'es-MX' -> 'es')
   * Supported languages: ['en', 'es', 'ca']
   */
  private mapLanguageCode(languageCode: string): string {
    if (!languageCode) return 'en';

    // Extract primary language code (e.g., 'es' from 'es-MX')
    const primaryLanguage = languageCode.split('-')[0].toLowerCase();

    // Map to supported languages
    const supportedLanguages: { [key: string]: string } = {
      es: 'es',
      en: 'en',
      ca: 'ca',
    };

    return supportedLanguages[primaryLanguage] || 'en';
  }

  /**
   * Handle language change from LanguageSwitcher component
   * This method is called when the user selects a language from the menu
   * 
   * @param languageCode - The selected language code ('en', 'es', or 'ca')
   */
  onLanguageChanged(languageCode: string): void {
    console.log('Language changed to:', languageCode);
    // Optionally close menu after language change for better UX
    // this.menuController.close('main-menu');
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
    });
  }

  closeMenu() {
    this.menuController.close('main-menu');
  }
}
