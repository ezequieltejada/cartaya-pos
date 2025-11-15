/**
 * Language model for i18n support
 */

export interface Language {
  code: string;
  name: string;        // Native name (e.g., "English", "Español", "Català")
  englishName: string; // English name for reference
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', englishName: 'English' },
  { code: 'es', name: 'Español', englishName: 'Spanish' },
  { code: 'ca', name: 'Català', englishName: 'Catalan' }
];
