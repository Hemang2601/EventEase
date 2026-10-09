
## Project rules
- Inner-page theming uses a shared persisted preference with reactive system appearance and route-scoped tokens; the landing hero keeps its original look, and landing sections below it use a locally scoped dark-glass token wrapper so theme changes never restyle the landing page.
- Landing workflow icons use lazy, browser-only React Three Fiber scenes that pause outside view and respect reduced motion, keeping navigation lightweight.
- All data access goes through the browser Supabase client with RLS; check-in, registration and ticket lookup run as SECURITY DEFINER SQL functions so capacity/duplicate rules are enforced atomically in the database.
- Organizer pages live under `src/routes/_authenticated/` and render inside `AppShell`; the working event is shared across pages via `usePickedEvent` (localStorage) so every page shows the same event.
- Colors/fonts come only from tokens in `src/styles.css`; QR codes always render dark-on-white so they stay scannable.
- Roles (student/organizer/admin) live in `user_roles`, checked via `has_role()` in RLS and SQL functions; pages declare required roles with `AppShell allow`, so access rules stay in the database, not the UI.
- Events can be split into halls (`event_zones`) with organizers assigned via `zone_staff`; hall staff may only check in passes of their own hall (enforced in `check_in_participant`), so per-hall attendance stays accurate.
- Event scheduling rules (one event per calendar day in India time, no past start, capacity >= registrations) and the one-event-per-day rule for students live in the `validate_event` trigger and registration SQL functions, so they hold no matter which screen makes the change.
