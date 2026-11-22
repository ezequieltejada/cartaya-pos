import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { FormatMoneyOptions, formatMoney, localeForLanguage } from '../utils/money';
import { SettingsService } from './settings.service';

/**
 * MoneyService
 * Formats amounts with the tenant's currency (SettingsService) and the current
 * UI language. This is the only place screens should use to render prices.
 */
@Injectable({ providedIn: 'root' })
export class MoneyService {
  private settingsService = inject(SettingsService);
  private translate = inject(TranslateService);

  /** Format an amount in the tenant's currency. */
  format(amount: number | null | undefined, options: FormatMoneyOptions = {}): string {
    return formatMoney(
      amount,
      this.settingsService.currency(),
      localeForLanguage(this.translate.currentLang),
      options
    );
  }
}
