import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  OrderItem,
  SelectedModifier,
  SubmitOrderResponse
} from '../../models/order.model';
import { Product } from '../models/product.model';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

/**
 * Stored order state in local storage
 */
interface StoredOrderState {
  items: OrderItem[];
  currency: string;
  timestamp: number;
}

/**
 * Generates a UUID v4 using crypto.getRandomValues
 * Fallback for environments without uuid library
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: pseudo-UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * OrderService
 * Manages order state and operations using Angular Signals
 * Responsible for adding/removing/updating items, calculating totals,
 * persisting to local storage, and submitting orders via API
 */
@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private httpClient = inject(HttpClient);
  private storageService = inject(StorageService);
  private settingsService = inject(SettingsService);

  private readonly API_URL = `${environment.apiUrl}/api`;
  private readonly STORAGE_KEY = 'currentOrder';

  // ===== Writable Signals =====

  /**
   * Current items in the order
   */
  readonly orderItems = signal<OrderItem[]>([]);

  /**
   * Order currency - derived from tenant settings
   * Falls back to 'USD' if tenant currency is not available
   */
  readonly currency = computed(() => {
    return this.settingsService.getCurrentCurrency();
  });

  /**
   * Loading state during order submission
   */
  readonly isSubmitting = signal<boolean>(false);

  // ===== Computed Signals =====

  /**
   * Computed total of all items in the order
   * Formula: Σ(item.subtotal) for all items
   */
  readonly orderTotal = computed(() => {
    return this.orderItems().reduce(
      (sum, item) => sum + (item.subtotal ?? 0),
      0
    );
  });

  /**
   * Computed total number of items in order
   */
  readonly itemCount = computed(() => {
    return this.orderItems().length;
  });

  /**
   * Computed flag indicating if order has any items
   */
  readonly hasItems = computed(() => {
    return this.orderItems().length > 0;
  });

  private isInitialized = false;

  constructor() {
    // Defer storage loading to allow StorageService to initialize first
    // This is called automatically after app initialization
    setTimeout(() => {
      if (!this.isInitialized) {
        this.loadOrderFromStorage();
        this.isInitialized = true;
      }
    }, 0);
  }

  /**
   * Adds a configured product with selected modifiers to the current order
   * @param product The base product being ordered
   * @param modifiers Array of selected modifiers with quantities
   */
  addConfiguredProduct(product: Product, modifiers: SelectedModifier[]): void {
    // Validate product
    if (!product.id || !product.name || product.defaultPrice?.amount === undefined) {
      console.error('Invalid product: missing required fields', product);
      return;
    }

    // Calculate subtotal
    const basePrice = product.defaultPrice.amount;
    const subtotal = this.calculateSubtotal(basePrice, modifiers);

    // Create new order item - quantity is 1 for each line item in MVP
    const orderItem: OrderItem = {
      id: generateUUID(),
      productId: product.id,
      productName: product.name,
      basePrice,
      quantity: 1,
      modifiers,
      subtotal,
    };

    // Update signal by appending new item
    this.orderItems.set([...this.orderItems(), orderItem]);

    // Persist to storage
    this.saveOrderToStorage();
  }

  /**
   * Removes an item from the current order by its ID
   * @param itemId The ID of the item to remove
   */
  removeItem(itemId: string): void {
    const filtered = this.orderItems().filter((item) => item.id !== itemId);
    this.orderItems.set(filtered);

    // Clear storage if order is empty
    if (filtered.length === 0) {
      this.removeOrderFromStorage();
    } else {
      this.saveOrderToStorage();
    }
  }

  /**
   * Updates the modifiers for an existing order item
   * @param itemId The ID of the item to update
   * @param modifiers The new modifiers to apply
   */
  updateItemModifiers(itemId: string, modifiers: SelectedModifier[]): void {
    const items = this.orderItems();
    const itemIndex = items.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      console.error(`Item with id ${itemId} not found`);
      return;
    }

    const item = items[itemIndex];
    const updatedSubtotal = this.calculateSubtotal(item.basePrice ?? 0, modifiers);

    // Create new array with updated item
    const updatedItems = [
      ...items.slice(0, itemIndex),
      {
        ...item,
        modifiers,
        subtotal: updatedSubtotal,
      },
      ...items.slice(itemIndex + 1),
    ];

    this.orderItems.set(updatedItems);
    this.saveOrderToStorage();
  }

  /**
   * Clears all items from the current order
   */
  clearOrder(): void {
    this.orderItems.set([]);
    this.removeOrderFromStorage();
  }

  /**
   * Submits the current order to the backend API
   * @param posId Current point of sale ID
   * @param tenantId Current tenant ID
   * @returns Observable with the order submission response
   */
  submitOrder(
    posId: string,
    tenantId: string
  ): Observable<SubmitOrderResponse> {
    this.isSubmitting.set(true);

    // Construct API payload
    const payload = {
      items: this.orderItems().map((item) => ({
        productId: item.productId,
        quantity: 1, // For MVP, each item is quantity 1
        modifiers: item.modifiers.map((m) => ({
          modifierId: m.modifierId,
          quantity: m.quantity,
        })),
      })),
      totalAmount: this.orderTotal(),
      currency: this.currency(),
    };

    const url = `${this.API_URL}/tenants/${tenantId}/pos/${posId}/orders`;

    return this.httpClient.post<SubmitOrderResponse>(url, payload).pipe(
      tap(() => {
        // On success, clear order
        this.clearOrder();
      }),
      catchError((error) => {
        console.error('Order submission failed:', error);
        throw error;
      }),
      finalize(() => {
        // Always set submitting to false
        this.isSubmitting.set(false);
      })
    );
  }

  // ===== Private Helper Methods =====

  /**
   * Calculates the subtotal for an order item with includedQuantity support
   * 
   * Formula: subtotal = basePrice + Σ(charge for each modifier)
   * 
   * For each modifier:
   *   billableQuantity = max(0, selectedQuantity - includedQuantity)
   *   charge = billableQuantity × priceDelta
   * 
   * The includedQuantity field allows for "bundled" quantities where customers
   * only pay for quantities exceeding the included amount. This is useful for
   * promotions like "first 2 sauces free, $0.50 each after".
   * 
   * @param basePrice - The base price of the product (without modifiers)
   * @param modifiers - Array of selected modifiers with quantities
   *   Each modifier contains:
   *   - quantity: Number of items selected by user
   *   - includedQuantity: Number of items included in base price (defaults to 0 if undefined)
   *   - priceDelta: Price per unit of this modifier
   * @returns The calculated subtotal including all modifiers
   * 
   * @example
   * // Product: Burger ($10.00)
   * // Modifier: Extra Cheese (+$1.00, includedQuantity=2, selected=3)
   * const subtotal = calculateSubtotal(10.00, [{
   *   modifierId: 'mod-1',
   *   name: 'Extra Cheese',
   *   priceDelta: 1.00,
   *   quantity: 3,
   *   includedQuantity: 2  // First 2 included in base price
   * }]);
   * 
   * // Calculation:
   * // billableQuantity = max(0, 3 - 2) = 1
   * // charge = $1.00 × 1 = $1.00
   * // subtotal = $10.00 + $1.00 = $11.00
   * 
   * @example
   * // Edge case: selectedQuantity <= includedQuantity
   * const subtotal = calculateSubtotal(10.00, [{
   *   quantity: 2,
   *   includedQuantity: 2,
   *   priceDelta: 1.00
   * }]);
   * // billableQuantity = max(0, 2 - 2) = 0 → NO CHARGE
   * // subtotal = $10.00 (all included in base price)
   */
  private calculateSubtotal(
    basePrice: number,
    modifiers: SelectedModifier[]
  ): number {
    const modifiersTotal = modifiers.reduce((sum, mod) => {
      const includedQuantity = mod.includedQuantity ?? 0;
      const billableQuantity = Math.max(0, mod.quantity - includedQuantity);
      return sum + mod.priceDelta * billableQuantity;
    }, 0);
    return basePrice + modifiersTotal;
  }

  /**
   * Saves the current order state to local storage
   */
  private saveOrderToStorage(): void {
    const state: StoredOrderState = {
      items: this.orderItems(),
      currency: this.currency(),
      timestamp: Date.now(),
    };

    this.storageService
      .set(this.STORAGE_KEY, state)
      .catch((error) => {
        console.error('Failed to save order to storage:', error);
        // Graceful degradation - don't throw
      });
  }

  /**
   * Loads the order state from local storage
   */
  private loadOrderFromStorage(): void {
    this.storageService
      .get<StoredOrderState>(this.STORAGE_KEY)
      .then((state) => {
        if (state && state.items && state.items.length > 0) {
          this.orderItems.set(state.items);
          // Note: currency is now derived from tenant settings, not from storage
          // The currency stored in state is ignored in favor of current tenant settings
        }
      })
      .catch((error) => {
        console.error('Failed to load order from storage:', error);
        // Graceful degradation - initialize with empty order
      });
  }

  /**
   * Removes the order from local storage
   */
  private removeOrderFromStorage(): void {
    this.storageService
      .remove(this.STORAGE_KEY)
      .catch((error) => {
        console.error('Failed to remove order from storage:', error);
        // Graceful degradation - don't throw
      });
  }
}
