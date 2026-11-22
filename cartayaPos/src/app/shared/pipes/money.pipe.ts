import { Pipe, PipeTransform, inject } from '@angular/core';
import { MoneyService } from '../../core/services/money.service';

/**
 * `{{ amount | money }}` renders an amount in the tenant's currency.
 * Impure so it follows currency / language changes.
 */
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private money = inject(MoneyService);

  transform(amount: number | null | undefined, signed = false): string {
    return this.money.format(amount, { signed });
  }
}
