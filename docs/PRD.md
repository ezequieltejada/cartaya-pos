# 🧾 Product Requirements Document (PRD)

**Product Name:** Carta Ya - PoS
**Version:** MVP 1.0
**Platform:** Ionic Framework (v7) + Angular (v20)
**Purpose:** Hybrid Point of Sale mobile app for employees to take and cash orders efficiently.

---

## 1. Goal

Allow business employees to log in, select their assigned Point of Sale (PoS), and manage customer orders through a simple and fast mobile interface integrated with the backend and Bluetooth printer.

---

## 2. User Roles

* **Employee:** The main user of the app, assigned to a **Business** and one or more **PoS**.
* **Owner (future scope):** Manages employees, businesses, and products. *(Not part of MVP)*

---

## 3. Core User Flow

1. **Login** → Authenticate user via backend.
2. **Select PoS** → List PoS assigned to employee.
3. **Fetch Data** → Once PoS is selected:

   * Fetch **products** and **modifiers** from backend.
   * Cache locally for offline support (optional post-MVP).
4. **Take Order** →

   * Display **product grid** with name, image, base price.
   * Tap product → open **modifiers screen** (if any).
   * Adjust modifier quantities (+ / –) and confirm selection.
   * Add configured product to **current order list**.
5. **Review Order** → Persistent bottom sheet or right drawer:

   * Show ordered items, subtotal, total.
   * Buttons: **Cancel Order** / **Cash Order**.
6. **Order Completion** →

   * On Cancel → Clear order and return to product grid.
   * On Cash → Send order to backend, print receipt (via Bluetooth), and reset state.

---

## 4. Features & Requirements

### 4.1 Authentication

* **Login via email/password.**
* Token-based authentication (JWT).
* Persist session until logout or token expiration.

### 4.2 PoS Selection

* Fetch available PoS for logged-in employee.
* UI: simple list or card view.
* Store current PoS ID in app state.

### 4.3 Product Catalog

* Fetch all products for selected PoS.
* Grid view layout (responsive, paginated if >50 items).
* Text filter: Input field to filter products by name, updating the grid in real-time.
* Each product card:

  * Name
  * Base price
  * Image (if available)

### 4.4 Modifiers System

* Fetched once at PoS selection.
* When a product has modifiers:

  * Navigate to modifiers screen.
  * Each row:

    * **–** button | **Modifier Name + Price** | **+** button
  * Floating Action Button (FAB): “Confirm”
  * “Back” option to return to product grid.
* Allow multiple modifiers with quantities.

### 4.5 Order Management

* Current order always visible (side panel or bottom sheet).
* Each item:

  * Product name
  * Modifiers (summary)
  * Quantity, subtotal
  * Remove button to delete item from order
  * Edit button to modify modifiers last time
* Actions:

  * **Cancel Order**: Clears state, resets view.
  * **Cash Order**:

    * POST order to backend
    * Print receipt via Bluetooth printer
    * Reset UI

### 4.6 Bluetooth Printer Settings

* Separate **Settings Page**

  * List available Bluetooth printers.
  * “Connect” / “Disconnect” buttons.
  * Show current connection status.
* Logic for Bluetooth connection already implemented — only UI integration required.

---

## 5. Backend Interactions

| Function         | Method | Endpoint              | Notes                                     |
| ---------------- | ------ | --------------------- | ----------------------------------------- |
| Login            | POST   | `/auth/login`         | Returns JWT                               |
| Get Assigned PoS | GET    | `/employee/{id}/pos`  | List PoS                                  |
| Get Products     | GET    | `/pos/{id}/products`  | Includes base data                        |
| Get Modifiers    | GET    | `/pos/{id}/modifiers` | All modifier options                      |
| Create Order     | POST   | `/orders`             | Payload includes PoS, products, modifiers |

---

## 6. Technical Notes

* **App State:** Use a service with Angular Signals (only stable Angular APIs), not NgRx (for now).
* **Caching:** Products/modifiers stored in local storage for faster load.
* **Printer:** Expose existing service via `PrinterService` injectable.
* **Error Handling:** Network failure fallback → show retry modal.
* **UI Components:**

  * Ionic Grid for products
  * Ionic List for modifiers
  * Ionic Modal/Sheet for order summary

