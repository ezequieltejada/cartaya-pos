/**
 * User Settings
 * Represents user-specific settings (language preferences, theme, etc.)
 * Synced with backend /api/users/me/settings endpoint
 */
export interface UserSettings {
  preferredLanguage?: string; // 'en' | 'es' | 'ca'
  theme?: string; // 'light' | 'dark'
  // Future: additional user preferences
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
