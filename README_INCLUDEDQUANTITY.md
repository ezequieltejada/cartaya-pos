# includedQuantity Pricing Feature - Complete Planning Package

**Status:** ✅ Exploration Complete | 📋 Planning Phase  
**Date:** January 19, 2026  
**Ready for:** Implementation Team Handoff

---

## 📚 Document Overview

This package contains everything needed to implement the `includedQuantity` pricing feature in cartaya-pos.

### Reading Order

#### 1️⃣ Start Here (5-10 minutes)
**Document:** `EXPLORATION_SUMMARY.md`
- High-level overview of what was discovered
- Key findings: 60% implemented, 40% missing
- Technology stack analysis
- Current state snapshot
- **Best for:** Everyone (product owner, team leads, developers)

#### 2️⃣ Then Read (15 minutes)
**Document:** `IMPLEMENTATION_PLAN_QUICK_REFERENCE.md`
- Feature overview with examples
- 5-phase implementation plan
- Risk assessment and mitigations
- Effort estimation (31.5 hours, 4-5 days)
- Implementation checklist
- **Best for:** Implementation team, project managers

#### 3️⃣ During Implementation (Reference)
**Document:** `IMPLEMENTATION_PLAN_INCLUDEDQUANTITY.md`
- Detailed step-by-step plan (17 steps across 5 phases)
- Acceptance criteria for each step
- Code examples and test scenarios
- Edge case handling
- Testing strategy with 20+ test cases
- Quality gates and verification steps
- **Best for:** Developers implementing each phase
- **Use:** Open alongside IDE, follow step-by-step

#### 4️⃣ For Complex Questions (Reference)
**Document:** `ARCHITECTURE_INCLUDEDQUANTITY.md`
- System architecture diagrams
- Pricing logic deep dive
- Data transformation pipeline
- State management architecture
- Performance analysis
- Backward compatibility matrix
- Debugging guide
- **Best for:** Architects, senior developers, QA leads
- **Use:** When designing solutions, debugging issues

---

## 🎯 Quick Facts

### What is includedQuantity?

Modifiers can have a quantity "included" in the product's base price. Customers only pay for quantities exceeding this amount.

**Example:**
- Product: Burger ($10)
- Modifier: Extra Cheese (+$1/unit, **2 included**)
- User selects: 3 units
- Result: User pays only for 1 extra = $10 + $1 = **$11**

### Current State

| Aspect | Status |
|--------|--------|
| Data Models | ✅ Complete (have includedQuantity field) |
| Pricing Formula | ✅ Correct (basePrice + Σ(max(0, qty-included) × delta)) |
| API Integration | ✅ API returns includedQuantity |
| UI Display | ❌ Missing (no "First N included" text) |
| Testing | ❌ Missing (no includedQuantity tests) |
| Documentation | ❌ Missing (no dev guides) |

### Implementation Overview

- **Duration:** 31.5 hours (4-5 working days)
- **Phases:** 5 phases × 3-4 steps each
- **Risk Level:** Low-Medium
- **Complexity:** Low-Medium
- **Files to Modify:** 10-15 files
- **New Tests:** 20+ test cases

---

## 📖 How to Use These Documents

### For Product Owners
1. Read `EXPLORATION_SUMMARY.md` (5 min)
2. Review risk assessment in `IMPLEMENTATION_PLAN_QUICK_REFERENCE.md` (5 min)
3. Approve implementation plan
4. Assign team members to phases

### For Implementation Leads
1. Read `EXPLORATION_SUMMARY.md` (5 min)
2. Read `IMPLEMENTATION_PLAN_QUICK_REFERENCE.md` (15 min)
3. Skim `IMPLEMENTATION_PLAN_INCLUDEDQUANTITY.md` to understand scope
4. Assign developers to phases based on effort estimates

