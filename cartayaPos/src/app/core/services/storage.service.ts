import { Injectable, inject } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

/**
 * Type-safe wrapper around Ionic Storage
 * Provides unified API for persisting/retrieving app state
 * Uses SQLite driver on mobile, localStorage on web
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private initialized = false;
  private storage = inject(Storage);

  /**
   * Initialize Ionic Storage
   * Must be called once during app initialization
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.storage.create();
    this.initialized = true;
  }

  /**
   * Set a value in storage
   * @param key Storage key
   * @param value Value to store
   */
  async set<T>(key: string, value: T): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized. Call init() first.');
    }
    await this.storage.set(key, JSON.stringify(value));
  }

  /**
   * Get a value from storage
   * @param key Storage key
   * @returns Parsed value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized. Call init() first.');
    }
    const value = await this.storage.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch (e) {
      console.error(`Failed to parse stored value for key ${key}:`, e);
      return null;
    }
  }

  /**
   * Remove a value from storage
   * @param key Storage key
   */
  async remove(key: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized. Call init() first.');
    }
    await this.storage.remove(key);
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized. Call init() first.');
    }
    await this.storage.clear();
  }
}
