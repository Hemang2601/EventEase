# 📚 EventEase — Complete Project & Architecture Guide
> **Purpose of this document:** A simple, comprehensive guide to help you explain the EventEase project to teachers, judges, teammates, or interviewers.

---

## ⚡ 1. The 30-Second Pitch (How to Explain It Fast)
> *"EventEase is an all-in-one college event management and attendance platform. Organizers can create events and manage entry halls, students register and receive a tamper-proof QR code pass (`EE-XXXX-XXXX`), and gate staff scan tickets in real-time using their phone camera or laptop. Unlike regular Google Forms or spreadsheet setups, our database strictly prevents duplicate check-ins, rejects wrong events or wrong hall entries, and stops registrations once capacity is reached."*

---

## 🗺️ 2. Where is Frontend vs. Backend?

```
EventEase/
├── 🌐 FRONTEND               --> Located in the "src/" folder
│   ├── src/routes/           --> Every screen / page of the website
│   ├── src/components/       --> Reusable visual UI blocks (modals, tickets, scanner)
│   ├── src/lib/              --> Frontend helper logic, state & event picker
│   ├── src/styles.css        --> Colors, themes (Dark/Light), glassmorphism design
│   └── src/integrations/     --> API connection bridge to the database
│
├── ⚙️ BACKEND                --> Located in "backend/" & "drizzle/" & Database
│   ├── backend/schema.sql    --> Core database tables, security rules (RLS), and SQL functions
│   ├── backend/demo-data.sql --> Sample events, users, passes, and test data
│   ├── drizzle/migrations/   --> History of database version upgrades (0000 to 0013)
│   └── supabase/             --> Backend server configuration
│
└── 📄 CONFIGURATION & DOCS
    ├── package.json          --> Project libraries, packages, and scripts
    ├── vite.config.ts        --> Frontend bundler setup
    └── README.md             --> Quick project overview and run commands
```

---

## 🖥️ 3. Detailed Frontend Breakdown (`src/`)

The frontend is built using **React 19**, **TanStack Router / Start** (file-based routing), **TypeScript**, and **Tailwind CSS v4** with **shadcn/ui**.

### A. Pages / Screens (`src/routes/`)
TanStack Router creates web pages automatically from the file names inside `src/routes/`:

#### 🌍 Public Pages (Anyone can view):
1. **`src/routes/index.tsx` (Landing Page `/`)**:
   - Modern hero section with 3D animated icons (using Three.js / React Three Fiber).
   - Shows platform highlights, live statistics counter, and workflow explanation.
2. **`src/routes/auth.tsx` (Login / Sign Up `/auth`)**:
   - Clean authentication interface for Students and Organizers.
   - Includes role selection during signup and demo account auto-fill.
3. **`src/routes/explore.tsx` (Browse Events `/explore`)**:
   - Public event discovery portal with category filters (Technical, Cultural, Sports, Workshops) and search.
4. **`src/routes/register.$eventId.tsx` (Event Registration `/register/:eventId`)**:
   - Dynamic registration form for students. Enforces logged-in verification and shows instant QR ticket upon success.
5. **`src/routes/ticket.$code.tsx` (Public QR Pass `/ticket/:code`)**:
   - Live digital pass page accessible via QR code scan. Shows attendee name, event details, status badge (Valid, Checked-In, Cancelled).

#### 🔒 Authenticated / Organizer / Admin Pages (`src/routes/_authenticated/`):
All these pages are protected by `AppShell.tsx` (sidebar, navbar, user avatar, theme toggle):
1. **`dashboard.tsx` (`/dashboard`)**:
   - Executive dashboard showing total registrations, check-in percentage, upcoming schedules, and recent activity.
2. **`events.index.tsx` & `events.$eventId.tsx` (`/events`)**:
   - Event creation, list, and detailed event settings.
3. **`check-in.tsx` (`/check-in`)**:
   - **Gate Check-In Screen**: Supports live camera QR scanning (via HTML5-QRCode) and manual code entry.
   - Displays instant audio/visual feedback: ✅ Success, ⚠️ Already Checked In, ❌ Invalid / Wrong Hall.
4. **`participants.tsx` (`/participants`)**:
   - Complete roster of attendees with search, filter by hall/zone, manual check-in override, and **1-click CSV export**.
5. **`analytics.tsx` (`/analytics`)**:
   - Visual charts (powered by Recharts) breaking down registration velocity, hourly check-in traffic, and department stats.
6. **`security.tsx` (`/security`)**:
   - Audit trail of gate activity, highlighting duplicate scan attempts, rejected codes, and timestamped gate logs.