### For Frontend Developers
1. Read `IMPLEMENTATION_PLAN_QUICK_REFERENCE.md` Phase 3 (UI/UX)
2. Reference `IMPLEMENTATION_PLAN_INCLUDEDQUANTITY.md` for step-by-step guidance
3. Use code examples in `ARCHITECTURE_INCLUDEDQUANTITY.md` for inspiration
4. Follow acceptance criteria in plan document
5. Run tests from Phase 2 before starting UI work

### For Backend/Test Developers
1. Read `IMPLEMENTATION_PLAN_QUICK_REFERENCE.md` Phases 1-2 & 4
2. Reference pricing calculations in `ARCHITECTURE_INCLUDEDQUANTITY.md`
3. Use test scenarios from `IMPLEMENTATION_PLAN_INCLUDEDQUANTITY.md` Phase 2
4. Implement tests first (TDD approach)

### For QA/QA Leads
1. Read `IMPLEMENTATION_PLAN_QUICK_REFERENCE.md` testing section
2. Reference `IMPLEMENTATION_PLAN_INCLUDEDQUANTITY.md` Phase 4 edge cases
3. Use debugging guide in `ARCHITECTURE_INCLUDEDQUANTITY.md`
4. Follow manual testing scenarios in plan

### For Architects/Tech Leads
1. Read `EXPLORATION_SUMMARY.md` (5 min)
2. Review system architecture in `ARCHITECTURE_INCLUDEDQUANTITY.md`
3. Review risk assessment and backward compatibility
4. Approve technical approach before implementation starts

---

## 🚀 Implementation Roadmap

### Phase 1: API Data Mapping (2 hours)
**Goal:** Validate includedQuantity flows from API to models
- Step 1.1: Validate API response structure
- Step 1.2: Update Modifier model JSDoc
- Step 1.3: Validate SelectedModifier mapping
- **Owner:** Lead Developer
- **Risk:** Low
- **Deliverable:** Verified data mapping

### Phase 2: Pricing Tests (5 hours)
**Goal:** Test pricing formula with includedQuantity
- Step 2.1: Add 20+ unit tests
- Step 2.2: Validate calculateSubtotal()
- Step 2.3: Integration test
- **Owner:** Test/Backend Developer
- **Risk:** Low
- **Deliverable:** Comprehensive test suite

### Phase 3: UI/UX Updates (8 hours)
**Goal:** Show users "First N included" pricing info
- Step 3.1: Display included quantity info
- Step 3.2: Show quantity breakdown
- Step 3.3: Add translation keys
- Step 3.4: Update order summary
- **Owner:** Frontend Developer
- **Risk:** Medium
- **Deliverable:** Updated UI with pricing transparency

### Phase 4: Integration Testing (8.5 hours)
**Goal:** Test full flows end-to-end
- Step 4.1: API → Order integration test
- Step 4.2: Modifier selection flow test
- Step 4.3: Order submission test
- Step 4.4: Edge cases & error handling
- **Owner:** QA Lead / Test Developer
- **Risk:** Medium
- **Deliverable:** Comprehensive integration tests

### Phase 5: Documentation (4 hours)
**Goal:** Document feature for team
- Step 5.1: Developer documentation
- Step 5.2: JSDoc comments
- Step 5.3: QA testing guide
- **Owner:** Tech Lead / Tech Writer
- **Risk:** Low
- **Deliverable:** Complete documentation

---

## 📋 Acceptance Criteria (Summary)

### Phase 1 ✓
- [ ] includedQuantity flows API → Model → SelectedModifier
- [ ] Models have clear JSDoc
- [ ] No TypeScript warnings

### Phase 2 ✓
- [ ] All pricing tests pass (20+ scenarios)
- [ ] Formula verified: basePrice + Σ(max(0, qty-includedQty) × delta)
- [ ] Edge cases tested (undefined, zero, negative, large values)

### Phase 3 ✓
- [ ] UI shows "First N included" text (when > 0)
- [ ] Quantity breakdown displayed: "X included + Y extra = $Z"
- [ ] All languages translated (EN, ES, DE, FR)
- [ ] No visual regressions

