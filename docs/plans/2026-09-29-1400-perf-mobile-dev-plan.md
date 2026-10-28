---
title: Mobile performance and purchase reliability - Plan
type: perf
date: 2026-09-29
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---
# Mobile performance and purchase reliability - Plan

## Goal Capsule

Customers can select products reliably on mobile and teams can assess measured performance improvements on Dev before publishing.
Implementation and deployment target the unpublished Shopify theme 183837262202. The client team owns production publication. Stop an individual change if its cause cannot be reproduced or its functional regression cannot be resolved; report that limitation explicitly.

---
## Product Contract

### Summary

Reproduce the reported mobile defects on the current theme, correct confirmed causes, and deliver a comparable before/after report with a Dev acceptance checklist.

### Problem Frame

The supplied September analysis reports incorrect early cart additions, slow product interactions, and collection layout shifts. Its original detailed report is unavailable at its supplied path. Current baseline is commit 409353a, including the newly published Cookiebot bridge; historical numbers are not the current baseline.

### Requirements

**Purchase correctness**
- R1. Early selection must never silently add another variant or quantity.
- R2. Rapid variant changes must leave title, media, prices, availability and submitted state consistent with the latest choice.
- R3. Preserve one-time purchase, subscription, cart drawer, direct checkout routing and consent behavior.

**Performance and evidence**
- R4. Establish mobile baseline before theme modifications and repeat identical scenarios after deployment.
- R5. Reduce confirmed unnecessary image/network/JavaScript work and collection layout shifts without sacrificing functional behavior.
- R6. Report raw samples, median/range, environment identity, throttle/cache/consent conditions and residual limitations. Laboratory measurements cannot establish conversion uplift or production field INP p75.

**Delivery**
- R7. Deploy only Dev and verify deployed files and theme identity. Leave production publication to the team.
- R8. Examine additional low-effort improvements; retain only evidence-backed changes, with no arbitrary requirement to reach ten.

### Boundaries

Do not change global apps, consent configuration, catalog, prices, marketing campaigns or real orders. Cart-only session tests are permitted; no payment or newsletter submission. Welcome10 acquisition quality needs analytics attribution and cannot be repaired through theme performance changes alone. Physical iPhone verification remains a team check.

---
## Planning Contract

- KTD1. Use current Dev as the baseline, keep raw browser measurements outside theme assets, and compare at least three repeated runs on key routes (R4, R6).
- KTD2. Protect the custom product purchase state before asynchronous initialization; preserve early checked values rather than resetting them (R1, R3). Verify delayed-script reproduction before implementation.
- KTD3. Make variant rendering latest-request-wins, use the smallest server-rendered fragment compatible with existing selectors, dispose replaced sliders and batch price refreshes (R2, R5). Follow existing AbortController patterns in assets/collection.js.
- KTD4. Adapt gallery image widths and priorities to display size; preserve variant imagery and visual quality (R5).
- KTD5. Replace unsafe collection content visibility only when local countertesting confirms its contribution (R5).

Purchase flow: displayed selections → synchronized form fields → guarded submit → cart response → drawer/checkout. Variant render requests update display only when still current; stale responses never unlock purchasing.

---
## Implementation Units

### U1. Baseline and reproducible defects

Requirements: R1–R6. Dependencies: none.
Files: tests/cart-regressions.test.mjs; measurement scripts in the project deliverable.
Approach: confirm theme identity; record cold mobile load, consent states, collection scrolling, early variant/quantity selection and rapid variant changes. Use actual touch events and intercept only where needed to widen the initialization race. Keep synthetic fault injection distinct from naturally throttled runs.
Scenarios: current slow-network page, blocked business initialization, normal loaded purchase state, collection scroll and variant response reordering.
Verification: numeric baseline and named reproductions; invalid/incomplete runs explicitly excluded.

### U2. Reliable product state and efficient variant refresh

Requirements: R1–R3, R5. Dependencies: U1.
Files: assets/cluutch-main-product.js; assets/cluutch-buy-product.js; snippets/cluutch-product-variant.liquid; sections/cluutch-main-product.liquid; tests/cart-regressions.test.mjs.
Approach: apply KTD2–KTD3 one confirmed cause at a time, with regression proof before each fix. While the latest variant render is pending, keep purchase guarded. If it fails, preserve the selected option, show an inline recoverable error with a retry action, and keep purchase guarded until displayed and submitted state are synchronized by a successful current response.
Scenarios: early x2 selection, variant from URL, unavailable variant, fast repeated changes with responses reversed, failed render request, subscription persistence, cart drawer, direct checkout interception, repeated slider replacement.
Verification: visible state and submitted variant/quantity/plan agree; no stale UI response; a failed latest render exposes recovery and retry restores a coherent purchasable state; fewer transferred bytes and redundant updates where optimized.

### U3. Image and layout improvements

Requirements: R3–R5, R8. Dependencies: U1.
Files: sections/cluutch-main-product.liquid; snippets/cluutch-product-card.liquid; assets/theme.css; layout/theme.liquid only for proven resource scheduling changes.
Approach: KTD4–KTD5; verify each independent change before combining. Preserve globally needed Swiper and marketing functionality.
Scenarios: initial hero on mobile/desktop, later gallery slides, variant gallery replacement, collection scroll at mobile width, orientation/resize, consent refused and accepted.
Verification: lower image transfer or better load timing and collection stability, with no visual/function regression. No unit tests for static low-impact markup where browser checks suffice.

### U4. Dev delivery and comparative proof

Requirements: R4, R6–R8. Dependencies: U2, U3.
Files: final report and evidence in project outputs; PROJECT.md environment facts; plan-linked review notes.
Approach: simplify and review the scoped diff, deploy explicit Dev theme, verify downloaded files, rerun U1 conditions, and prepare team acceptance/rollback instructions. Preserve production and its Git branch. Use a review PR only when its base and scope are unambiguous.
Scenarios: same baseline routes and interactions, deployed theme mismatch fails measurement, desktop smoke, checkout route without completing an order.
Verification: no unresolved critical purchase regression; before/after evidence names actual gains and failures; team can open Dev and reproduce acceptance checks.

---
## Verification Contract

- Run `node --test tests/*.test.mjs` and Shopify Theme Check, comparing findings with the unchanged baseline.
- Browser load comparisons use the same Chromium/device, CPU x4, 150 ms latency, 200000 bytes/s download, cache disabled and fixed consent state. Record at least three samples per principal scenario; disclose noise.
- Functional checks include delayed initialization, rapid selection, sold-out variants, quantity, subscription, cart, consent, and mobile/desktop gallery.
- Improvements require reproduced correctness fixes and measured lower waste or latency on targeted scenarios; no invented minimum score. Any regression in median primary timing must be investigated and reported before acceptance.
- Production theme files and main reference must remain unchanged by this task.

---
## Definition of Done

Confirmed defects are corrected and checked on deployed Dev; measurable changes have comparable evidence; remaining limitations and deferred candidates are explicit. No abandoned experiments remain in theme code. The final report provides preview URL, change inventory, measured results, acceptance checklist and rollback reference. Production publication remains pending team action.
