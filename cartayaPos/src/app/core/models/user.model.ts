/**
 * User Settings
 * Represents user-specific settings (language preferences, etc.)
 */
export interface UserSettings {
  language: string; // 'en' | 'es' | 'ca'
  // Future: theme, notifications, etc.
}

/**
 * User Model
 * Represents an authenticated user in the system
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  settings?: UserSettings; // Optional for backward compatibility
  createdAt: string;
  updatedAt: string;
}
