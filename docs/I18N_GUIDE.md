# Internationalization (i18n) Developer Guide

## 1. Overview

The Cartaya POS application implements comprehensive internationalization (i18n) support using **ngx-translate** to enable multi-language support. This guide provides developers with the knowledge to add new languages, manage translation keys, and maintain the i18n system.

### Supported Languages

The application currently supports three languages:

- **English** (`en`) - Default language
- **Spanish** (`es`) - Español
- **Catalan** (`ca`) - Català

### Technology Stack

- **Framework:** Angular 20
- **i18n Library:** ngx-translate (for dynamic translation loading)
- **State Management:** Angular Signals (via LanguageState service)
- **Storage:** Ionic Storage (for persistence)
- **Backend Sync:** REST API integration (for user language preferences)

---

## 2. Architecture

### 2.1 High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   User Changes Language                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│           LanguageSwitcher Component                             │
│  - Displays available languages (EN, ES, CA)                    │
│  - Shows currently selected language with radio button          │
│  - Emits languageChanged event                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│           LanguageService.setLanguage()                          │
│  - Validates language code against SUPPORTED_LANGUAGES          │
│  - Updates TranslateService (loads translation JSON)            │
│  - Persists to Ionic Storage                                    │
│  - Updates LanguageState (reactive signals)                     │
│  - Triggers backend sync (fire-and-forget)                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬──────────────────┐
        │                 │                 │                  │
        ▼                 ▼                 ▼                  ▼
    TranslateService  StorageService   LanguageState    SettingsService
    (TranslatePipe &  (Ionic Storage)   (UI reactivity)  (Backend sync)
     TranslateService)
        │                 │                 │                  │
        └─────────────────┼─────────────────┴──────────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │   Update UI  │
                    │  All strings │
                    │ rerendered   │
                    └──────────────┘
