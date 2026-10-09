# EventEase — College Event Registration & Check-In

### 👥 Team: NexGen Coders

* **Team Leader:** Hemang Lakhadiya ([lakhadiyahemang@gmail.com](mailto:lakhadiyahemang@gmail.com))
* **Team Members:**
* Mann Bhatasana ([mannbhatasana111@gmail.com](mailto:mannbhatasana111@gmail.com))
* Yuvraj Gosai ([yuvrajgosai29@gmail.com](mailto:yuvrajgosai29@gmail.com))
* Kuldeepsinh Jadeja ([kpjadeja1304@gmail.com](mailto:kpjadeja1304@gmail.com))



---

## 1. Problem & Solution

Organizers manage registrations and attendance with scattered forms and spreadsheets → duplicate entries, slow gates.
EventEase is one real-time platform: organizers create events with capacity, students register and get a **unique QR pass + entry code (EE-XXXX-XXXX)**, staff scan at the gate, and **duplicate / wrong-event / wrong-hall / too-early scans are rejected** by the database.

## 2. Demo Login (ID / Password)

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@gmail.com | EventEase@123 |
| Organizer | Organizer@gmail.com | EventEase@123 |
| Student | Student@gmail.com | EventEase@123 |

> **Note:** If you import the backend into a NEW database, these accounts must be created again (Sign up page). The very first account created becomes Admin.

## 3. Roles

| Role | Can do |
| --- | --- |
| **Student** | Sign up, explore events, register (login required), view/download QR pass, change or cancel registration before event starts, rules page, raise help requests & read replies, profile. |
| **Organizer** | Create / edit (with admin approval) / close / delete events, halls, participants, camera + manual check-in (only own hall), analytics, security scan log, support inbox, CSV export. |
| **Admin** | Everything + approve/reject organizer requests and event-edit requests, create/convert organizers, assign multiple organizers to halls, manage roles, live online users. |

## 4. Business rules (enforced in database)

* One event per calendar day (India time); no event in the past; capacity ≥ current registrations (`validate_event` trigger).
* One registration per student per event and per day; atomic last-seat protection (locked transaction).
* Check-in once only → second scan = **Already checked in** with original time.
* Wrong event / wrong hall / fake code / too early → rejected and logged.
* Check-in opens N minutes before start (default 60).
* Organizer event edit: requires admin approval, one save per approval, then re-locked.
* Row-Level Security on every table; roles stored in `user_roles`, checked by `has_role()`.

## 5. Tech stack

* **Frontend:** React 19, TanStack Start / Router / Query, Vite 7, TypeScript
* **Styling:** Tailwind CSS v4 + shadcn/ui, glass / dark / light themes, React Three Fiber 3D icons
* **Backend:** PostgreSQL + Auth + Realtime + Storage (Supabase-compatible, via Lovable Cloud)
* **Libraries:** qrcode.react (QR), html5-qrcode (camera scan), zod, recharts, sonner
* **PWA:** installable (manifest + icons)

## 6. Folder structure

```
backend/
  schema.sql        -> all tables, enums, SQL functions, triggers, RLS policies
  demo-data.sql     -> demo events, halls, participants, support tickets
src/
  routes/           -> pages (file-based routing)
    index.tsx             /               landing page
    auth.tsx              /auth           login / signup (role picker)
    explore.tsx           /explore        public event discovery
    register.$eventId    /register/:id   registration + ticket
    ticket.$code          /ticket/:code   digital pass + live status
    _authenticated/       login-protected pages:
      dashboard, events, events/:id, check-in, participants, analytics,
      security, support, admin, profile, help, rules, my-passes
  components/       -> AppShell, Ticket, CheckInPanel, ZonesPanel, dialogs, ee/ UI kit
  lib/              -> auth, roles, events, presence, zones, picked-event helpers
  integrations/     -> backend client
  styles.css        -> design tokens (colors, fonts, glass, themes)
public/             -> icons, manifest (PWA)

```

## 7. Database

Tables: `events`, `participants`, `scan_logs`, `event_zones` (halls), `zone_staff`, `user_roles`, `profiles`, `organizer_requests`, `event_edit_requests`, `support_tickets` / messages, etc. (see `backend/schema.sql`).

Key SQL functions:

* `register_participant` – validates, checks capacity & duplicates, generates unique code (atomic)
* `check_in_participant` – organizer/hall-only; returns success / duplicate / invalid / wrong hall / too early
* `get_ticket` – public pass lookup by code
* `event_stats` – registration & attendance counts
* `has_role` – role check used by RLS

## 8. Run locally

Requirements: Node 20+ or Bun.

```bash
bun install         # or npm install
bun run dev         # http://localhost:8080
bun run build       # production build
bun run test        # tests

```

`.env` must contain:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...

```

*(The included `.env` points to the live project backend, so the app works immediately.)*

### Own backend (optional)

1. Create a new Supabase/Postgres project.
2. Run `backend/schema.sql`, then `backend/demo-data.sql` in the SQL editor.
3. Create a public bucket for event images, enable Email + Google auth.
4. Put the new URL / keys in `.env`.

## 9. Demo scenario (for judges)

1. Login as Organizer → **New event** (capacity e.g. 50).
2. Login as Student → Explore → Register → QR pass appears.
3. Organizer → **Check-in** → scan/enter code → ✅ Checked in.
4. Scan again → ❌ Already checked in (duplicate blocked).
5. Dashboard counts update live. Admin console shows users online, approvals, halls.
