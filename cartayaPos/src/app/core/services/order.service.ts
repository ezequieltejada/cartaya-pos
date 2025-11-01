import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    OrderItem,
    SelectedModifier
} from '../models/order.model';
import { Product } from '../models/product.model';
import { StorageService } from './storage.service';

/**
 * Response from order submission API
 */
interface SubmitOrderResponse {
  orderId: string;
  status: string;
  createdAt: string;
  items: Array<{
    productId: string;
    quantity: number;
    appliedModifiers?: Array<{
      modifierId: string;
      name: string;
      priceDelta: number;
    }>;
    lineTotal: number;
  }>;
  totalAmount: number;
  currency: string;
}

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

  private readonly API_URL = `${environment.apiUrl}/api`;
  private readonly STORAGE_KEY = 'currentOrder';

  // ===== Writable Signals =====

  /**
   * Current items in the order
   */
  readonly orderItems = signal<OrderItem[]>([]);

  /**
   * Order currency (from tenant/PoS settings)
   */
  readonly currency = signal<string>('USD');

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
      (sum, item) => sum + item.subtotal,
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

  constructor() {
    this.loadOrderFromStorage();
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

    // Create new order item
    const orderItem: OrderItem = {
      id: generateUUID(),
      productId: product.id,
      productName: product.name,
      basePrice,
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
    const updatedSubtotal = this.calculateSubtotal(item.basePrice, modifiers);

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
   * Calculates the subtotal for an order item
   * Formula: basePrice + Σ(modifier.priceDelta × modifier.quantity)
   * @param basePrice The base price of the product
   * @param modifiers Array of selected modifiers
   * @returns The calculated subtotal
   */
  private calculateSubtotal(
    basePrice: number,
    modifiers: SelectedModifier[]
  ): number {
    const modifiersTotal = modifiers.reduce((sum, mod) => {
      return sum + mod.priceDelta * mod.quantity;
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
          this.currency.set(state.currency || 'USD');
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
