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

## 4. Business rules (enforced in database & services)

* One event per calendar day (India time); no event in the past; capacity ≥ current registrations (`validateEvent`).
* One registration per student per event and per day; atomic seat protection.
* Check-in once only → second scan = **Already checked in** with original time.
* Wrong event / wrong hall / fake code / too early → rejected and logged.
* Check-in opens N minutes before start (default 60).
* Organizer event edit: requires admin approval, one save per approval, then re-locked.
* Role security on every endpoint; roles stored in `user_roles`, verified in backend services.

## 5. Tech stack

* **Frontend:** React 19, TanStack Start / Router / Query, Vite 8, TypeScript
* **Styling:** Tailwind CSS v4 + shadcn/ui, glass / dark / light themes, React Three Fiber 3D icons
* **Database:** **MongoDB** (running locally on your PC at `mongodb://127.0.0.1:27017/eventease`)
* **Backend:** Express API server + MongoDB driver with built-in auto-seeding & procedures
* **Libraries:** qrcode.react (QR), html5-qrcode (camera scan), zod, recharts, sonner
* **PWA:** installable (manifest + icons)

## 6. Folder structure

```
backend/
  mongo.ts          -> MongoDB connection manager & automatic index generation
  seed.ts           -> Auto-seed script for demo events, users, passes, and halls
  services.ts       -> Business logic (registration, gate check-in, tickets, roles)
  app.ts            -> Express API router (/api/auth, /api/rpc, /api/data, /api/presence)
  server.ts         -> Standalone server runner (listening on port 5000)
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
  integrations/     -> local database client adapter (connects to local MongoDB)
  styles.css        -> design tokens (colors, fonts, glass, themes)
public/             -> icons, manifest (PWA)

```

## 7. Database (MongoDB)

Collections in `eventease`:
* `users` & `profiles` – account details, credentials & user info
* `user_roles` – access permissions (admin, organizer, student)
* `events` – title, dates, capacity, venue, banners, edit locks
* `participants` – attendee registrations with unique QR codes (`EE-XXXXXX`)
* `event_zones` & `zone_staff` – hall division and staff hall permissions
* `scan_logs` – gate scan audit trail (success, duplicate, wrong event, too early)
* `support_tickets` & `event_edit_requests` – help requests & event change requests

Key services:
* `registerParticipant` – validates, checks capacity & duplicates, generates unique code
* `checkInParticipant` – gate/hall-only check; returns success / duplicate / invalid / wrong hall / too early
* `getTicket` – public pass lookup by code
* `getStats` – live registration & attendance counts

## 8. Run locally

Requirements: Node 20+ or Bun, and MongoDB running on your PC.

```bash
npm install         # Install dependencies
npm run dev         # Starts frontend + local MongoDB backend (http://localhost:8080)
```

Optional commands:
```bash
npm run server      # Run standalone backend server on port 5000
npm run seed        # Re-populate / verify demo data in MongoDB
npm test            # Run unit tests
npm run build       # Production build
```

`.env` configuration:

```env
MONGODB_URI="mongodb://127.0.0.1:27017/eventease"
PORT=5000
VITE_API_URL="/api"
```


## 9. Demo scenario (for judges / presentation)

1. Login as Organizer → **New event** (capacity e.g. 50).
2. Login as Student → Explore → Register → QR pass appears.
3. Organizer → **Check-in** → scan/enter code → ✅ Checked in.
4. Scan again → ❌ Already checked in (duplicate blocked).
5. Dashboard counts update live. Admin console shows users online, approvals, halls.
