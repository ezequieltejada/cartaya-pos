import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkService } from './network.service';

/**
 * IndexedDB Schema Interface
 * Defines the database structure with object stores and indexes
 */
interface QueueDB extends DBSchema {
  'order-queue': {
    key: string;
    value: QueuedOrder;
    indexes: {
      'by-status': string;
      'by-created-at': string;
      'by-pos': string;
    };
  };
}

/**
 * Represents a single item in an order
 */
export interface OrderItem {
  productId: string;
  quantity: number;
  modifiers: Array<{
    modifierId: string;
    quantity: number;
  }>;
}

/**
 * Order payload - the full HTTP request body
 */
export interface OrderPayload {
  items: OrderItem[];
  totalAmount: number;
  currency: string;
}

/**
 * Queue entry for a single order
 * Persisted in IndexedDB
 */
export interface QueuedOrder {
  id: string;
  orderId: string | null;
  posId: string;
  tenantId: string;
  payload: OrderPayload;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'synced' | 'out-of-sync';
  createdAt: string;
  lastAttemptAt: string | null;
  error: string | null;
  metadata?: {
    orderNumber?: string;
    total?: number;
    itemCount?: number;
  };
}

/**
 * Result from processing the queue
 */
export interface RetryResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ queueId: string; error: string }>;
}

