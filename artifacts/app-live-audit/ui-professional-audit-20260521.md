# UI Professional Audit 2026-05-21

## Long screenshot capability

- Solved on emulator with `emulator-longshot.py`.
- It captures multiple emulator screens, scrolls between frames, and stitches them into one PNG.

## Screens reviewed

- `emulator-home-long.png`
- `emulator-record-long.png`
- `emulator-profile-long.png`
- `emulator-family-long.png`
- `emulator-timeline-current.png`

## Verdict

- Overall visual quality is **above average and close to professional**, but not yet at a clean release-grade level.
- The app has a coherent warm neutral theme, decent icon consistency, and generally stable card spacing.
- The main remaining gap is **layout discipline** rather than missing styling.

## Findings

### P1 Record create page still feels too empty and over-separated

- The create page uses a very tall text area and large vertical gaps, which leaves a weak content rhythm in the first half of the page.
- The result is that the AI block and optional metadata feel visually detached from the main form instead of supporting it.
- Code anchors:
  - `apps/web/src/pages/record-pages.tsx:877`
  - `apps/web/src/pages/record-pages.tsx:908`
  - `apps/web/src/pages/record-pages.tsx:1038`

### P2 Home page first screen is attractive but oversized

- The hero progress card plus the prompt card consume too much of the first viewport.
- This makes the page feel polished but slightly promotional, while the product is really an operational journaling tool.
- Code anchors:
  - `apps/web/src/pages/home-pages.tsx:200`
  - `apps/web/src/pages/home-pages.tsx:297`
  - `apps/web/src/pages/home-pages.tsx:304`

### P2 Profile page is clean but too repetitive

- The profile page keeps good consistency, but the card list is visually repetitive and low-information.
- Too many rows share the same visual weight, so scanning efficiency is weaker than it should be for a mature app.
- Code anchors:
  - `apps/web/src/pages/profile-pages.tsx:94`
  - `apps/web/src/pages/profile-pages.tsx:302`
  - `apps/web/src/pages/profile-pages.tsx:314`

### P2 Timeline page is structurally sound, but the upper filter area feels heavy relative to the amount of visible record content

- The filter chips are readable, but they take a lot of height before the actual archive list starts.
- The page would feel more professional if the list content appeared sooner and the filter row compressed more aggressively.

## Theme assessment

- Theme cohesion: good
- Typography hierarchy: mostly good
- Icon language consistency: good
- Information density: uneven
- Professional release feel: not yet fully there

## Recommendation

1. Tighten the record-create page first.
2. Compress the home hero stack.
3. Reduce repeated list-row sameness in profile and timeline.
