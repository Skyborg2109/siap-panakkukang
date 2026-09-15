# AGENTS.md — SIAP Panakkukang

React 19 + Vite + React Router 7 + Tailwind 3 + Zustand + Supabase. Queue-calling + display TV for Kecamatan Panakkukang. Roles are only `ADMIN`/`PETUGAS` — no loket concept in auth, no `WARGA` role.

> `README.md` / `prd.md` are stale — trust code + this file. Outdated claims: 3 services (now 5), "no ticket-taking by warga" (now `/ambil-antrean`), login-free `/display` (now requires login), Vercel deploy (now GitHub Pages), Supabase Realtime + Replication setup (now polling), `PREFIX-001` zero-padded numbers (now `PREFIX-N`, no padding).

## Commands

- `npm install` → `npm run dev` (http://localhost:5173). `npm run build` → `dist/` (`npm run preview` to check).
- `npm run lint` is oxlint, warnings-only expected (notably `set-state-in-effect` across polling effects). No tests, typecheck, or formatter. Plain `.js/.jsx` — don't add TypeScript.
- Deploy: GitHub Pages via `.github/workflows/deploy.yml` (push to `main`, needs `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` secrets; copies `dist/index.html` → `dist/404.html` for SPA fallback). `vite.config.js` sets `base: '/siap-panakkukang/'` and `main.jsx` sets `BrowserRouter basename={import.meta.env.BASE_URL}` — internal `<Link to="/...">` paths stay root-style, but **public-asset URLs must use `${import.meta.env.BASE_URL}...`**, never a leading `/` (see logos in `layouts.jsx`, audio in `hooks.js`).

## Dual-mode data (biggest gotcha)

- `src/lib/supabase.js`: `isSupabaseConfigured = Boolean(URL && ANON_KEY)`. Empty/missing `.env` → **demo mode** (localStorage), not an error. There is **no `.env.example`** (README's `cp .env.example` is stale) — edit `.env` directly, restart dev server.
- Every service in `src/services/` (`queueService`, `masterService`, `authService`, `displayService`) branches on `isSupabaseConfigured`. **New data access must keep both branches** — never call `supabase` from components/pages.
- Demo keys: `siap_queues`, `siap_kk_announcements`, `siap_broadcasts`, `siap_session`, `siap_services_v2` (note `v2`), `siap_requirements`, `siap_information`, `siap_announcements`, `siap_ikd`, `siap_display_images`, `siap_users`, `siap_tts`, `siap_my_tickets`. Queue writes dispatch `siap:queues-changed`, master writes dispatch `siap:master-changed` (+ `storage` cross-tab) — dispatch the matching event after every local write. `withMissingSeeds()` in `masterService.js` appends new `SEED_SERVICES` into existing `siap_services_v2` without wiping admin edits.
- Prod DB: run `supabase/schema.sql` in SQL Editor — it creates tables, RPCs, RLS, seeds, **and** the public `display-images` bucket + Storage policies (without it, admin upload fails with RLS violation). Refresh is polling (`useRealtimeQueues(..., { pollMs: 3000 })` + storage events), **not** Supabase Realtime subscriptions — no Replication setup needed.

## Routes / auth

- `src/routes/AppRoutes.jsx`: `/` → `/ambil-antrean` (public ticket page is the landing). `public/` pages use `pub()` layout; `Login.jsx` has its own chrome (don't wrap it). Admin pages wrap in `AdminShell` → `DashboardLayout` (`layouts.jsx`).
- `/display` is `RequireAuth(PETUGAS/ADMIN)` — TV logs in once as petugas. `PublicLayout` (warga) must **never** link to `/display`; staff `DashboardLayout` links to it only via sidebar quickLinks ("Monitor Antrean", `external`, opens in new tab) — no header pill — that's intentional.
- Auth: Zustand `authStore.js` from `siap_session`; demo `admin@panakkukang.go.id`/`admin123`, `petugas1@panakkukang.go.id`/`petugas123`. `counter_id`/`counter_name` are nulled compat fields (columns still in schema) — don't scope by them.
- Sidebar `NavLink` needs `end` (`DashboardNavItem`) or `/admin` stays highlighted on all `/admin/*`.

## Queues

- Numbers are `PREFIX-N` without leading zeros via `makeQueueNumber` (`utils/date.js`); day key via `todayKey()`. 5 services in `constants.js` `SEED_SERVICES` (KTP, REKAM, IKD, KKO = KK Online Lontara+, KKB = KK Biasa). Statuses `WAITING → CALLED → SERVING → COMPLETED` + `SKIPPED`.
- Prod **must** use RPCs: `take_queue_number` (transactional, per-service `daily_quota`, granted to `anon` so warga can self-serve) and `call_direct_number` (SECURITY DEFINER; the `public insert queue` RLS policy only allows `WAITING` rows, so a direct `CALLED` insert is rejected — fallback to direct insert only on missing function, code `42883`). `nextSequenceForService` MAX+1 is demo-only.
- Physical-coupon workflow is free-order: `callDirect` creates the exact coupon number if missing, else recalls; gaps/skips allowed, no sequential guard. `callDirectMany` parses `5,6,7` / `5-8` via `parseQueueNumbers` (max `MAX_BATCH_CALL = 10`, sorted ascending) with one shared `called_at` — Display groups same-`called_at` CALLED rows as companions (chips + combined TTS `announceQueues`). Quota via `quotaFor()` (defaults KTP/REKAM 50, IKD 100, overridable per service).
- Call destination: `isLoketService()`/`callDestination()` in `constants.js` (pattern-based so admin prefix variants like `KKONLINE` still resolve). Use them for new call text instead of hardcoding.
- Don't confuse the three announcement channels: `announcements` = bottom ticker; `kk_announcements` (`callKKCase`/`getLatestKK`, BR-09, no number) and `broadcasts` (`sendBroadcast`/`getLatestBroadcast`, spontaneous) = ~20-sec banner + audio each.

## Warga ticket page / TTS / display

- `public/TakeQueue.jsx` at `/ambil-antrean`: no login (anon `take_queue_number` RPC + `public insert queue` RLS allow it). Multi-select takes one number per checked service; tickets persist per-day in `siap_my_tickets` (karcis view, live status poll 3s). On CALLED/SERVING it vibrates + shows orange banner + sets `document.title` — user must keep page open. No print button, no monitor links on warga UI.
- TTS `useSpeech()` (`hooks.js`): `id-ID`, toggle in `siap_tts`, opening sound → announcement 2x → closing sound. Audio filenames contain a space (`opening sound.mp3`) — don't rename without updating `hooks.js`. Display TTS stays silent until first user gesture (browser autoplay policy).
- Display slideshow (`Display.jsx`): one slide per image category (`CATEGORY_ORDER`/`CATEGORY_META` heading); staff photos of a category render together in a row, `alur` one image per slide. Text lives only in the ticker — the single `info` slide is just the empty-state fallback when no images exist.
- Admin upload must pass the real `File` to `uploadDisplayImage` (Storage upload in prod); base64-only silently takes the demo branch. `getAllDisplayImages` maps `url` via `imageUrl()` — don't return raw `file_path`.
- Multiline admin content (IKD/Information) may contain literal `\n` — render with `.replace(/\\n/g, '\n')` + `whitespace-pre-line` (as `IKD.jsx`/`Information.jsx` do).
- UI: `GovLogos` from `layouts.jsx`; theme navy `#0b1220` + `orange-600`; reuse `btn-primary`/`card`/`input`/`badge` from `index.css`.