```

### 2.2 Service Layer

#### LanguageService
**Location:** `src/app/core/services/language.service.ts`

Main coordinator service for language management:

- **`init()`** - Initialize language on app startup with fallback chain:
  1. Load from backend user settings (if authenticated)
  2. Load saved preference from Ionic Storage
  3. Detect browser/device language
  4. Fallback to 'en'

- **`setLanguage(languageCode: string)`** - Change the application language:
  1. Validate language code
  2. Update TranslateService (may load JSON)
  3. Persist to storage
  4. Update LanguageState
  5. Sync to backend (fire-and-forget)

- **`getCurrentLanguage(): string`** - Get current language code

- **`getAvailableLanguages(): Language[]`** - Get all supported languages

- **`isLanguageSupported(code: string): boolean`** - Check if language is supported

#### LanguageState
**Location:** `src/app/core/services/language-state.service.ts`

Signal-based reactive state management:

**Writable Signals:**
- `currentLanguage` - Current language code (default: 'en')
- `isLoading` - Loading state during language changes
- `isSynced` - Backend sync status
- `lastSyncError` - Last sync error (if any)

**Computed Signals:**
- `currentLanguageName` - Native language name (computed from code)
- `hasError` - Boolean indicator for error state

#### LanguageSwitcher Component
**Location:** `src/app/shared/components/language-switcher/`

Reusable UI component for language selection:

- Displays all supported languages
- Shows current language with radio button indicator
- Supports different display modes: menu, modal, popover
- Emits `languageChanged` event when user selects language
- Shows loading spinner during language change
- Keyboard accessible

### 2.3 Translation Files

**Location:** `src/assets/i18n/`

Translation JSON files organized by language code:

- `en.json` - English translations
- `es.json` - Spanish translations
- `ca.json` - Catalan translations

### 2.4 Language Model

**Location:** `src/app/core/models/language.model.ts`

```typescript
export interface Language {
  code: string;           // Language code (e.g., 'en', 'es', 'ca')
  name: string;           // Native name (e.g., "English", "Español", "Català")
  englishName: string;    // English name for reference
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', englishName: 'English' },
  { code: 'es', name: 'Español', englishName: 'Spanish' },
  { code: 'ca', name: 'Català', englishName: 'Catalan' }
];
```

---

## 3. Adding New Languages

### Step 1: Create Translation JSON File

Create a new JSON file in `src/assets/i18n/` following the exact structure of existing translation files.

**File:** `src/assets/i18n/fr.json` (example for French)

```json
{
  "COMMON": {
    "BUTTONS": {
      "CANCEL": "Annuler",
      "CONFIRM": "Confirmer",
      "SAVE": "Enregistrer"
    },
    "ERRORS": {
      "NETWORK": "Erreur réseau. Veuillez réessayer.",
      "GENERIC": "Une erreur s'est produite. Veuillez réessayer."
    },
    "LANGUAGE": "Langue"
  },
  "AUTH": {
    "LOGIN": {
      "TITLE": "Cartaya POS",
      "EMAIL_LABEL": "Email"
    }
  }
}
```

**Important:** Ensure all keys from existing languages are present. Use validation tests to verify completeness.

### Step 2: Update SUPPORTED_LANGUAGES Constant

**File:** `src/app/core/models/language.model.ts`

```typescript
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', englishName: 'English' },
  { code: 'es', name: 'Español', englishName: 'Spanish' },
  { code: 'ca', name: 'Català', englishName: 'Catalan' },
  { code: 'fr', name: 'Français', englishName: 'French' }  // NEW
];
```

### Step 3: Test Language Switching

1. Run the application: `npm start`
2. Navigate to Settings
3. Open Language Settings
4. Select the new language from the radio group
5. Verify all UI text updates to the new language

### Step 4: Run Translation Validation Tests

```bash
npm run lint
npm run test  # Ensure language validation tests pass
```

---

## 4. Adding New Translation Keys

### 4.1 Naming Convention

Translation keys follow a hierarchical naming convention using **UPPERCASE** with underscores:

```
FEATURE_SECTION_SUBSECTION_KEY
```

**Examples:**

- `COMMON.BUTTONS.CANCEL` - Common buttons, cancel button
- `COMMON.ERRORS.NETWORK` - Common errors, network error
- `AUTH.LOGIN.TITLE` - Auth feature, login section, title
- `PRODUCT_GRID.TITLE` - Product grid feature, title
- `MODIFIERS.ITEM_ADDED` - Modifiers feature, item added message

### 4.2 Key Organization Structure

Translation keys are organized by feature in the JSON:

```json
{
  "COMMON": { },           // Shared across entire app
  "AUTH": { },             // Authentication feature
  "POS_SELECTION": { },    // POS selection feature
  "PRODUCT_GRID": { },     // Product grid feature
  "MODIFIERS": { },        // Modifiers feature
  "ORDER_SUMMARY": { },    // Order summary feature
  "SETTINGS": { },         // Settings feature
  "MENU": { }              // Menu feature
}
```

### 4.3 Using TranslatePipe in Templates

Use the `translate` pipe for static text that doesn't need to change at runtime:

```html
<!-- Simple key -->
<h1>{{ 'COMMON.BUTTONS.CANCEL' | translate }}</h1>

<!-- Key with parameters -->
<p>{{ 'PRODUCT_GRID.PRODUCT_COUNT' | translate: { count: products.length } }}</p>

<!-- Nested in attributes -->
<button [title]="'COMMON.BUTTONS.SAVE' | translate">Save</button>
```

**Example in component:**

```html
<ion-header>
  <ion-toolbar>
    <ion-title>{{ 'PRODUCT_GRID.TITLE' | translate }}</ion-title>
  </ion-toolbar>
</ion-header>

<ion-list>
  <ion-item *ngFor="let product of products">
    <ion-label>{{ product.name }}</ion-label>
    <ion-note>{{ 'COMMON.PRICE_LABEL' | translate }}: {{ product.price }}</ion-note>
  </ion-item>
</ion-list>
```

### 4.4 Using TranslateService in TypeScript

Use `TranslateService` for dynamic translations that need to change at runtime:

```typescript
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';

export class MyComponent {
  private translate = inject(TranslateService);

  showSuccessMessage(): void {
    // Instant translation (synchronous)
    const message = this.translate.instant('COMMON.SUCCESS');
    this.toastController.create({ message }).then(toast => toast.present());
  }

  async showAsyncMessage(): Promise<void> {
    // Async translation (use when needed)
    const message = await this.translate.get('COMMON.SUCCESS').toPromise();
    console.log(message);
  }
}
```

### 4.5 Common Scenarios

#### Displaying Success Message

**Template:**
```html
<ion-toast
  [message]="'ORDER_SUMMARY.ORDER_COMPLETED' | translate"
  [isOpen]="showSuccess"
  [duration]="2000">