7. **`admin.tsx` (`/admin`)**:
   - Dedicated master admin screen to approve organizer upgrade requests, review event edit proposals, and view live active users.
8. **`my-passes.tsx` (`/my-passes`)**:
   - Student dashboard where logged-in students can view and download all their event passes.
9. **`support.tsx` & `help.tsx`**:
   - Real-time help desk where students can raise queries and organizers can respond.
10. **`profile.tsx` & `rules.tsx`**:
    - User account management and campus conduct guidelines.

---

### B. Core Frontend Components (`src/components/`)
- **`AppShell.tsx`**: The master layout wrapper containing navigation, role checks, event selector, and responsive sidebar.
- **`Ticket.tsx`**: Renders the scannable QR ticket card (dark-on-white high contrast for 100% camera readability).
- **`CheckInPanel.tsx`**: Handles camera stream, barcode detection, sound effects, and verification results.
- **`ZonesPanel.tsx`**: Allows organizers to divide large auditoriums into multiple halls/zones (e.g., Ground Floor, Balcony).
- **`EventCard.tsx`**: Event card display used in the Explore and Dashboard views.
- **`CreateEventDialog.tsx` & `EditEventDialog.tsx`**: Modals for setting event date, capacity, venue, and banner images.
- **`ThemeControl.tsx`**: Light / Dark / System theme switcher with instant CSS variable toggling.
- **`ui/` (shadcn UI kit)**: Modular, accessible UI elements (Dialog, Button, Input, Table, Tabs, Badge, Toast, Dropdown).

---

### C. State Management & Helper Library (`src/lib/`)
- **`use-picked-event.ts`**: Persists the currently selected event in `localStorage` so that when an organizer switches between Dashboard, Check-In, and Analytics, the same event stays selected.
- **`auth.ts` & `roles.ts`**: Client-side role resolution (Student, Organizer, Admin) and session listeners.
- **`integrations/supabase/client.ts`**: The initialized Supabase browser client that connects React with PostgreSQL.

---

## 🗄️ 4. Detailed Backend Breakdown (`backend/` & PostgreSQL)

EventEase uses a **PostgreSQL Database** (hosted via Supabase / Lovable Cloud) with built-in **Row-Level Security (RLS)** and **Stored SQL Functions**.

### A. Backend Files on Disk:
1. **`backend/schema.sql`**:
   - The master blueprint of the entire backend.
   - Contains table definitions, constraints, triggers, indexes, and custom stored functions.
2. **`backend/demo-data.sql`**:
   - Pre-populated test data including demo events (Tech Summit, Hackathon, Cultural Fest), registered students, halls, and sample tickets.
3. **`drizzle/migrations/`**:
   - Step-by-step database migration files tracking changes to the schema.
4. **`src/integrations/supabase/`**:
   - Server-side and client-side database interaction layer.

---

### B. Key Database Tables:
| Table Name | What it stores |
|---|---|
| **`events`** | Event title, description, venue, start time, capacity limit, owner ID, cover banner image. |
| **`participants`** | Registered attendees, contact info, department, unique ticket code (`EE-XXXX-XXXX`), and `checked_in_at` timestamp. |
| **`event_zones`** | Hall/zone divisions within an event (e.g., "Hall A - Ground Floor", "Hall B - Balcony"). |
| **`zone_staff`** | Mapping of which organizer or volunteer is assigned to check-in which specific hall. |
| **`scan_logs`** | Security audit history recording every scan attempt, gate number, result (success/duplicate/invalid), and timestamp. |
| **`user_roles`** | Assigns user permissions (`admin`, `organizer`, `student`) tied to authentication UUIDs. |
| **`organizer_requests`** | Requests from students wanting to be upgraded to organizers. |
| **`event_edit_requests`** | Safety mechanism: requires Admin approval before an organizer can modify an active event. |
| **`support_tickets`** & **`support_messages`** | Campus inquiry and help desk conversations. |

---

### C. Why Business Logic is Enforced in Backend SQL (Critical Talking Point!)
> 💡 *Explain this in presentations! It shows advanced engineering thinking:*

Instead of validating registrations and check-ins in frontend JavaScript (which can be bypassed or fail during concurrent requests), **EventEase enforces critical rules directly inside PostgreSQL using `SECURITY DEFINER` atomic stored procedures:**

1. **`register_participant()` function**:
   - Uses `SELECT ... FOR UPDATE` row locks.
   - Atomically checks if the event has reached its maximum capacity.
   - Guarantees that two students clicking "Register" at the exact same millisecond cannot exceed the seat capacity.
   - Generates a guaranteed unique ticket code: `EE-XXXX-XXXX`.
