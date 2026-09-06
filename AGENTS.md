# AGENTS.md — SIAP Panakkukang

React 19 + Vite + React Router 7 + Tailwind 3 + Zustand + Supabase. Queue-calling + public display for Kecamatan Panakkukang. No public self-registration, no loket concept.

## Commands

- `npm install` → `npm run dev` (http://localhost:5173). `npm run build` → `dist/` (Vercel). `npm run preview` to check build. `npm run lint` (oxlint, `.oxlintrc.json`; warnings only, no errors).
- No tests, typecheck, or formatter. Plain `.js/.jsx` — don't add TypeScript unless asked.

## Dual-mode architecture (biggest gotcha)

- `src/lib/supabase.js`: `isSupabaseConfigured = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)`. Empty `.env` → **demo mode** (localStorage), not an error. Restart dev server after changing `.env`.
- Every service in `src/services/` (`queueService`, `masterService`, `authService`, `displayService`) branches on `isSupabaseConfigured`. **New data access must keep both branches** — never call `supabase` directly from components/pages.
- Demo keys: `siap_queues`, `siap_kk_announcements`, `siap_session`, `siap_services_v2`, `siap_requirements`, `siap_information`, `siap_announcements`, `siap_ikd`, `siap_display_images`, `siap_users`, `siap_tts`. Cross-tab/display sync via `siap:queues-changed` / `siap:master-changed` window events + `storage` event — dispatch after every local write.
- Prod setup: run `supabase/schema.sql` in SQL Editor → enable Realtime for `queues`, `announcements`, `display_images`, `kk_announcements`, `broadcasts` → create Auth users + matching `profiles` rows. Schema also creates the public `display-images` bucket + its Storage RLS policies — without them admin upload fails with an RLS violation.

## Conventions

- Flow: page → `src/services/*.js` → Supabase or localStorage. Seeds/constants in `src/lib/constants.js` (`QUEUE_STATUS`, `DEMO_USERS`, `SEED_*` — exactly 3 services: KTP, REKAM, IKD); `todayKey`/`makeQueueNumber` (`PREFIX-N`, tanpa nol depan: `KTP-1`) in `src/utils/date.js`.
- Auth: Zustand `src/stores/authStore.js` hydrated from `siap_session`; `login`/`logout` in `authService.js`. Demo: `admin@panakkukang.go.id`/`admin123`, `petugas1@panakkukang.go.id`/`petugas123`. Guards in `src/routes/AppRoutes.jsx` (`RequireAuth`, `ADMIN`/`PETUGAS`; `/display` public, no layout). `counter_id`/`counter_name` are nulled compat fields only — columns still exist in schema, don't scope by them.
- Queues: prod **must** use RPC `take_queue_number` (transactional, unique per `queue_date` + `service_id`, enforces per-service `daily_quota`); `nextSequenceForService` MAX+1 is demo-only. Physical-coupon workflow: petugas calls the coupon number directly via `callDirect` (creates the exact coupon number if missing, else recalls) from the search-icon modal — no pre-registration needed. Quota via `quotaFor()` (`constants.js` defaults KTP/REKAM 50, IKD 100, overridable per service in Admin → Layanan). Statuses `WAITING → CALLED → SERVING → COMPLETED` + `SKIPPED`. New queues are created by petugas via `takeQueue` ("Tambah" modal in `petugas/Queue.jsx`) — no `/queue/*` take/ticket flow exists. KK cases (BR-09) use `kk_announcements`, no number (`displayService.callKKCase` + `getLatestKK`; Display shows the latest as a 20-sec banner + audio, needs the public SELECT policy in schema).
- Refresh is polling (`useRealtimeQueues(fetchFn, { pollMs: 3000 })` in `src/hooks/hooks.js`) + storage events, not Supabase Realtime subscriptions. TTS via `useSpeech()` (`id-ID`, toggle in `siap_tts`): every call plays `/opening sound.mp3` → announcement 2x → `/closing sound.mp3` (don't rename those files without updating `hooks.js`).
- Routes/pages: `/` redirects to `/login` (no landing page); `public/` is only Information/IKD; `display/Display.jsx`; `auth/Login.jsx` (own chrome — don't wrap in `pub()`); `petugas/` (Queue/History/Profile, `/petugas` → `/petugas/queue`); `admin/` via `AdminShell` + `DashboardLayout` in `src/layouts/layouts.jsx`.
- Sidebar `NavLink` needs `end` (`DashboardNavItem`) or `/admin` stays highlighted on all `/admin/*`.
- UI: `GovLogos` (from `layouts.jsx`, `divider` for login) renders both logos; paths hardcoded (`/logo-kota-makassar.png`, `/logo-kecamatan-panakkukang.png`) — don't rename without updating. Theme navy `#0b1220` + `orange-600`; reuse `btn-primary`/`card`/`input`/`badge` from `src/index.css` and per-service `colorFor` in `petugas/Queue.jsx` (KTP orange, REKAM blue, IKD green).
- Display images: admin page must pass the real `File` to `uploadDisplayImage` (Supabase Storage upload); base64-only silently fell into the demo branch while the list reads the `display_images` table. `getAllDisplayImages` maps `url` via `imageUrl()` — don't return raw `file_path` or admin thumbnails break.
- Display slideshow (`display/Display.jsx`): photos only, one slide per image category (`CATEGORY_ORDER` + `CATEGORY_META` heading), all staff photos of a category shown at once in a horizontal row — except `alur`, which is one image per slide so diagrams stay readable. Never text/info slides (text content belongs only in the bottom ticker). Header text is the current slide's `heading`, not hardcoded.
