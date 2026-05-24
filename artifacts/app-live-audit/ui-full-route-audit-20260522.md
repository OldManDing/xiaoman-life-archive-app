# App UI Full Route Audit 2026-05-22

## Scope

- Web App route screenshot sweep via `e2e/visual.spec.ts`
- Native shell verification on `emulator-5554`
- Focus areas: record create/detail/edit actions, blank-screen regressions, route-level layout overflow, button hierarchy, mobile page rhythm

## Fixed In This Round

1. Record edit blank screen
   - Root cause: `EditRecordPage` called `useMemo` only after loading/error branches, changing hook order after async data loaded.
   - Fix: keep the memoized edit form model hook unconditional and return `null` only after guard branches.
   - Regression: `e2e/app.spec.ts` now covers detail -> edit navigation.

2. Record page duplicated submit action
   - Root cause: create/edit forms rendered submit in both top bar and bottom action group.
   - Fix: remove the top bar submit action and keep the bottom `存为草稿 / 发布|保存` pair as the single form action group.

3. Record detail action buttons
   - Root cause: `编辑记录` and `删除记录` used a flexible row that produced uneven button widths.
   - Fix: convert to a two-column full-width action group with clearer primary/destructive hierarchy.

4. UI coverage gap
   - Added full-page screenshots for edit record, record detail, family child, family members, account, settings, account deletion, legal, and error pages.

5. Record media action button layout
   - Root cause: after a record already had media, the add-photo and record-audio action tiles stayed in a horizontal strip. On mobile this exposed a partial third tile at the right edge and read as a broken button layout.
   - Fix: switch the populated media/action area to a two-column grid, keep empty-state actions as a paired uploader, and keep the helper text below the grid.
   - Detail action polish: record detail AI action buttons now keep 44px touch height, and edit/delete actions include icons with clearer primary/destructive hierarchy.

## Evidence

- Web all-page contact sheet: `artifacts/visual-review-current/app-all-pages-contact-sheet-current.png`
- Web record edit long screenshot: `artifacts/visual-review-current/app-record-edit-mobile-long.png`
- Web record detail long screenshot: `artifacts/visual-review-current/app-record-detail-mobile-long.png`
- Native record create final: `artifacts/app-live-audit/native-record-create-fullshot-no-duplicate-action.png`
- Native record edit final: `artifacts/app-live-audit/native-record-edit-fullshot-no-duplicate-action.png`
- Native record detail final: `artifacts/app-live-audit/native-record-detail-fullshot-button-final.png`
- Native record edit post-fix long screenshot: `artifacts/app-live-audit/native-record-edit-cdp-longshot-post-grid-fix.png`
- Native record edit bottom actions: `artifacts/app-live-audit/native-record-edit-actions-post-grid-fix.png`
- Native record detail/edit click check: `artifacts/app-live-audit/native-click-check-edit-after-loaded.png`

## Verification 2026-05-22

- `npm.cmd run typecheck:web`: pass
- `npm.cmd run test:web`: pass, 12 tests
- `npx.cmd playwright test e2e/visual.spec.ts --grep "captures App key screens" --project=chromium`: pass
- `npx.cmd playwright test e2e/app.spec.ts --grep "record detail opens edit" --project=chromium`: pass
- `npm.cmd run sync:mobile`: pass
- `gradlew.bat installDebug` with Android Studio JBR 21: pass, installed on `emulator-5554`
- Native WebView click check: `记录详情 -> 编辑记录` navigates to `/record/r_demo_001/edit` and renders title/input/actions.

## Current UI Verdict

- Record create/edit/detail: pass for release-candidate UI after this round.
- Primary action hierarchy: pass. Record pages now have one clear submit area.
- Route-level overflow: pass in Playwright visual sweep; no page in the contact sheet shows horizontal overflow.
- Native shell rendering: pass for record create/edit/detail on emulator.
- Overall page set: visually coherent and professional enough for the current release-candidate pass. Remaining concerns are data-density cleanup, not blocking UI defects.

## Residual Notes

- `family/members` can become very long when local test data contains many invited accounts. The page remains usable and does not overflow horizontally, but production data cleanup or pagination would improve scanning if this volume is expected.
- Some generated test accounts still appear in local screenshots. This is local data state, not a layout defect.
- Some native direct-route checks show the bootstrapping text before auth hydration finishes. It resolves to the real page after the API session refresh returns; the actual detail-to-edit click path no longer blanks.
