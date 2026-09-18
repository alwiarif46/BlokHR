# BlokHR Apex (React)

React + TypeScript + Tailwind + shadcn-style UI workspace for the Apex signup portal.

## Commands

```bash
npm install
npm run dev          # standalone preview on :5173
npm run build:apex   # emit ESM + CSS to ../frontend/apex/
```

## Surfaces

- Hash-routed pages (`/`, `/modules`, `/setup`, `/access`, `/campus`, `/workforce`, `/pricing`) via `app/apex/router.tsx`
- Shared chrome in `app/apex/shell.tsx`; mosaic-themed draggable boards per page
- Light / dark themes via `ThemeProvider`

Vanilla shell mounts the built bundle from `frontend/modules/landing/landing.js` when `/apex/apex.js` is available.
