# Errors

## [ERR-20260507-001] npm-install-timeout

**Logged**: 2026-05-07T14:40:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
`npm install lucide-react -w apps/web` timed out while adding the icon dependency.

### Error
```text
command timed out after 124035 milliseconds
```

### Context
- Command attempted from `D:\disk\小满人生档案馆APP`.
- Dependency files did not show `lucide-react` after the timeout.
- The implementation still needs icon-like navigation for Figma alignment.

### Suggested Fix
Either retry with a longer timeout or avoid a new dependency by using a small local icon component set for the current MVP.

### Resolution
Retried with a longer timeout. `lucide-react` is installed in `apps/web`, and Playwright visual review confirmed the bottom navigation icons render correctly.

### Metadata
- Reproducible: unknown
- Related Files: apps/web/package.json

---

## [ERR-20260509-001] prisma-dbpush-env-not-loaded

**Logged**: 2026-05-09T10:15:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: backend

### Summary
`npm run prisma:dbpush` failed because Prisma CLI executed in the `apps/api` workspace did not load the root `.env`.

### Error
```text
Environment variable not found: DATABASE_URL.
```

### Context
- Command attempted from `D:\disk\小满人生档案馆APP`.
- Workspace script runs Prisma from `apps/api`, while `DATABASE_URL` is defined in the repository root `.env`.

### Resolution
Ran the command with `DATABASE_URL` explicitly injected:

```powershell
$env:DATABASE_URL='mysql://xiaoman:password@localhost:3307/xiaoman_archive'; npm run prisma:dbpush
```

### Metadata
- Reproducible: yes
- Related Files: apps/api/package.json, .env

---
