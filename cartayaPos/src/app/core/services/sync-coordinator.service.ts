import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Platform } from '@ionic/angular';
import { Subscription, interval } from 'rxjs';
import { filter, throttleTime } from 'rxjs/operators';
import { NetworkService } from './network.service';
import { LoggerService } from './logger.service';
import { OrderQueueService, RetryResult } from './order-queue.service';

/**
 * Sync state interface
 * Tracks the current state of the synchronization process
 */
export interface SyncState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncResult: RetryResult | null;
}

/**
 * SyncCoordinator Service
 * Orchestrates automatic background retry of queued orders
 * Responds to network state changes and app lifecycle events
 *
 * Usage:
 * ```typescript
 * private syncCoordinator = inject(SyncCoordinatorService);
 *
 * ngOnInit() {
 *   this.syncCoordinator.initialize();
 * }
 *
 * ngOnDestroy() {
 *   this.syncCoordinator.destroy();
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class SyncCoordinatorService implements OnDestroy {
  private queueService = inject(OrderQueueService);
  private networkService = inject(NetworkService);
  private platform = inject(Platform);
  private readonly log = inject(LoggerService).scope('sync');

  // Writable signal for sync state
  private readonly _syncState = signal<SyncState>({
    isSyncing: false,
    lastSyncAt: null,
    lastSyncResult: null,
  });

  // Public readonly signal
  readonly syncState = this._syncState.asReadonly();

  private networkSubscription: Subscription | null = null;
  private appStateSubscription: Subscription | null = null;
  private periodicSyncSubscription: Subscription | null = null;
  private isInitialized = false;

  constructor() {
    // Auto-initialize after a delay to allow other services to load
    setTimeout(() => {
      if (!this.isInitialized) {
        this.initialize();
      }
    }, 1000);
  }

  /**
   * Initialize sync coordinator
   * Sets up network listeners and app state listeners
   */
  initialize(): void {
    if (this.isInitialized) {
      this.log.warn('SyncCoordinator already initialized');
      return;
    }

    this.isInitialized = true;
    this.log.trace('Initializing SyncCoordinator');

    // Listen for network state changes
    this.setupNetworkListener();

    // Listen for app lifecycle events (mobile only)
    if (this.platform.is('capacitor')) {
      this.setupAppStateListener();
    }

    // Set up periodic sync (every 5 minutes while online)
    this.setupPeriodicSync();

    // Initial sync if online and queue has items
    const pendingCount = this.queueService.pendingCount();
    const outOfSyncCount = this.queueService.outOfSyncCount();
    if (
      this.networkService.getIsOnline() &&
      (pendingCount > 0 || outOfSyncCount > 0)
    ) {
      this.syncQueue();
    }
  }

  /**
   * Clean up subscriptions
   */
  destroy(): void {
    this.networkSubscription?.unsubscribe();
    this.appStateSubscription?.unsubscribe();
    this.periodicSyncSubscription?.unsubscribe();
    this.isInitialized = false;
    this.log.trace('SyncCoordinator destroyed');
  }

  /**
   * Implementation of OnDestroy
   * Angular lifecycle hook for cleanup
   */
  ngOnDestroy(): void {
    this.destroy();
  }

  /**
   * Set up listener for network state changes
   * Triggers sync when going from offline → online
   */
  private setupNetworkListener(): void {
    this.networkSubscription = this.networkService
      .onNetworkChange()
      .pipe(
        // Only trigger on connected events
        filter((status) => status.connected),
        // Throttle to prevent rapid firing
        throttleTime(2000)
      )
      .subscribe((status) => {
        this.log.trace('Network restored, triggering sync', { connected: status.connected });
        this.syncQueue();
      });
  }

  /**
   * Set up listener for app lifecycle events (mobile)
   * Resumes sync when app returns to foreground
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = new Subscription();

    App.addListener('appStateChange', (state) => {
      if (state.isActive && this.networkService.getIsOnline()) {
        this.log.trace('App resumed to foreground, checking queue');
        // Only sync if queue has items
        const pendingCount = this.queueService.pendingCount();
        const outOfSyncCount = this.queueService.outOfSyncCount();
        if (pendingCount > 0 || outOfSyncCount > 0) {
          this.syncQueue();
        }
      }
    });
  }

  /**
   * Set up periodic sync every 5 minutes
   * Only runs when online and queue has pending items
   */
  private setupPeriodicSync(): void {
    this.periodicSyncSubscription = interval(5 * 60 * 1000) // 5 minutes
      .pipe(
        filter(() => this.networkService.getIsOnline()),
        filter(() => {
          const pendingCount = this.queueService.pendingCount();
          const outOfSyncCount = this.queueService.outOfSyncCount();
          return pendingCount > 0 || outOfSyncCount > 0;
        }),
        filter(() => !this._syncState().isSyncing) // Don't start if already syncing
      )
      .subscribe(() => {
        this.log.trace('Periodic sync triggered');
        this.syncQueue();
      });
  }

  /**
   * Trigger sync of queued orders
   * Main entry point for automatic retry
   */
  async syncQueue(): Promise<void> {
    // Don't sync if already syncing
    if (this._syncState().isSyncing) {
      this.log.trace('Sync already in progress, skipping');
      return;
    }

    // Don't sync if offline
    if (!this.networkService.getIsOnline()) {
      this.log.trace('Cannot sync: offline');
      return;
    }

    // Don't sync if queue is empty
    const pendingCount = this.queueService.pendingCount();
    const outOfSyncCount = this.queueService.outOfSyncCount();
    if (pendingCount === 0 && outOfSyncCount === 0) {
      this.log.trace('Queue is empty, nothing to sync');
      return;
    }

    this.log.trace('Starting queue sync');
    this._syncState.update((state) => ({
      ...state,
      isSyncing: true,
    }));

    try {
      const result = await this.queueService.processQueue();
      this.log.trace('Sync completed', { total: result.total, successful: result.successful, failed: result.failed });

      this._syncState.update(() => ({
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        lastSyncResult: result,
      }));
    } catch (error) {
      this.log.error('Sync failed', error);

      this._syncState.update(() => ({
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        lastSyncResult: {
          total: 0,
          successful: 0,
          failed: 0,
          errors: [{ queueId: 'unknown', error: 'Sync coordinator error' }],
        },
      }));
    }
  }

  /**
   * Manually trigger sync (for UI buttons)
   * Same as syncQueue but returns promise with result
   */
  async manualSync(): Promise<RetryResult> {
    await this.syncQueue();
    return (
      this._syncState().lastSyncResult || {
        total: 0,
        successful: 0,
        failed: 0,
        errors: [],
      }
    );
  }

  /**
   * Check if currently syncing
   */
  isSyncing(): boolean {
    return this._syncState().isSyncing;
  }

  /**
   * Get last sync result
   */
  getLastSyncResult(): RetryResult | null {
    return this._syncState().lastSyncResult;
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncAt(): string | null {
    return this._syncState().lastSyncAt;
  }
}
