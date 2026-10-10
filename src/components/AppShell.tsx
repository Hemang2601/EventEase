import { useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, ChartNoAxesCombined, ChevronDown, Compass, Crown, Inbox, LayoutDashboard, LifeBuoy,
  Loader2, Lock, LogOut, Menu, Search, Settings, ScanLine, ScrollText, ShieldCheck, Ticket, UserRound, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePresence } from "@/lib/presence";
import { useRoles, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Brand, BrandMark } from "./Brand";
import { Button } from "./ui/button";
import { ThemeControl } from "./ThemeControl";
import { AppLoader } from "@/components/AppLoader";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type NavEntry = { label: string; to: string; icon: typeof Ticket };

const workspaceNav: NavEntry[] = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Events", to: "/events", icon: CalendarDays },
  { label: "Check-in", to: "/check-in", icon: ScanLine },
  { label: "Participants", to: "/participants", icon: Users },
  { label: "Analytics", to: "/analytics", icon: ChartNoAxesCombined },
  { label: "Security", to: "/security", icon: ShieldCheck },
];
const managementNav: NavEntry[] = [
  { label: "Support inbox", to: "/support", icon: Inbox },
];
const systemNav: NavEntry[] = [
  { label: "Settings", to: "/profile", icon: Settings },
  { label: "Help", to: "/help", icon: LifeBuoy },
];
const adminNav: NavEntry[] = [{ label: "Admin console", to: "/admin", icon: Crown }];

const participantNav = [
  { label: "Explore events", to: "/explore", icon: Compass },
  { label: "My passes", to: "/my-passes", icon: Ticket },
  { label: "Rules & regulations", to: "/rules", icon: ScrollText },
  { label: "Help & support", to: "/help", icon: LifeBuoy },
] as const;

function isActive(pathname: string, to: string) {
  if (pathname === to) return true;
  if (to === "/events" && pathname.startsWith("/events/")) return true;
  return false;
}

function NavItem({ to, label, icon: Icon, onNavigate }: NavEntry & { onNavigate?: (() => void) | undefined }) {
  const { pathname } = useLocation();
  const active = isActive(pathname, to);
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
        active ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      {active && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
      <Icon size={17} strokeWidth={active ? 2.3 : 1.8} className={active ? "text-primary" : undefined} />
      <span className={active ? "font-semibold" : undefined}>{label}</span>
    </Link>
  );
}

function NavGroup({ label, items, onNavigate }: { label: string; items: NavEntry[]; onNavigate?: (() => void) | undefined }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-muted/80">{label}</p>
      <nav className="space-y-0.5">{items.map((n) => <NavItem key={n.to} {...n} onNavigate={onNavigate} />)}</nav>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isOrganizer, primary } = useRoles();
  const display = (user?.user_metadata?.["full_name"] as string | undefined) || user?.email?.split("@")[0] || "Organizer";
  const initials = display.split(/[\s.]+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-full w-[240px] flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-[64px] items-center border-b border-sidebar-border px-5"><Link to="/"><BrandMark light /></Link></div>
      <div className="flex-1 overflow-y-auto px-3 pt-5 scrollbar-slim">
        {isAdmin && <NavGroup label="Administration" items={adminNav} onNavigate={onNavigate} />}
        {isOrganizer && (<>
          <NavGroup label="Workspace" items={workspaceNav} onNavigate={onNavigate} />
          <NavGroup label="Management" items={managementNav} onNavigate={onNavigate} />
          <NavGroup label="System" items={systemNav} onNavigate={onNavigate} />
        </>)}
      </div>
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-sidebar-foreground">{display}</span>
                <span className="block truncate text-[11px] capitalize text-sidebar-muted">{primary} account</span>
              </span>
              <ChevronDown size={14} className="shrink-0 text-sidebar-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}><UserRound size={15} /> My profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/help" })}><LifeBuoy size={15} /> Help & support</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}><LogOut size={15} /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function Guard({ allow, children }: { allow?: Role[] | undefined; children: ReactNode }) {
  const { roles, loading } = useRoles();
  const { pathname } = useLocation();
  if (!allow) return <>{children}</>;
  if (loading) return <AppLoader compact message="Verifying workspace permissions…" submessage="Checking your assigned roles" />;
  const ok = allow.some((r) => roles.includes(r)) || roles.includes("admin");
  if (ok) return <>{children}</>;
  if (pathname === "/dashboard") return <Navigate to="/my-passes" replace />;
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-14 text-center">
      <Lock className="size-10 text-primary" />
      <p className="mt-4 text-lg font-semibold">Access restricted</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">This area is for {allow.join(" / ")} accounts. Ask the admin for access from the Help page.</p>
      <Button asChild className="mt-5"><Link to="/my-passes">Go to my passes</Link></Button>
    </div>
  );
}

