# includedQuantity Feature: Architecture & Technical Deep Dive

**Date:** January 19, 2026  
**Status:** Planning Phase  
**Audience:** Backend developers, frontend developers, architects

---

## System Architecture

### High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CARTAYA POS FRONTEND                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      USER INTERFACE LAYER                           │  │
│  │  ┌────────────────────┐        ┌──────────────────────────────┐    │  │
│  │  │ ProductCatalogPage │        │    OrderSummaryComponent     │    │  │
│  │  │                    │        │                              │    │  │
│  │  │ - Display products │        │ - Show items in order        │    │  │
│  │  │ - Navigate to      │        │ - Calculate & show totals    │    │  │
│  │  │   modifiers        │        │ - Handle checkout            │    │  │
│  │  └────────────┬───────┘        └──────────────┬───────────────┘    │  │
│  │               │                               │                     │  │
│  │               └───────────────┬────────────────┘                     │  │
│  │                               │                                     │  │
│  │  ┌────────────────────────────▼──────────────────────────────────┐ │  │
│  │  │            ModifiersPage                                     │ │  │
│  │  │            (NEW: includedQuantity UI)                        │ │  │
│  │  │ ◆ Fetch modifiers (includes includedQuantity)               │ │  │
│  │  │ ◆ Display: "First N included"                               │ │  │
│  │  │ ◆ Show: "X included + Y billable = $Z.ZZ"                   │ │  │
│  │  │ ◆ User selects quantities                                   │ │  │
│  │  │ ◆ Create SelectedModifier[] with includedQuantity           │ │  │
│  │  │ ◆ Call OrderService.addConfiguredProduct()                  │ │  │
│  │  └────────────────────────────┬───────────────────────────────┘  │  │
│  │                               │                                   │  │
│  └───────────────────────────────┼───────────────────────────────────┘  │
│                                  │                                       │
├──────────────────────────────────┼───────────────────────────────────────┤
│                                  │                                       │
│  ┌──────────────────────────────▼──────────────────────────────────┐   │
│  │                   SERVICE LAYER                                │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  ModifierService                                         │  │   │
│  │  │  • fetchProductModifiers() → API call                    │  │   │
│  │  │  • Map: includedQuantity from API.data[i]               │  │   │
│  │  │  • Caching: preserves includedQuantity                  │  │   │
│  │  │  • Returns: Modifier[] with includedQuantity            │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  OrderService (NEW: includedQuantity logic)              │  │   │
│  │  │  • addConfiguredProduct(product, modifiers)             │  │   │
│  │  │  • calculateSubtotal() ← KEY FORMULA                    │  │   │
│  │  │    basePrice + Σ(max(0, qty-includedQty) × priceDelta)  │  │   │
│  │  │  • Update OrderItem with subtotal                       │  │   │
│  │  │  • Persist to storage                                   │  │   │
│  │  │  • submitOrder() → API call                             │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │   │
│                                                                       │   │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      DATA LAYER (MODELS)                            │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │ Modifier (from API)                                          │   │  │
│  │  │ ├─ id: string                                                │   │  │
│  │  │ ├─ name: string                                              │   │  │
│  │  │ ├─ priceDelta: number                                        │   │  │
│  │  │ ├─ currency: string                                          │   │  │
│  │  │ ├─ active: boolean                                           │   │  │
│  │  │ ├─ default?: boolean                                         │   │  │
│  │  │ ├─ isRemovable?: boolean                                     │   │  │
│  │  │ ├─ includedQuantity?: number ◄─ KEY FIELD                   │   │  │
│  │  │ ├─ createdAt: string                                         │   │  │
│  │  │ └─ updatedAt: string                                         │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │ SelectedModifier (user's selection)                          │   │  │
│  │  │ ├─ modifierId: string                                        │   │  │
│  │  │ ├─ name: string                                              │   │  │
│  │  │ ├─ priceDelta: number                                        │   │  │
│  │  │ ├─ quantity: number (user selected)                          │   │  │
│  │  │ └─ includedQuantity?: number ◄─ KEY FIELD (from Modifier)   │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │ OrderItem (in order)                                         │   │  │
│  │  │ ├─ id?: string                                               │   │  │
│  │  │ ├─ productId: string                                         │   │  │
│  │  │ ├─ basePrice?: number                                        │   │  │
│  │  │ ├─ quantity: number                                          │   │  │
│  │  │ ├─ modifiers: SelectedModifier[]                             │   │  │
│  │  │ ├─ subtotal?: number ◄─ CALCULATED WITH includedQuantity    │   │  │
│  │  │ └─ notes?: string                                            │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
         │
         │ HTTP Requests (with included pricing data)
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         CARTAYA-API                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ✓ GET /api/tenants/:tenantId/products/:productId/modifiers             │
│    Response includes: includedQuantity field (database: product_modifiers│
│                                               column: included_quantity) │
│                                                                            │
│  ✓ POST /api/tenants/:tenantId/pos/:posId/orders                        │
│    Receives: orderItems with calculated totals                           │
│    (POS calculated totals using includedQuantity)                        │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Pricing Logic Flow (Key Algorithm)

### The Core Calculation

```
Function: calculateSubtotal(basePrice, modifiers[])
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  subtotal = basePrice                                        │
│                                                              │
│  FOR EACH modifier IN modifiers:                             │
│    includedQty = modifier.includedQuantity ?? 0              │
│    billableQty = max(0, modifier.quantity - includedQty)     │
│    charge = billableQty × modifier.priceDelta                │
│    subtotal = subtotal + charge                              │
│                                                              │
│  RETURN subtotal                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Key Insights:
• max(0, ...) ensures we never have negative billable quantities
• If quantity <= includedQuantity: billableQty = 0, NO CHARGE
• If quantity > includedQuantity: billableQty = overflow, CHARGED
• priceDelta can be negative (discounts): works correctly
• includedQuantity defaults to 0 if missing (charge full amount)
```

### State Diagram (Order Item Lifecycle)

```
Product Selected
    │
    ▼
ModifiersPage Loads
    │
    ├─ fetchProductModifiers()
    │  │
    │  ├─ HTTP GET /api/tenants/:id/products/:id/modifiers
    │  │  │
    │  │  └─► Response: Modifier[] with includedQuantity
    │  │
    │  └─ User sees: "First N included" in UI
    │
    ├─ User Selects Modifiers
    │  │
    │  ├─ +/- buttons update selectedModifiers: Map<modifierId, qty>
    │  │
    │  ├─ UI updates: "X included + Y billable = $Z"
    │  │
    │  └─ confirmSelection() creates SelectedModifier[]
    │
    ▼
Create OrderItem
    │
    ├─ Call OrderService.addConfiguredProduct(product, selectedModifiers[])
    │  │
    │  ├─ calculateSubtotal(basePrice, selectedModifiers)
    │  │  │
    │  │  ├─ FOR each modifier:
    │  │  │   billableQty = max(0, qty - includedQty)
    │  │  │   charge = billableQty × priceDelta
    │  │  │
    │  │  └─ subtotal = basePrice + Σ(charges)
    │  │
    │  └─ Create OrderItem with subtotal
    │
    ├─ Add to orderItems signal
    │
    └─ Persist to storage
        
    ▼
OrderSummaryComponent Displays
    │
    ├─ Shows each OrderItem.subtotal
    │
    ├─ Computes orderTotal = Σ(item.subtotal)
    │
    └─ Display to user
    
    ▼
User Submits Order
    │
    ├─ Call OrderService.submitOrder()
    │  │
    │  ├─ Build payload:
    │  │  {
    │  │    items: [{
    │  │      productId: "...",
    │  │      quantity: 1,
    │  │      modifiers: [{modifierId, quantity}, ...]
    │  │    }],
    │  │    totalAmount: 11.00 (✓ calculated correctly)
    │  │  }
    │  │
    │  └─ HTTP POST /api/tenants/:id/pos/:id/orders
    │
    ├─ API receives order with correct pricing
    │
    └─ Clear order, navigate back
```

---

## Data Transformation Pipeline

### API Response → Model → Order

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: API Response (from cartaya-api)                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ {                                                            │
│   "data": [                                                  │
│     {                                                        │
│       "id": "mod-cheese",                                   │
│       "name": "Extra Cheese",                               │
│       "priceDelta": 1.00,                                   │
│       "currency": "USD",                                    │
│       "active": true,                                       │
│       "isDefault": false,                                   │
│       "isRemovable": true,                                  │
│       "includedQuantity": 2,  ◄─ KEY DATA                   │
│       "createdAt": "2024-01-01T00:00:00Z",                 │
│       "updatedAt": "2024-01-15T14:30:00Z"                  │
│     }                                                       │
│   ],                                                        │
│   "pagination": { ... }                                    │
│ }                                                           │
│                                                            │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Mapper (ModifierService.fetchProductModifiers)      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ response.data.map((modifier) => ({                          │
│   ...modifier,  ◄─ SPREAD includes includedQuantity        │
│   default: modifier.isDefault,                             │
│   isRemovable: modifier.isRemovable,                        │
│   createdAt: '',                                           │
│   updatedAt: '',                                           │
│ }))                                                        │
│                                                            │
│ Result: Modifier {                                        │
│   id: "mod-cheese",                                       │
│   name: "Extra Cheese",                                   │
│   priceDelta: 1.00,                                       │
│   currency: "USD",                                        │
│   active: true,                                           │
│   default: false,                                         │
│   isRemovable: true,                                      │
│   includedQuantity: 2,  ◄─ PRESERVED                      │
│   createdAt: '',                                          │
│   updatedAt: ''                                           │
│ }                                                         │
│                                                            │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: User Selection (ModifiersPage)                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ User clicks +/+ buttons:                                   │
│   selectedModifiers: Map {                                 │
│     "mod-cheese" → 3  ◄─ User selected 3 units             │
│   }                                                        │
│                                                            │
│ confirmSelection() creates SelectedModifier[]:             │
│   [{                                                       │
│     modifierId: "mod-cheese",                              │
│     name: "Extra Cheese",                                  │
│     priceDelta: 1.00,                                      │
│     quantity: 3,  ◄─ User selected 3                       │
│     includedQuantity: 2,  ◄─ From Modifier.includedQty    │
│   }]                                                       │
│                                                            │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Pricing Calculation (OrderService)                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ calculateSubtotal(10.00, [{                                │
│   quantity: 3,                                             │
│   includedQuantity: 2,                                     │
│   priceDelta: 1.00                                         │
│ }])                                                        │
│                                                            │
│ Calculation:                                               │
│   billableQty = max(0, 3 - 2) = 1                         │
│   charge = 1 × 1.00 = 1.00                                │
│   subtotal = 10.00 + 1.00 = 11.00  ◄─ RESULT              │
│                                                            │
│ Result: OrderItem {                                       │
│   id: "item-123",                                         │
│   productId: "prod-burger",                               │
│   productName: "Burger",                                  │
│   basePrice: 10.00,                                       │
│   quantity: 1,                                            │
│   modifiers: [{...}],                                     │
│   subtotal: 11.00,  ◄─ CALCULATED WITH includedQuantity  │
│ }                                                         │
│                                                            │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Order Submission Payload (OrderService)              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ submitOrder() payload:                                     │
│ {                                                          │
│   items: [{                                               │
│     productId: "prod-burger",                             │
│     quantity: 1,                                          │
│     modifiers: [{                                         │
│       modifierId: "mod-cheese",                           │
│       quantity: 3  ◄─ Qty selected by user                │
│     }]                                                    │
│   }],                                                     │
│   totalAmount: 11.00,  ◄─ CALCULATED CORRECTLY            │
│   currency: "USD"                                         │
│ }                                                         │
│                                                           │
│ API receives correct pricing (not just quantities)        │
│                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Edge Cases & Handling

### Edge Case 1: Quantity Equals includedQuantity

```
Scenario: Customer orders exactly the included amount
  Modifier: +$1.00, includedQuantity=2, selected=2
  
Calculation:
  billableQty = max(0, 2-2) = 0
  charge = $1.00 × 0 = $0.00
  
Result: No charge (customer gets all for free)
✓ CORRECT - Payment logic: "included quantity is free"
```

### Edge Case 2: Missing includedQuantity in API Response

```
Scenario: API returns modifier without includedQuantity field
  Modifier JSON: { id, name, priceDelta, ... }  (no includedQuantity)
  
Handling:
  Modifier interface has: includedQuantity?: number
  calculateSubtotal uses: includedQuantity ?? 0
  
Behavior:
  undefined ?? 0 = 0
  billableQty = max(0, qty - 0) = qty
  charge = qty × priceDelta (full charge)
  
Result: Backward compatible, defaults to charging full amount
✓ SAFE FALLBACK
```

### Edge Case 3: Negative priceDelta (Discount)

```
Scenario: Customer orders discount modifier
  Modifier: -$2.00 (discount), includedQuantity=0, selected=1
  
Calculation:
  billableQty = max(0, 1-0) = 1
  charge = -$2.00 × 1 = -$2.00
  subtotal = $10.00 - $2.00 = $8.00
  
Result: Discount applied correctly
✓ WORKS WITH NEGATIVE PRICES
```

### Edge Case 4: Multiple Modifiers with Different includedQuantity

```
Scenario: Product with multiple modifiers
  Product: $10.00
  Modifier 1: +$0.50, includedQty=1, selected=2
  Modifier 2: +$0.75, includedQty=2, selected=2
  Modifier 3: +$1.00, includedQty=0, selected=3
  
Calculation:
  charge1 = $0.50 × (2-1) = $0.50 × 1 = $0.50
  charge2 = $0.75 × (2-2) = $0.75 × 0 = $0.00
  charge3 = $1.00 × (3-0) = $1.00 × 3 = $3.00
  subtotal = $10.00 + $0.50 + $0.00 + $3.00 = $13.50
  
Result: Each modifier's includedQuantity handled independently
✓ CORRECT AGGREGATION
```

### Edge Case 5: includedQuantity Exceeds Reasonable Limit

```
Scenario: API returns includedQuantity=99999
  Modifier: +$1.00, includedQuantity=99999, selected=3
  
Calculation:
  billableQty = max(0, 3-99999) = 0
  charge = $1.00 × 0 = $0.00
  
Result: No charge (customer selected qty < includedQty)
✓ MATH WORKS CORRECTLY (even with unreasonable values)

Mitigation Strategy:
  • Log warning in console: "Unusual includedQuantity value: 99999"
  • Consider validating in calculateSubtotal that includedQty is reasonable
  • Don't crash, just handle gracefully
```

---

## State Management Architecture

### OrderService Signals

```
┌─────────────────────────────────────────────────────┐
│         OrderService (State Management)             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Writable Signals:                                 │
│  ├─ orderItems = signal<OrderItem[]>              │
│  │  └─ Each item has modifiers with includedQty   │
│  │  └─ Each item.subtotal calculated with formula │
│  │                                                 │
│  ├─ currency = signal<string>                     │
│  │  └─ Derived from tenant settings               │
│  │                                                 │
│  └─ isSubmitting = signal<boolean>                │
│     └─ UI loading state                           │
│                                                    │
│  Computed Signals:                                │
│  ├─ orderTotal = computed(() =>                  │
│  │    orderItems().reduce((sum, item) =>         │
│  │      sum + (item.subtotal ?? 0), 0)          │
│  │  └─ Sums all item subtotals (calculated w/ formula)
│  │                                                 │
│  ├─ itemCount = computed(() =>                    │
│  │    orderItems().length)                       │
│  │                                                 │
│  └─ hasItems = computed(() =>                     │
│     orderItems().length > 0)                     │
│                                                    │
│  Key Method:                                      │
│  ├─ addConfiguredProduct(product, modifiers) {   │
│  │   const subtotal = calculateSubtotal(          │
│  │     basePrice,                                 │
│  │     modifiers  ◄─ includes includedQuantity   │
│  │   )                                            │
│  │   // Create OrderItem with subtotal            │
│  │   // Add to orderItems                         │
│  │   // Persist to storage                        │
│  │ }                                              │
│  │                                                │
│  └─ calculateSubtotal(basePrice, modifiers) {    │
│     // ◄─ KEY FORMULA                            │
│     // basePrice + Σ(max(0, qty-includedQty)*delta)
│     // includedQuantity comes from modifiers[]   │
│  }                                                │
│                                                    │
└─────────────────────────────────────────────────────┘
```

---

## UI/UX Components (Post-Implementation)

### ModifiersPage UI Enhancement

```
Current UI:
┌──────────────────────────────────────────────────────┐
│  Modifier Name         │  Price   │  [ - ]  0  [ + ] │
│  Extra Cheese         │  +$1.00  │  [ - ]  0  [ + ] │
│  Add Bacon            │  +$2.00  │  [ - ]  0  [ + ] │
└──────────────────────────────────────────────────────┘

Enhanced UI (with includedQuantity):
┌──────────────────────────────────────────────────────┐
│  Modifier Name         │  Price   │  Qty │ Breakdown │
├──────────────────────────────────────────────────────┤
│  Extra Cheese         │  +$1.00  │  3   │ 2+1 extra │
│  First 2 included     │          │      │ =$1.00    │
│                       │          │      │           │
│  Add Bacon            │  +$2.00  │  1   │ 1 included│
│  First 2 included     │          │      │ =$0.00    │
└──────────────────────────────────────────────────────┘

New UI Elements:
• "First N included" text (when includedQty > 0)
• Quantity breakdown row (when user selects)
• Visual feedback for included vs. billable portions
```

---

## Testing Strategy Architecture

### Test Pyramid

```
                    ▲
                   /│\
                  / │ \
                 /  │  \
                /   │   \              E2E Tests (~3)
               /    │    \             • API → Order flow
              /     │     \            • Full user journeys
             /      │      \           • Order submission
            /───────┼───────\
           /        │        \         Integration Tests (~5)
          /         │         \        • Service interactions
         /          │          \       • Data flow
        /    ──────│──────      \      • Caching
       /    ║      │      ║      \
      /─────║──────┼──────║──────\
     ║      ║      │      ║      ║     Unit Tests (~20)
     ║   Formula   │  API   ║     ║     • calculateSubtotal
     ║  Mapping    │ Response     ║     • Data transformations
     ║   Edge      │  Handling    ║     • UI interactions
     ║   Cases     │             ║     • Edge cases
     ║─────────────┼───────────────║
```

### Test Coverage by Component

| Component | Test Type | Coverage | Examples |
|-----------|-----------|----------|----------|
| **calculateSubtotal()** | Unit | 7+ tests | qty < included, qty = included, qty > included |
| **API response** | Unit | 4+ tests | Parse includedQty, filter active, handle missing |
| **ModifiersPage UI** | Unit | 4+ tests | Display text, show breakdown, update dynamically |
| **Modifier selection** | Integration | 3+ tests | Select → Create SelectedModifier → Calculate |
| **Order creation** | Integration | 2+ tests | Add item → Calculate → Persist |
| **E2E flow** | E2E | 3+ tests | API → UI → Order → Submit |

---

## Performance Considerations

### Algorithm Complexity

```
calculateSubtotal(basePrice, modifiers):
  Time Complexity: O(n) where n = number of modifiers per item
  Space Complexity: O(1)
  
  Real-world: n typically < 20 modifiers per product
  → Performance impact: NEGLIGIBLE
  
  Floating-point operations: ~20 arithmetic ops per item
  → Impact on UI: IMPERCEPTIBLE (<1ms)
```

### Storage Implications

```
OrderItem storage (before and after):
  Before: ~200 bytes per item (no change in size)
  After:  ~200 bytes per item (includedQuantity is small int)
  
  Cache impact: NEGLIGIBLE
  
  Order submission payload:
  Before: item { id, qty, modifiers[{id, qty}] }
  After:  item { id, qty, modifiers[{id, qty}] }  ← NO CHANGE
  
  API payload size: UNCHANGED (POS still sends same data)
```

### Network Considerations

```
API calls (unchanged):
  GET /modifiers → Returns includedQuantity (1 more int per modifier)
  POST /orders → Sends same payload structure
  
  Bandwidth impact: ~5-10 bytes per modifier (negligible)
  Latency impact: NONE
```

---

## Backward Compatibility

### Version Compatibility Matrix

```
POS Version | API with includedQuantity | Behavior
────────────┼──────────────────────────┼─────────────────────
OLD POS     │ NO includedQuantity      │ Works (existing formula)
OLD POS     │ YES includedQuantity     │ Works (ignores field, full charge)
────────────┼──────────────────────────┼─────────────────────
NEW POS     │ NO includedQuantity      │ Works (defaults to 0)
NEW POS     │ YES includedQuantity     │ Works! (uses new formula)
────────────┼──────────────────────────┼─────────────────────

Conclusion: NEW POS is backward compatible
• Old API without includedQuantity: Still works (charges full)
• Old POS with new API: Ignores includedQuantity (charges full)
• New POS with new API: Correctly uses includedQuantity
```

### Migration Path

```
Timeline:
  Week 1: Deploy cartaya-api with includedQuantity support
          (old POS still works, just doesn't use it)
  
  Week 2: Deploy cartaya-pos with includedQuantity UI
          (new POS sees "First N included" text)
  
  Result: Seamless transition, no breaking changes
```

---

## Debugging Guide

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Modifier charge incorrect | includedQuantity not mapped | Check API response has field, verify mapper |
| "undefined is not a function" | includedQuantity undefined | Verify ?? 0 is used in calculateSubtotal |
| Order total wrong | Calculation error | Add console.log in calculateSubtotal |
| UI shows no breakdown | includedQuantity = 0 or undefined | Check modifier.includedQuantity in DevTools |
| Cached modifiers missing field | Cache from old API | Clear storage, refresh, re-cache |

### Debugging Console Commands

```javascript
// Check if modifier has includedQuantity
const modifiers = orderService.orderItems()[0].modifiers;
console.log('Modifiers:', modifiers);
modifiers.forEach(m => console.log(`${m.name}: includedQty=${m.includedQuantity}`));

// Verify pricing calculation
const item = orderService.orderItems()[0];
console.log('Item subtotal:', item.subtotal);
console.log('Expected:', calculateSubtotal(item.basePrice, item.modifiers));

// Check stored data in localStorage
localStorage.getItem('currentOrder');
JSON.parse(localStorage.getItem('currentOrder')).items[0].modifiers;
```

---

## Migration Checklist

### Pre-Deployment
- [ ] Review this architecture document with team
- [ ] Verify API already has includedQuantity (migration 0009)
- [ ] Ensure backward compatibility tested
- [ ] Staging environment ready

### Deployment Phase 1 (API)
- [ ] Deploy cartaya-api with includedQuantity support
- [ ] Monitor API for errors
- [ ] Verify test modifiers have includedQuantity > 0

### Deployment Phase 2 (POS)
- [ ] Deploy cartaya-pos with new code
- [ ] Clear app cache (localStorage, service worker)
- [ ] Test with test data
- [ ] Verify UI shows "First N included"

### Post-Deployment Monitoring
- [ ] Monitor order submission for pricing correctness
- [ ] Watch for error logs related to includedQuantity
- [ ] Verify order totals are calculated correctly
- [ ] Check for any performance degradation

---

**End of Architecture Document**

*For implementation details, see IMPLEMENTATION_PLAN_INCLUDEDQUANTITY.md*
*For quick reference, see IMPLEMENTATION_PLAN_QUICK_REFERENCE.md*