/**
 * OrderQueueService
 * Manages a persistent queue of orders using IndexedDB
 * Implements retry logic with exponential backoff
 * Tracks retry counts and order sync status
 *
 * Usage:
 * ```typescript
 * constructor(private queueService: OrderQueueService) {}
 *
 * // Enqueue an order
 * const queueId = await this.queueService.enqueue(payload, posId, tenantId);
 *
 * // Process all pending orders
 * const result = await this.queueService.processQueue();
 *
 * // Watch queue state
 * queueCount = this.queueService.pendingCount;
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class OrderQueueService {
  private httpClient = inject(HttpClient);
  private networkService = inject(NetworkService);

  private readonly API_URL = `${environment.apiUrl}/api`;
  private readonly DB_NAME = 'cartaya-pos-queue';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'order-queue';
  private readonly MAX_RETRIES = 10;

  private db: IDBPDatabase<QueueDB> | null = null;

  // Writable signal for queued orders (internal state)
  private readonly _queuedOrders = signal<QueuedOrder[]>([]);

  // Public readonly signals for reactive updates
  readonly queuedOrders = this._queuedOrders.asReadonly();

  // Computed signals for derived state
  readonly pendingCount: Signal<number> = computed(() =>
    this._queuedOrders().filter(
      (o) => o.status === 'pending' || o.status === 'syncing'
    ).length
  );

  readonly outOfSyncCount: Signal<number> = computed(() =>
    this._queuedOrders().filter((o) => o.status === 'out-of-sync').length
  );

  readonly totalQueueSize: Signal<number> = computed(() =>
    this._queuedOrders().length
  );

  constructor() {
    this.initializeDatabase();
  }

  /**
   * Initialize IndexedDB database
   * Creates schema with indexes for querying
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.db = await openDB<QueueDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db: any) {
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains('order-queue')) {
            const store = db.createObjectStore('order-queue', { keyPath: 'id' });

            // Create indexes for efficient querying
            store.createIndex('by-status', 'status');
            store.createIndex('by-created-at', 'createdAt');
            store.createIndex('by-pos', 'posId');
          }
        },
      });

      // Load initial queue state from IndexedDB
      await this.loadQueue();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw new Error('Queue storage initialization failed');
    }
  }

  /**
   * Load queue from IndexedDB into signal state
   * Called during service initialization
   */
  private async loadQueue(): Promise<void> {
    if (!this.db) return;

    try {
      const orders = await this.db.getAll(this.STORE_NAME);
      this._queuedOrders.set(orders);
      console.log(`Loaded ${orders.length} orders from queue`);
    } catch (error) {
      console.error('Failed to load queue from IndexedDB:', error);
    }
  }

  /**
   * Enqueue a new order
   * Adds order to IndexedDB and updates signal state
   *
   * @param payload Order payload from failed HTTP request
   * @param posId Point of Sale ID
   * @param tenantId Tenant ID
   * @param metadata Optional metadata for display
   * @returns Queue entry ID
   */
  async enqueue(
    payload: OrderPayload,
    posId: string,
    tenantId: string,
    metadata?: { orderNumber?: string; total?: number; itemCount?: number }
  ): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const queueEntry: QueuedOrder = {
      id: this.generateId(),
      orderId: null,
      posId,
      tenantId,
      payload,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastAttemptAt: null,
      error: null,
      metadata,
    };

    try {
      // Save to IndexedDB
      await this.db.add(this.STORE_NAME, queueEntry);

      // Update signal state
      this._queuedOrders.set([...this._queuedOrders(), queueEntry]);

      console.log(`Order queued: ${queueEntry.id}`);
      return queueEntry.id;
    } catch (error) {
      console.error('Failed to enqueue order:', error);
      throw error;
    }
  }

  /**
   * Process the entire queue
   * Attempts to sync all pending/out-of-sync orders
   *
   * @returns RetryResult with summary of retry attempts
   */
  async processQueue(): Promise<RetryResult> {
    if (!this.networkService.getIsOnline()) {
      console.log('Cannot process queue: offline');
      return { total: 0, successful: 0, failed: 0, errors: [] };
    }

    const pendingOrders = this._queuedOrders().filter(
      (o) => o.status === 'pending' || o.status === 'out-of-sync'
    );

    const result: RetryResult = {
      total: pendingOrders.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const order of pendingOrders) {
      try {
        const success = await this.retryOne(order.id);
        if (success) {
          result.successful++;
        } else {
          result.failed++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          queueId: order.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Retry a single queued order
   * Attempts to POST order to backend
   * Implements retry logic with exponential backoff on failure
   *
   * @param queueId Queue entry ID
   * @returns True if successful, false otherwise
   */
  async retryOne(queueId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const order = this._queuedOrders().find((o) => o.id === queueId);
    if (!order) {
      throw new Error(`Queue entry not found: ${queueId}`);
    }

    // Update status to syncing
    await this.updateOrderStatus(queueId, 'syncing');

    try {
      // Attempt to POST order to backend
      const url = `${this.API_URL}/tenants/${order.tenantId}/pos/${order.posId}/orders`;
      const response = await firstValueFrom(
        this.httpClient.post<{ orderId: string }>(url, order.payload)
      );

      // Success! Remove from queue
      await this.remove(queueId);
      console.log(`Order synced successfully: ${queueId}`);
      return true;
    } catch (error) {
      // Retry failed
      const newRetryCount = order.retryCount + 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (newRetryCount >= order.maxRetries) {
        // Max retries reached - mark as out-of-sync
        await this.updateOrder(queueId, {
          status: 'out-of-sync',
          retryCount: newRetryCount,
          lastAttemptAt: new Date().toISOString(),
          error: errorMessage,
        });
        console.warn(
          `Order out of sync after ${newRetryCount} attempts: ${queueId}`
        );
      } else {
        // Update retry count and error, keep as pending
        await this.updateOrder(queueId, {
          status: 'pending',
          retryCount: newRetryCount,
          lastAttemptAt: new Date().toISOString(),
          error: errorMessage,
        });

        // Schedule next retry with exponential backoff
        this.scheduleRetry(queueId, newRetryCount);
      }

      console.error(
        `Order retry failed (${newRetryCount}/${order.maxRetries}):`,
        error
      );
      return false;
    }
  }

  /**
   * Schedule next retry with exponential backoff
   * Calculates delay based on retry count: 1s, 2s, 4s, 8s, 16s (capped)
   *
   * @param queueId Queue entry ID
   * @param retryCount Current retry count
   */
  private scheduleRetry(queueId: string, retryCount: number): void {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
    const baseDelay = 1000; // 1 second
    const maxDelay = 16000; // 16 seconds
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);

    console.log(`Scheduling retry for ${queueId} in ${delay}ms`);

    setTimeout(() => {
      this.retryOne(queueId).catch((err) => {
        console.error('Scheduled retry failed:', err);
      });
    }, delay);
  }

  /**
   * Manually retry all queued orders (including out-of-sync)
   * Resets retry counts for out-of-sync orders and processes queue
   *
   * @returns RetryResult with summary of retry attempts
   */
  async retryAll(): Promise<RetryResult> {
    // Reset retry counts for out-of-sync orders
    const outOfSyncOrders = this._queuedOrders().filter(
      (o) => o.status === 'out-of-sync'
    );
    for (const order of outOfSyncOrders) {
      await this.updateOrder(order.id, {
        status: 'pending',
        retryCount: 0,
        error: null,
      });
    }

    return this.processQueue();
  }

  /**
   * Remove an order from the queue
   * Deletes from IndexedDB and updates signal state
   *
   * @param queueId Queue entry ID
   */
  async remove(queueId: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.delete(this.STORE_NAME, queueId);

      // Update signal state
      this._queuedOrders.set(this._queuedOrders().filter((o) => o.id !== queueId));
    } catch (error) {
      console.error('Failed to remove from queue:', error);
      throw error;
    }
  }

  /**
   * Update order status in queue
   * Internal helper for updating a single field
   *
   * @param queueId Queue entry ID
   * @param status New status
   */
  private async updateOrderStatus(
    queueId: string,
    status: QueuedOrder['status']
  ): Promise<void> {
    await this.updateOrder(queueId, { status });
  }

  /**
   * Update order fields in queue
   * Merges partial updates with existing order data
   *
   * @param queueId Queue entry ID
   * @param updates Partial order updates
   */
  private async updateOrder(
    queueId: string,
    updates: Partial<QueuedOrder>
  ): Promise<void> {
    if (!this.db) return;

    const order = await this.db.get(this.STORE_NAME, queueId);
    if (!order) {
      throw new Error(`Queue entry not found: ${queueId}`);
    }

    const updatedOrder = { ...order, ...updates };
    await this.db.put(this.STORE_NAME, updatedOrder);

    // Update signal state
    this._queuedOrders.set(
      this._queuedOrders().map((o) => (o.id === queueId ? updatedOrder : o))
    );
  }

  /**
   * Get queue entry by ID
   *
   * @param queueId Queue entry ID
   * @returns Queue entry or undefined if not found
   */
  getQueueEntry(queueId: string): QueuedOrder | undefined {
    return this._queuedOrders().find((o) => o.id === queueId);
  }

  /**
   * Clear entire queue
   * Removes all entries from IndexedDB and resets signal state
   */
  async clearQueue(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.clear(this.STORE_NAME);
      this._queuedOrders.set([]);
      console.log('Queue cleared');
    } catch (error) {
      console.error('Failed to clear queue:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID for queue entries
   * Uses timestamp and random string for uniqueness
   *
   * @returns Unique queue entry ID
   */
  private generateId(): string {
    return `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
