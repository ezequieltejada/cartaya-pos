# includedQuantity Feature: Quick Reference

**Status:** Planning Phase (No implementation yet)  
**Document:** Implementation Plan Summary  
**Date:** January 19, 2026

---

## Feature Overview

The `includedQuantity` feature allows modifiers to have a quantity "included" in the product's base price. Customers only pay for quantities exceeding this included amount.

### Example
- **Product:** Burger ($10.00)
- **Modifier:** Extra Cheese (+$1.00 per unit, **2 included**)
- **User selects:** 3 units of cheese
- **Pricing:**
  - 2 included (free) + 1 billable = **$1.00 charge**
  - Total: $10.00 + $1.00 = **$11.00**

---

## Current Implementation Status

### ✅ Already Implemented
- Data models (Modifier, SelectedModifier) have `includedQuantity` field
- Pricing formula correct: `basePrice + Σ(max(0, qty - includedQuantity) × priceDelta)`
- API returns `includedQuantity` in modifier responses
- Basic data flow from API to order calculation

### ❌ Missing/Incomplete
- UI indicators showing what's included vs. paid for
- Translation keys for new UI text
- Comprehensive unit tests for pricing with includedQuantity
- Edge case handling & validation
- Developer & QA documentation

---

## Implementation Phases

```
Phase 1: API Data Mapping (2 hrs)
  └─ Validate API response includes includedQuantity
  └─ Add JSDoc to models
  
Phase 2: Pricing Tests (5 hrs)
  └─ Add 20+ test cases covering all scenarios
  └─ Validate formula implementation
  └─ Test edge cases
  
Phase 3: UI/UX Updates (8 hrs)
  └─ Display "First N included" text
  └─ Show quantity breakdown (included + billable)
  └─ Add translations (EN, ES, DE, FR)
  
Phase 4: Integration & Testing (8.5 hrs)
  └─ End-to-end API → Order flow tests
  └─ Modifier selection flow tests
  └─ Order submission tests
  └─ Edge case handling
  
Phase 5: Documentation (4 hrs)
  └─ Developer documentation
  └─ QA testing guide
  └─ JSDoc comments
  
TOTAL: ~31.5 hours (4-5 working days)
```

---

## Key Files Modified

### Core Logic (No changes to formulas - already correct)
- `order.service.ts` - Add JSDoc only (calculateSubtotal already correct)
- `modifier.service.ts` - Add API response documentation
- `modifier.model.ts` - Enhance JSDoc

### UI Updates (New components/methods)
- `modifiers.page.ts` - Add quantity display methods, UI updates
- `modifiers.page.spec.ts` - Add UI interaction tests

### Tests (Major addition)
- `order.service.spec.ts` - Add 15+ test cases for includedQuantity
- `modifier.service.spec.ts` - Add API response tests
- `modifiers.page.spec.ts` - Add UI display tests

### Translations (New keys)
- `en.json` - "First N included", "X included + Y extra", etc.
- `es.json`, `de.json`, `fr.json` - Same keys translated

---

## Pricing Formula (Already Correct ✅)

```
Subtotal = basePrice + Σ(modifier charge)

For each modifier:
  billableQuantity = max(0, selectedQuantity - includedQuantity)
  modifierCharge = billableQuantity × priceDelta

Example Calculations:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scenario 1: Quantity ≤ includedQuantity (FREE!)
  Base: $10.00
  Modifier: +$1.00, includedQty=2, selected=1
  billableQty = max(0, 1-2) = 0
  charge = $1.00 × 0 = $0.00
  Subtotal = $10.00 + $0.00 = $10.00 ✓

Scenario 2: Quantity > includedQuantity (PARTIAL CHARGE)
  Base: $10.00
  Modifier: +$1.00, includedQty=2, selected=3
  billableQty = max(0, 3-2) = 1
  charge = $1.00 × 1 = $1.00
  Subtotal = $10.00 + $1.00 = $11.00 ✓

Scenario 3: No includedQuantity (FULL CHARGE)
  Base: $10.00
  Modifier: +$1.00, includedQty=0, selected=2
  billableQty = max(0, 2-0) = 2
  charge = $1.00 × 2 = $2.00
  Subtotal = $10.00 + $2.00 = $12.00 ✓

Scenario 4: Multiple modifiers with includedQuantity
  Base: $10.00
  Modifier 1: +$0.50, includedQty=1, selected=2
    → billableQty=1, charge=$0.50
  Modifier 2: +$0.75, includedQty=2, selected=2
    → billableQty=0, charge=$0.00
  Subtotal = $10.00 + $0.50 + $0.00 = $10.50 ✓
```

---

## Data Flow Diagram

```
┌─────────────────────┐
│   CARTAYA-API       │ ← Sends modifiers with includedQuantity
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────┐
│  ModifierService             │ ← Maps API response to Modifier
│  .fetchProductModifiers()    │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  ModifiersPage               │ ← Shows UI, collects user selections
│  - Display: "First N included"
│  - Show: "X included + Y extra"
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  OrderService                │ ← Calculates pricing with includedQuantity
│  .calculateSubtotal()        │
│  Formula: base + Σ(max(0,    │
│    qty-includedQty) × price) │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  OrderSummaryComponent       │ ← Displays order with totals
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  OrderService.submitOrder()  │ ← Sends to API with correct totals
│  POST /api/.../orders        │
└─────────────────────────────┘
```