</ion-toast>
```

**Component:**
```typescript
async completeOrder(): Promise<void> {
  try {
    await this.orderService.complete();
    this.showSuccess = true;
    // Toast will display translated message automatically
  } catch (error) {
    console.error('Order failed:', error);
  }
}
```

#### Product Count with Parameter

**JSON:**
```json
{
  "PRODUCT_GRID": {
    "PRODUCT_COUNT": "Products: {count}"
  }
}
```

**Template:**
```html
<p>{{ 'PRODUCT_GRID.PRODUCT_COUNT' | translate: { count: products.length } }}</p>
```

#### Error Messages

**JSON:**
```json
{
  "COMMON": {
    "ERRORS": {
      "NETWORK": "Network error. Please try again.",
      "TIMEOUT": "Request timed out. Please try again.",
      "VALIDATION": "Please check your input and try again."
    }
  }
}
```

**Component:**
```typescript
async loadProducts(): Promise<void> {
  try {
    this.products = await this.productService.getAll();
  } catch (error) {
    const message = this.translate.instant('COMMON.ERRORS.NETWORK');
    this.showError(message);
  }
}
```

---

## 5. Translation Best Practices

### Keep Keys Organized by Feature

- Maintain clear feature-based hierarchy in JSON structure
- Group related keys together
- Use descriptive names that indicate content purpose
- Example: `MODIFIERS.SELECT_LABEL` instead of `MODIFIERS.TEXT`

### Use Parameters for Dynamic Content

Instead of concatenating strings, use parameters:

```json
{
  "PRODUCT_GRID": {
    "SEARCH_RESULTS": "Found {count} products for '{query}'"
  }
}
```

```html
{{ 'PRODUCT_GRID.SEARCH_RESULTS' | translate: { count: results.length, query: searchTerm } }}
```

### Handle Pluralization

Create separate keys for singular/plural:

```json
{
  "ORDER_SUMMARY": {
    "ITEMS_SINGULAR": "{count} item",
    "ITEMS_PLURAL": "{count} items"
  }
}
```

```typescript
getItemCountLabel(): string {
  const count = this.items.length;
  const key = count === 1 ? 'ORDER_SUMMARY.ITEMS_SINGULAR' : 'ORDER_SUMMARY.ITEMS_PLURAL';
  return this.translate.instant(key, { count });
}
```

### Test All Languages Before Committing

1. Switch to each language and test all UI text
2. Check for missing translations (console warnings)
3. Verify parameter replacements work correctly
4. Test edge cases (long text, special characters)

### Run Validation Tests

```bash
npm run lint      # Check linting issues
npm run test      # Run unit tests including i18n validation
```

---

## 6. Testing

### 6.1 Running Translation Validation Tests

The application includes automated tests to validate translation completeness:

```bash
npm run test
```

These tests verify:
- All translation keys are present in all languages
- No orphaned keys (keys in one language but not others)
- JSON structure is valid
- Parameter placeholders are consistent across languages

### 6.2 Manual Testing Checklist

Before committing i18n changes:

- [ ] All UI text displays in the selected language
- [ ] Language switcher component works (can change language)
- [ ] Persistence works (language persists after app restart)
- [ ] Backend sync works (language preference saves to user settings)
- [ ] No console warnings about missing translations
- [ ] Parameter replacements work correctly
- [ ] All supported languages tested
- [ ] Responsive design works in all languages

### 6.3 Common Issues and Solutions

#### Missing Translation Warnings in Console

**Symptom:** Console shows `Missing translation for key: SOME.KEY`

**Cause:** Translation key is used in template/component but not defined in JSON files

**Solution:**
1. Add the key to all translation JSON files
2. Run validation tests to catch this early
3. Check for typos in key names (case-sensitive)

#### Key Not Loading

**Symptom:** Template shows the key name instead of translated text

**Possible Causes:**
- TranslatePipe not imported in component
- TranslateModule not imported in component
- Language not set yet when component renders

**Solution:**
```typescript
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Component } from '@angular/core';