### Phase 4 ✓
- [ ] Integration tests pass (API → Order → Submit)
- [ ] Edge cases handled gracefully
- [ ] No regressions in existing tests

### Phase 5 ✓
- [ ] Developer documentation complete
- [ ] QA testing guide provided
- [ ] All public methods have JSDoc with examples

---

## 🎓 Key Concepts

### The Pricing Formula
```
Subtotal = basePrice + Σ(modifier charge)

For each modifier:
  billableQuantity = max(0, selectedQuantity - includedQuantity)
  charge = billableQuantity × priceDelta
```

### Data Flow
```
API (includedQuantity in response)
    ↓
ModifierService (map to Modifier, cache)
    ↓
ModifiersPage (display, user selects)
    ↓
SelectedModifier (includedQuantity captured)
    ↓
OrderService.calculateSubtotal() (formula applied)
    ↓
OrderItem (subtotal calculated correctly)
    ↓
Order Submission (with correct total)
```

### Edge Cases Covered
- Quantity = includedQuantity (no charge)
- Quantity < includedQuantity (no charge)
- Quantity > includedQuantity (partial charge)
- Multiple modifiers with different includedQuantity
- Missing/undefined includedQuantity (defaults to 0)
- Negative priceDelta (discounts)

---

## ⚠️ Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Pricing calculation wrong | 20+ unit tests covering all scenarios |
| UI confuses users | Clear "First N included" messaging |
| Missing translations | All 4 languages in i18n files |
| Regressions | Comprehensive regression test suite |
| Edge case failures | Thorough edge case testing in Phase 4 |

---

## 📊 Success Metrics

- ✅ All tests pass (100% coverage for new code)
- ✅ No regressions in existing functionality
- ✅ Order pricing matches calculations
- ✅ UI clear and not confusing
- ✅ All translations complete
- ✅ Documentation accessible and accurate

---

## ❓ Common Questions

**Q: Is the pricing formula already implemented?**
A: Yes! The formula in `OrderService.calculateSubtotal()` is correct. We just need to test it and show it in the UI.

**Q: Do we need to change the API?**
A: No. The API already returns `includedQuantity`. No API changes needed.

**Q: How much testing is needed?**
A: ~20 unit tests + 5 integration tests + 3 E2E tests = comprehensive coverage

**Q: How long will this take?**
A: 31.5 hours total = 4-5 working days for a team of 3-4 people

**Q: Is this backward compatible?**
A: Yes! Undefined `includedQuantity` defaults to 0 (charge full amount)

**Q: What if includedQuantity is missing from API response?**
A: Safe fallback: charge full amount (backward compatible)

---

## 🔗 Related Documents

- `AGENTS.md` - Project conventions and guidelines
- `/cartayaPos/AGENTS.md` - POS-specific conventions

---

## 📞 Support

**For questions about the plan:**
1. Check the relevant document (QUICK_REFERENCE → IMPLEMENTATION_PLAN → ARCHITECTURE)
2. Review the glossary in the main implementation plan
3. Ask the team lead or product owner

**For questions during implementation:**
1. Reference the step-by-step plan in `IMPLEMENTATION_PLAN_INCLUDEDQUANTITY.md`
2. Check the code examples in `ARCHITECTURE_INCLUDEDQUANTITY.md`
3. Review the debugging guide in `ARCHITECTURE_INCLUDEDQUANTITY.md`

---

## 📝 Document Maintenance

If the codebase changes significantly, these documents should be updated:

- Add new edge cases to Phase 4
- Update estimated effort if complexity increases
- Add new files to the "Files to Modify" section
- Update acceptance criteria if requirements change

---

**Status:** ✅ COMPLETE AND READY FOR IMPLEMENTATION

All documents have been carefully prepared and are ready for the implementation team to begin Phase 1.

Start with `EXPLORATION_SUMMARY.md` and follow the reading order above.

Good luck with implementation! 🚀
