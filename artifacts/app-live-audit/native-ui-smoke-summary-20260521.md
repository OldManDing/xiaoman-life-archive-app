# Native Shell UI Smoke 2026-05-21

## Scope

- `https://localhost/home`
- `https://localhost/timeline`
- `https://localhost/record/create?type=text&focus=content`
- `https://localhost/family`
- `https://localhost/profile`
- `https://localhost/profile/settings`
- `https://localhost/profile/security`
- `https://localhost/profile/account-delete`

## Result

- Passed for this smoke round.
- No blank screen found.
- No route break found.
- No obvious layout overlap found in the captured screens.

## Evidence

- Structured result: `android-ui-smoke.json`
- Network log: `android-ui-smoke-network.json`
- Screens:
  - `native-ui-smoke-home.png`
  - `native-ui-smoke-timeline.png`
  - `native-ui-smoke-record-create.png`
  - `native-ui-smoke-family.png`
  - `native-ui-smoke-profile.png`
  - `native-ui-smoke-profile-settings.png`
  - `native-ui-smoke-profile-security.png`
  - `native-ui-smoke-account-delete.png`

## Notes

- This was a page-level smoke pass in the native shell, not a full regression of every interactive branch.
- `profile/account-delete` correctly showed the guarded state for the current demo account, with the submit button disabled before prerequisite family cleanup.