---

## 7. UX Wireframe Summary

1. **Login Screen**
2. **PoS Selection Screen**
3. **Product Grid Screen**
4. **Modifiers Modal**
5. **Order Summary Panel (persistent)**
6. **Settings Page → Printer Connection**

---

## 8. Success Criteria (MVP)

* ✅ User can log in and select PoS
* ✅ Products + modifiers are fetched and displayed
* ✅ Orders can be created, canceled, and cashed
* ✅ Printing works from within the app
* ✅ App returns to product grid after every transaction

---

## 9. Pull-to-Refresh Pattern

For pages that display data fetched from the backend (such as Order History and Order Queue), we implement a consistent pull-to-refresh pattern using Ionic's `IonRefresher` and `IonRefresherContent` components. This allows users to manually refresh data when needed, particularly in offline or slow-connection scenarios. When a user pulls down on the page content, a chevron-down-circle icon appears with "Pull to refresh" text, and upon release, the page displays a loading spinner with "Refreshing..." text while data is re-fetched from the backend.

All data-displaying pages follow this standardized refresher configuration: `pullingIcon="chevron-down-circle-outline"`, `pullingText="Pull to refresh"`, `refreshingSpinner="circles"`, and `refreshingText="Refreshing..."`. This ensures a consistent and intuitive user experience across the application. The refresh event handler calls the respective data-loading service method, and upon completion (success or error), the refresher automatically returns to its idle state, allowing users to interact with the newly loaded or unchanged data.

---

## 10. Internationalization (i18n) - Multi-Language Support

The Cartaya POS application implements comprehensive internationalization support using **ngx-translate**, enabling the application to support multiple languages dynamically. This section provides an overview; for detailed development information, refer to `docs/I18N_GUIDE.md`.

### 10.1 Supported Languages

* **English** (`en`) - Default language
* **Spanish** (`es`) - Español
* **Catalan** (`ca`) - Català

### 10.2 Architecture Overview

The i18n system consists of:

- **LanguageService** - Main coordinator for language changes, storage persistence, and backend sync
- **LanguageState** - Signal-based reactive state management using Angular Signals
- **LanguageSwitcher Component** - Reusable UI component for language selection
- **TranslateService** - ngx-translate service for dynamic translation loading
- **Translation Files** - JSON files in `src/assets/i18n/` organized by language code

### 10.3 Language Initialization

On app startup, the LanguageService follows this priority chain to determine the user's language:

1. Load from backend user settings (if authenticated)
2. Load saved preference from Ionic Storage
3. Detect browser/device language
4. Fallback to English ('en')

### 10.4 Using Translations

**In Templates (Pipe approach):**
```html
{{ 'COMMON.BUTTONS.CANCEL' | translate }}
{{ 'PRODUCT_GRID.PRODUCT_COUNT' | translate: { count: products.length } }}
```

**In Components (Service approach):**
```typescript
const message = this.translate.instant('COMMON.SUCCESS');
```

### 10.5 Adding New Languages

1. Create translation JSON file in `src/assets/i18n/` with all keys
2. Update `SUPPORTED_LANGUAGES` in `src/app/core/models/language.model.ts`
3. Test language switching and verify all translations
4. Run validation tests: `npm run lint`

### 10.6 Backend Sync

User language preferences are synchronized with the backend:

- **API Endpoint:** `PATCH /api/users/me/settings`
- **Sync Strategy:** Local-first (stored immediately), backend as backup
- **Error Handling:** Failures don't block UI; local storage is source of truth

### 10.7 Translation Keys Organization

Keys follow a hierarchical naming convention:

```
FEATURE_SECTION_KEY

Examples:
- COMMON.BUTTONS.CANCEL
- AUTH.LOGIN.TITLE
- PRODUCT_GRID.PRODUCT_COUNT
- MODIFIERS.ITEM_ADDED
```

For comprehensive development guidelines including best practices, troubleshooting, and detailed code examples, see `docs/I18N_GUIDE.md`.

---

## 11. Future Enhancements (Post-MVP)

* Offline mode with local order queue
* Multi-user PoS sessions
* Order history & reporting
* Tip handling and payment type selection
* Additional language support (French, Portuguese, etc.)
