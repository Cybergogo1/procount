# ProCount

> Scan. Count. Done.

A phone-only inventory counting app for retail staff. Fast **Scan → Count →
Timestamp → Email** workflow that replaces paper tally sheets. Built per the
Nova Labs V1 scope (see [`../procount_claude_code_prompt.md`](../procount_claude_code_prompt.md)).

## Tech stack

- **Expo (managed)** + **Expo Router** — React Native, file-based routing
- **TypeScript** (strict)
- **Supabase** — Postgres, Auth, Edge Functions
- **Zustand** — local session state · **TanStack Query** — server state
- **RevenueCat** — subscriptions · **expo-camera** — barcode scanning
- **EAS Build** — iOS/Android binaries

## Project status

Build brief Section 17, steps 1–5 done:

- ✅ Expo + Expo Router + TypeScript scaffold, `@/` import alias
- ✅ Theme: colours, Oswald + Inter fonts, design tokens
- ✅ Supabase schema, RLS, triggers (`supabase/migrations/0001_init.sql`)
- ✅ Supabase client with chunked SecureStore session persistence + TanStack Query
- ✅ Auth: email/password sign-up & sign-in (react-hook-form + zod), session
  provider, root auth gate, sign-out
- ✅ Subscription gate scaffold (`useAccess` — always grants for now)
- ✅ Zustand `useSessionStore` + Scanner UI shell: live count, quantity
  controls, multiplier, recent-scans list, inline edit, delete + undo
- ✅ Camera + barcode scanning (expo-camera), pause-on-read, success haptic +
  beep cue, camera-permission gate with graceful denial (Sections 6 & 13)
- ✅ Background sync layer (Sections 7–8): in-memory queue with FIFO ordering,
  exponential backoff (1/2/4/8…→30s), NetInfo online-gating, quantity-edit
  coalescing, "Syncing…/Synced" badge, End Session held until writes drain.
  Pure queue logic covered by Jest (`npm test`)
- ✅ End Session & Export (Section 9): modal sheet (email + CSV/Excel toggle),
  `send-session-report` Edge Function (Deno) generating CSV/XLSX via SheetJS and
  emailing via Resend, then starting a fresh session. Report generation +
  delivery covered by Deno tests
- ✅ RevenueCat (Section 10): 7-day in-app trial + `procount_pro` entitlement
  (store trial takes precedence), entitlement checks on launch/foreground,
  dynamic-price paywall, restore purchases, live subscription status in
  Settings, real access gate routing to the paywall when blocked
- ✅ Polish & delivery (Sections 12–15): permission/error/empty states, root
  error boundary, `eas.json` build profiles, `docs/QA.md` manual checklist

All feature sections of the build brief are implemented. Remaining work is
device-side: real Supabase/RevenueCat/Resend credentials, a dev/preview build,
and a pass through `docs/QA.md` on a physical phone.

> The Scanner has a **DEV: simulate scan** button (dev builds only) so the full
> count flow is testable on a simulator/web without a physical camera.

### Configuration needed to run

The app reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` at
startup and throws a clear error if they're missing. Create `.env` (below)
before `npx expo start`.

## Getting started

### 1. Install dependencies

```bash
npm install
```

> This project pins `react-dom` to match Expo's `react` version. If `npm
> install` reports an `ERESOLVE` peer conflict after a dependency bump, align
> `react`/`react-dom` to the same version that `expo` expects.

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in your Supabase URL/anon key and RevenueCat public keys. `EXPO_PUBLIC_*`
vars are bundled into the client — never put secrets there. For EAS builds the
same values are managed as **EAS Secrets** (build brief Section 14).

### 3. Run locally

```bash
npx expo start
```

Press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with a
development build / Expo Go. Camera features require a real device or a dev
build.

## Supabase

### Apply migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/*
```

Or for a local stack: `supabase start` then `supabase db reset`.

### Regenerate database types

```bash
supabase gen types typescript --linked > src/types/database.ts
```

(`src/types/database.ts` is currently a hand-authored mirror of the migration.)

### Deploy the export Edge Function

```bash
supabase functions deploy send-session-report
supabase secrets set RESEND_API_KEY=...        # Resend API key
supabase secrets set REPORT_FROM_EMAIL=reports@procount.app
```

_(The function lands in Section 9 of the build.)_

## Testing

```bash
npm test         # Jest — unit tests for the sync queue logic
npm run typecheck  # tsc --noEmit
```

The brief targets confidence on critical paths rather than coverage. The sync
queue (`src/features/session/syncQueue.ts`) is the trickiest piece and is unit
tested for FIFO ordering, backoff, offline gating, coalescing and drain.

The Edge Function's report generation and email delivery are tested with Deno:

```bash
cd supabase/functions/send-session-report
deno test --allow-read --allow-env
```

## Build (EAS)

```bash
npm install -g eas-cli
eas build --profile development  # dev client (needed to test camera/IAP on device)
eas build --profile preview      # internal testing (TestFlight / internal track)
eas build --profile production
```

Profiles live in `eas.json`. The `EXPO_PUBLIC_*` values (Supabase + RevenueCat
keys) are provided as **EAS environment variables / secrets** per the build
brief, e.g.:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>
eas env:create --name EXPO_PUBLIC_REVENUECAT_APPLE_KEY --value <apple-key>
eas env:create --name EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY --value <google-key>
```

> Camera, haptics, audio and RevenueCat need a **development or preview build on
> a physical device** — they don't work in Expo Go or a simulator. A dev-only
> "simulate scan" button on the Scanner covers the rest of the flow elsewhere.

See [`docs/QA.md`](docs/QA.md) for the manual test checklist.

## Project structure

```
app/            Expo Router routes ((auth) + (app) stacks)
src/
  components/   Reusable UI (Button, Screen, …)
  features/     Feature logic (scanner, session, export, subscription, auth)
  lib/          Clients (supabase, revenuecat) + haptics/audio helpers
  stores/       Zustand stores (useSessionStore)
  theme/        Colours, typography, design tokens
  types/        Supabase database types
supabase/
  migrations/   SQL schema, RLS, triggers
  functions/    Edge Functions
assets/         Icons, splash, logo, beep
```

## Conventions

- Strict TypeScript, no `any` without a comment justifying it.
- Functional components only. One component per file.
- Absolute imports via `@/` (maps to `src/`).
- Components never call Supabase directly — go through typed wrappers in
  `src/features/*`.