2. **`check_in_participant()` function**:
   - Validates organizer role and hall assignment.
   - If a student's code has already been scanned, it immediately rejects the scan and returns the original timestamp: `Already checked in at 10:14 AM`.
   - Prevents pass sharing (e.g., student sending a screenshot of their QR pass to a friend outside).
3. **`validate_event` trigger**:
   - Database trigger that automatically rejects creating events in the past, or lowering event capacity below the number of students already registered.
4. **Row-Level Security (RLS)**:
   - PostgreSQL policies ensure students can only view their own tickets, while organizers only view data for events they own or are assigned to.

---

## 🔄 5. How Frontend and Backend Talk to Each Other

```
┌────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER (React 19)                    │
│                                                                        │
│  [Student UI: Register]              [Organizer UI: QR Scanner]        │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   │ (Supabase RPC API Call)          │ (Supabase RPC API Call)
                   ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL BACKEND ENGINE                       │
│                                                                        │
│  Function: register_participant()     Function: check_in_participant() │
│  - Lock row (FOR UPDATE)              - Verify Hall & Staff            │
│  - Check remaining seats              - Prevent 2nd scan               │
│  - Return unique QR code              - Record in scan_logs            │
│                                                                        │
│                          TABLES WITH RLS                               │
│       events  |  participants  |  scan_logs  |  event_zones            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼ (Websocket Realtime Event)
┌────────────────────────────────────────────────────────────────────────┐
│               LIVE ORGANIZER DASHBOARD (Auto-updates without refresh)  │
│                   Checked In: 142 / 200 (71%)                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 6. Demo Accounts (Ready to Test)

| Role | Email | Password | What to test with this role |
|---|---|---|---|
| 👑 **Admin** | `yuvrajgosai29@gmail.com` | `EventEase@123` | View all events, approve organizer requests, view live online users. |
| 📋 **Organizer** | `yuvrajgosai2918@gmail.com` | `EventEase@123` | Create new events, launch QR gate scanner, view attendance charts, export CSV. |
| 🎓 **Student** | `uvuv2964@gmail.com` | `EventEase@123` | Explore events, register, view digital QR pass, raise support ticket. |

---

## 🎬 7. Best 4-Step Live Demo Walkthrough
When presenting to a panel or professor, follow this exact sequence:

1. **Step 1 (Organizer View):**
   - Log in as Organizer → Click **"New Event"** → Create "Code Carnival Workshop" with capacity 50.
2. **Step 2 (Student View):**
   - Open an incognito window or switch to Student → Go to **Explore** → Click **Register**.
   - Show the generated pass with the unique code (e.g., `EE-A1B2-C3D4`) and QR code.
3. **Step 3 (Gate Check-In View):**
   - In Organizer window → Open **Check-In** screen.
   - Type or scan the student's code → Screen turns **Green (✅ Checked In)**.
   - Show how the live dashboard count increments immediately.
4. **Step 4 (Duplicate Defense Test):**
   - Enter the same code a second time!
   - Screen turns **Amber/Red (⚠️ Duplicate scan blocked)** and displays the exact time it was first checked in.
   - Explain: *"This prevents ticket sharing or reuse."*

---

## 💬 8. Frequently Asked Questions & Quick Answers

### Q1: "Where is the backend server running? Is there an Express or Node server?"
> **Answer:** *"EventEase uses a modern Serverless BaaS architecture powered by Supabase and PostgreSQL. Instead of a traditional Express.js middleware server, all API endpoints and business logic are implemented directly inside PostgreSQL stored procedures (`SECURITY DEFINER` functions) and Row-Level Security (RLS) policies. This gives us atomic transaction safety, millisecond performance, and eliminates middle-tier latency."*

### Q2: "How does the QR scanner work on mobile devices?"
> **Answer:** *"We use the `html5-qrcode` library in `src/components/CheckInPanel.tsx`, which interfaces with the browser's native `navigator.mediaDevices.getUserMedia` camera API. It works directly in mobile browsers without requiring native app store downloads."*

### Q3: "What prevents race conditions when 100 students register for the last seat?"
> **Answer:** *"Inside `backend/schema.sql`, our `register_participant` stored function executes `SELECT * FROM events WHERE id = _event_id FOR UPDATE;`. This locks the specific event row during the transaction, preventing two simultaneous registrations from claiming the same seat."*

### Q4: "Can an organizer scan a student entering the wrong hall?"
> **Answer:** *"No. We have an `event_zones` and `zone_staff` table. The `check_in_participant` function verifies whether the organizer is assigned to that specific hall. If an attendee shows up at Hall B with a Hall A pass, the scan is rejected with a 'Wrong Hall' alert and logged in `scan_logs`."*