@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, TranslateModule],  // Must import
  template: `<p>{{ 'COMMON.HELLO' | translate }}</p>`
})
export class MyComponent {}
```

#### Language Not Changing in UI

**Symptom:** Selected language in switcher but UI doesn't update

**Possible Causes:**
- LanguageService not called when language changes
- Component not subscribed to language state
- TranslateService not actually changed

**Solution:**
```typescript
// In component, subscribe to language changes
ngOnInit(): void {
  // This will cause component to rerender when language changes
  this.currentLanguage = this.languageState.currentLanguage;
}
```

#### Backend Sync Failures

**Symptom:** Language changes locally but doesn't save to backend

**Possible Causes:**
- Network error during sync
- User not authenticated
- Backend settings endpoint unavailable

**Behavior:**
- Local storage is the source of truth (language persists locally)
- Sync failures are logged to console
- Application continues working (offline-capable)

**Solution:**
```typescript
// LanguageService handles sync failures gracefully
// No action needed - local preference is maintained
// Sync will retry on next app startup or language change
```

---

## 7. Backend Integration

### 7.1 User Language Preference API

**Endpoint:** `PATCH /api/users/me/settings`

**Request:**
```json
{
  "preferredLanguage": "es"
}
```

**Response:**
```json
{
  "preferredLanguage": "es",
  "theme": "light"
}
```

### 7.2 Sync Strategy

The application uses a **local-first, backend-backup** strategy:

1. **User selects language** → Saved immediately to Ionic Storage
2. **LanguageService syncs** → Sends preference to backend (fire-and-forget)
3. **App startup** → Loads from backend → Falls back to local storage
4. **Network failures** → Local storage ensures data persistence

**Benefits:**
- Works offline
- Fast local updates
- Backend acts as backup
- No blocking on network requests

### 7.3 Error Handling

Backend sync errors are handled gracefully:

```typescript
// LanguageService.setLanguage()
try {
  await this.syncWithBackend(targetLanguage);
  this.languageState.setSyncStatus(true);
} catch (error) {
  console.error('Backend sync failed:', error);
  this.languageState.setSyncStatus(false);
  // Continue - local storage is source of truth
}
```

---

## 8. Troubleshooting

### Missing Translation Warnings

**Problem:** Console shows warnings about missing translations

**Diagnosis:**
```bash
# Check for orphaned keys
npm run lint

# Look for keys in template that aren't in JSON
grep -r "translate:" src/ | grep -o "'[^']*'" | sort | uniq
```

**Resolution:**
1. Add missing keys to `en.json`
2. Translate to all other languages
3. Run validation tests

### Keys Not Loading

**Problem:** Template shows raw key instead of translation

**Diagnosis:**
1. Check browser console for errors
2. Verify TranslateModule is imported
3. Confirm TranslatePipe is used correctly

**Resolution:**
```typescript
// Ensure component imports TranslateModule
@Component({
  imports: [CommonModule, TranslateModule]
})
```

### Language Not Persisting

**Problem:** Language resets after app restart

**Diagnosis:**
1. Check if LanguageService.init() is called
2. Verify Ionic Storage is initialized
3. Check browser console for storage errors

**Resolution:**
- Ensure app initialization calls `LanguageService.init()`
- Check that Ionic Storage is properly configured

### Backend Sync Failures

**Problem:** Language preference not syncing to backend

**Diagnosis:**
1. Check network tab in DevTools
2. Verify API endpoint is responding
3. Check if user is authenticated

**Resolution:**
- Language will work offline - no action needed
- Check server logs for API errors
- Verify user session is valid

---

## 9. External Resources

- **ngx-translate Documentation:** https://github.com/ngx-translate/core
- **Angular i18n Guide:** https://angular.io/guide/i18n-overview
- **Ionic Internationalization:** https://ionicframework.com/docs/utilities/internationalization
- **IANA Language Tags:** https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
- **Translation File Format:** JSON structure follows standard ngx-translate format

---

## 10. Maintenance

### Regular Reviews

- **Quarterly:** Review all translation files for accuracy
- **Monthly:** Check for new untranslated keys in console logs
- **With each feature:** Ensure new text is translated to all languages

### Adding New Features

When implementing new features:

1. Create translation keys in `en.json` first
2. Add placeholder keys to `es.json` and `ca.json`
3. Get translations completed before code review
4. Run validation tests
5. Test language switching with new feature

### Documentation Updates

Update this guide when:
- Adding new languages
- Changing naming conventions
- Modifying sync strategy
- Discovering new best practices

---

## 11. Summary

The Cartaya POS i18n implementation provides a robust, maintainable system for managing multiple languages:

- **Easy to extend:** Adding new languages is straightforward
- **Performant:** Uses lazy loading of translation files
- **Offline-capable:** Local-first strategy ensures functionality without network
- **Type-safe:** TypeScript models prevent runtime errors
- **Well-tested:** Automated validation ensures consistency

For questions or issues, refer to the relevant section in this guide or check the component and service inline documentation.
