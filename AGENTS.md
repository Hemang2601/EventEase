
## Project rules
- Inner-page theming uses a shared persisted preference with reactive system appearance and route-scoped tokens; the landing hero keeps its original look, and landing sections below it use a locally scoped dark-glass token wrapper so theme changes never restyle the landing page.
- Landing workflow icons use lazy, browser-only React Three Fiber scenes that pause outside view and respect reduced motion, keeping navigation lightweight.
- All data access routes through the local MongoDB database (`mongodb://127.0.0.1:27017/eventease`) via the local client adapter and backend services; check-in, registration and ticket lookup run as atomic backend services so capacity/duplicate rules are enforced atomically.
- Organizer pages live under `src/routes/_authenticated/` and render inside `AppShell`; the working event is shared across pages via `usePickedEvent` (localStorage) so every page shows the same event.
- Colors/fonts come only from tokens in `src/styles.css`; QR codes always render dark-on-white so they stay scannable.
- Roles (student/organizer/admin) live in `user_roles`, checked via `hasRole()` in backend services and local client; pages declare required roles with `AppShell allow`, so access rules stay in the database layer, not the UI.
- Events can be split into halls (`event_zones`) with organizers assigned via `zone_staff`; hall staff may only check in passes of their own hall (enforced in `check_in_participant`), so per-hall attendance stays accurate.
- Event scheduling rules (one event per calendar day in India time, no past start, capacity >= registrations) and the one-event-per-day rule for students live in `backend/services.ts` (`validateEvent` and registration services), so they hold no matter which screen makes the change.

