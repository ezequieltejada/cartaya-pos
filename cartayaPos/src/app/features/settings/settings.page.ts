import { Component, inject, OnDestroy } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { bluetoothOutline, checkmarkCircle, closeCircleOutline, radioButtonOff, radioButtonOn } from 'ionicons/icons';
import { Printer } from '../../services/printer';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * Settings: language and printer pairing.
 * The template talks to the Printer service directly; the persisted printer is already
 * restored at app start (AppComponent), so this page only needs to clean up on leave.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslateModule, IonContent, IonButton, IonIcon, IonSpinner, PageHeaderComponent, LanguageSwitcherComponent],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnDestroy {
  protected readonly printerService = inject(Printer);

  constructor() {
    addIcons({ bluetoothOutline, checkmarkCircle, closeCircleOutline, radioButtonOn, radioButtonOff });
  }

  ngOnDestroy(): void {
    // Stops scanning and clears the discovered list. The connection itself persists across pages.
    this.printerService.cleanup();
  }
}