function StudentTopNav({ onNavigate, vertical = false }: { onNavigate?: () => void; vertical?: boolean }) {
  const { pathname } = useLocation();
  return (
    <nav className={cn(
      vertical ? "flex flex-col gap-1 w-full" : "flex items-center gap-1 overflow-x-auto"
    )}>
      {participantNav.map((n) => {
        const active = pathname === n.to;
        return (
          <Link key={n.to} to={n.to} onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3.5 text-[13px] font-medium transition-all",
              vertical ? "h-11 w-full" : "h-9 shrink-0",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}>
            <n.icon size={vertical ? 18 : 15} strokeWidth={active ? 2.3 : 1.8} />
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function StudentMobileBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 flex h-16 w-full max-w-full items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur-xl md:hidden shadow-float overflow-x-hidden"
    >
      {participantNav.map((n) => {
        const active = pathname === n.to;
        const shortName = n.label.split(" ")[0];
        return (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors text-center",
              active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <n.icon size={20} strokeWidth={active ? 2.3 : 1.8} className={active ? "scale-105 transition-transform" : undefined} />
            <span className="text-[11px] leading-tight tracking-tight">
              {shortName}
            </span>
            {active && (
              <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Quick jump: filters the organizer workspace nav so it doubles as a real search. */
function WorkspaceSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const all = useMemo(() => [...workspaceNav, ...managementNav, ...systemNav], []);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return all.filter((n) => n.label.toLowerCase().includes(s));
  }, [q, all]);
  return (
    <div className="relative hidden min-w-0 flex-1 max-w-sm md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Search workspace…"
        aria-label="Search workspace"
        className="h-9 w-full rounded-lg border bg-muted/50 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border bg-popover p-1 shadow-float">
          {matches.map((m) => (
            <Link key={m.to} to={m.to} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] hover:bg-muted">
              <m.icon size={14} className="text-muted-foreground" /> {m.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ title, children, actions, allow }: { title: string; children: ReactNode; actions?: ReactNode; allow?: Role[] }) {
  const { user } = useAuth();
  usePresence();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { isAdmin, isOrganizer, loading: rolesLoading } = useRoles();
  const display = (user?.user_metadata?.["full_name"] as string | undefined) || user?.email?.split("@")[0] || "Organizer";
  const initials = display.split(/[\s.]+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl border px-2 py-1.5 hover:bg-muted">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
          <span className="hidden max-w-[140px] truncate text-sm font-medium sm:block">{display}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}><UserRound size={15} /> My profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/my-passes" })}><Ticket size={15} /> My passes</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/help" })}><LifeBuoy size={15} /> Help & support</DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}><LogOut size={15} /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // While roles are resolving, if there's no strict allow restriction (like /explore),
  // render the student shell immediately to avoid flashing the organizer sidebar or getting stuck.
  if (rolesLoading) {
    if (!allow) {
      return (
        <div className="glass-ambient min-h-screen w-full max-w-full overflow-x-hidden bg-background">
          <header className="workspace-header sticky top-0 z-20 border-b bg-card/85 backdrop-blur-md">
            <div className="mx-auto flex h-[60px] sm:h-[68px] max-w-[1400px] items-center justify-between gap-2.5 px-4 sm:px-8">
              <Link to="/explore" aria-label="EventEase home" className="shrink-0"><BrandMark /></Link>
              <div className="hidden md:block"><StudentTopNav /></div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <ThemeControl />
                {userMenu}
              </div>
            </div>
          </header>
          <main className="workspace-main mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden">
            {children}
          </main>
          <StudentMobileBottomNav />
        </div>
      );
    }
    return <AppLoader fullscreen message="Verifying permissions…" submessage="Preparing your workspace" />;
  }

  // Students get a clean top-nav layout — no organizer sidebar.
  if (!isAdmin && !isOrganizer) {
    return (
      <div className="glass-ambient min-h-screen w-full max-w-full overflow-x-hidden bg-background">
        <header className="workspace-header sticky top-0 z-20 border-b bg-card/85 backdrop-blur-md">
          <div className="mx-auto flex h-[60px] sm:h-[68px] max-w-[1400px] items-center justify-between gap-2.5 px-4 sm:px-8">
            <Link to="/explore" aria-label="EventEase home" className="shrink-0"><BrandMark /></Link>
            <div className="hidden md:block"><StudentTopNav /></div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeControl />
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden size-9" aria-label="Open menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-5">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="mb-6"><Brand /></div>
                  <div className="flex flex-col gap-2">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Student Portal</p>
                    <StudentTopNav vertical onNavigate={() => setOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
              {userMenu}
            </div>
          </div>
        </header>
        <main className="workspace-main mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden">
          <Guard allow={allow}>{children}</Guard>
        </main>
        <StudentMobileBottomNav />
      </div>
    );
  }

  return (
    <div className="glass-ambient min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block"><SidebarContent /></aside>
      <div className="lg:pl-[240px] w-full max-w-full overflow-x-hidden">
        <header className="workspace-header sticky top-0 z-20 flex h-[64px] items-center justify-between gap-3 border-b bg-card/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu /></Button></SheetTrigger>
              <SheetContent side="left" className="w-[240px] border-0 p-0"><SheetTitle className="sr-only">Navigation</SheetTitle><SidebarContent onNavigate={() => setOpen(false)} /></SheetContent>
            </Sheet>
            <div className="min-w-0 truncate text-[13px] text-muted-foreground">
              <span>Workspace</span><span className="mx-1.5 text-border">/</span><span className="font-semibold text-foreground">{title}</span>
            </div>
          </div>
          <WorkspaceSearch />
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <ThemeControl />
            <Button asChild variant="ghost" size="icon" aria-label="Support inbox" className="hidden sm:inline-flex">
              <Link to="/support"><Inbox /></Link>
            </Button>
            {userMenu}
          </div>
        </header>
        <main className="workspace-main mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8 w-full max-w-full overflow-x-hidden"><Guard allow={allow}>{children}</Guard></main>
      </div>
    </div>
  );
}

/** Dropdown to pick which event the page works on. */
export function EventPicker({ events, value, onChange }: {
  events: { id: string; title: string }[]; value: string | undefined; onChange: (id: string) => void;
}) {
  const cur = events.find((e) => e.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex max-w-[260px] items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-card hover:bg-muted">
          <span className="size-2 shrink-0 rounded-full bg-primary" />
          <span className="truncate">{cur?.title ?? "Select event"}</span>
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch event</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {events.map((e) => <DropdownMenuItem key={e.id} onClick={() => onChange(e.id)}><span className="truncate">{e.title}</span></DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