---

## Risk Assessment

### Low Risk (Well contained)
- ✅ API data mapping (API already has includedQuantity)
- ✅ Pricing formula (already implemented, just needs tests)
- ✅ Unit tests (isolated changes, no dependencies)

### Medium Risk (UI/UX)
- ⚠️ UI complexity for non-technical users
  - **Mitigation:** Clear "First N included" messaging
- ⚠️ Translation completeness
  - **Mitigation:** Test all 4 languages before rollout
- ⚠️ Edge cases with unusual includedQuantity values
  - **Mitigation:** Input validation, comprehensive tests

### Low Risk (Overall)
- No breaking changes to existing APIs
- Backward compatible (undefined includedQuantity → 0)
- Existing pricing logic unchanged

---

## Testing Strategy

### Unit Tests (~20 test cases)
1. ✅ Pricing formula validation (7 tests)
   - qty < includedQty
   - qty = includedQty
   - qty > includedQty
   - Multiple modifiers
   - Negative priceDelta
   - Undefined includedQuantity
   - Edge values

2. ✅ API response handling (5 tests)
   - Parse includedQuantity from response
   - Filter inactive modifiers
   - Handle missing includedQuantity
   - Cache and retrieve with includedQuantity

3. ✅ UI interactions (4 tests)
   - Display included quantity text
   - Show quantity breakdown
   - Update breakdown dynamically
   - Handle edge cases in UI

4. ✅ Data flow (4 tests)
   - Modifier → SelectedModifier mapping
   - Order creation with includedQuantity
   - Order submission with calculated totals

### Integration Tests (3 full flows)
1. ✅ API fetch → Modifier display → Price calculation
2. ✅ Modifier selection → Order creation → Submission
3. ✅ Network error scenario with cached data

### Edge Cases
- ✅ includedQuantity undefined/null
- ✅ includedQuantity = 0
- ✅ includedQuantity > selected quantity
- ✅ includedQuantity with negative priceDelta
- ✅ Multiple modifiers with mixed includedQuantity values

---

## Acceptance Criteria

**Phase 1 Complete When:**
- [ ] includedQuantity flows from API → Model without loss
- [ ] JSDoc added to all models
- [ ] No TypeScript compilation warnings

**Phase 2 Complete When:**
- [ ] All 20+ unit tests pass
- [ ] Edge cases tested and handled
- [ ] Formula verified against spec
- [ ] No regressions in existing tests

**Phase 3 Complete When:**
- [ ] UI shows "First N included" text
- [ ] Quantity breakdown displays correctly
- [ ] All translations complete (EN, ES, DE, FR)
- [ ] No visual regressions

**Phase 4 Complete When:**
- [ ] Integration tests pass (API → Order → Submit)
- [ ] Edge cases handled gracefully
- [ ] Manual testing scenarios documented

**Phase 5 Complete When:**
- [ ] Developer documentation complete
- [ ] QA testing guide provided
- [ ] All public methods have JSDoc with examples

---

## Implementation Checklist

### Before Starting
- [ ] Review this plan document
- [ ] Understand pricing formula and examples
- [ ] Set up testing environment
- [ ] Assign team member(s) to phases

### Phase 1: Validation (2 hrs)
- [ ] Step 1.1: Validate API response structure
- [ ] Step 1.2: Update Modifier model JSDoc
- [ ] Step 1.3: Validate SelectedModifier mapping
- [ ] ✅ Tests passing

### Phase 2: Pricing (5 hrs)
- [ ] Step 2.1: Add 20+ pricing tests
- [ ] Step 2.2: Validate calculateSubtotal()
- [ ] Step 2.3: Integration test
- [ ] ✅ All tests passing, no regressions

### Phase 3: UI (8 hrs)
- [ ] Step 3.1: Display included quantity info
- [ ] Step 3.2: Show quantity breakdown
- [ ] Step 3.3: Add translation keys
- [ ] Step 3.4: Update order summary (if needed)
- [ ] ✅ UI clear, no visual regressions

### Phase 4: Integration (8.5 hrs)
- [ ] Step 4.1: API → Order integration test
- [ ] Step 4.2: Modifier selection flow test
- [ ] Step 4.3: Order submission test
- [ ] Step 4.4: Edge cases & error handling
- [ ] ✅ All flows working correctly

### Phase 5: Docs (4 hrs)
- [ ] Step 5.1: Developer documentation
- [ ] Step 5.2: JSDoc comments
- [ ] Step 5.3: QA testing guide
- [ ] ✅ Documentation complete

### Final Verification
- [ ] Code review completed
- [ ] All tests passing (100% coverage for new code)
- [ ] Manual testing done by QA
- [ ] Translations verified in all languages
- [ ] Performance verified (no degradation)
- [ ] Ready for rollout

---

## Contact & Questions

**For implementation details:** Refer to full `IMPLEMENTATION_PLAN_INCLUDEDQUANTITY.md`

**Document structure:**
1. Executive Summary (high-level overview)
2. Detailed phases with step-by-step instructions
3. Code examples and test cases
4. Risk assessment and mitigation
5. Acceptance criteria and checklists

---

**Prepared:** January 19, 2026  
**Status:** Ready for Implementation Team  
**Duration:** ~4-5 working days (31.5 hours)  
**Risk Level:** Low-Medium  
**Impact:** Medium (UX improvement + pricing accuracy)
