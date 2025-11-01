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

## 9. Future Enhancements (Post-MVP)

* Offline mode with local order queue
* Multi-user PoS sessions
* Order history & reporting
* Tip handling and payment type selection
* Multi-language support