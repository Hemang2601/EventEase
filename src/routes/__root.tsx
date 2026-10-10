import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useLocation,
  HeadContent,
  Scripts,
  isRedirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Compass, Home, Loader2, RefreshCw } from "lucide-react";

import appCss from "../styles.css?url";
import { reportAppError } from "../lib/error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/components/SplashScreen";
import { ThemeProvider, ThemeControl, useTheme } from "@/components/ThemeControl";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { AppLoader, RootPendingScreen, TopNavigationProgress } from "@/components/AppLoader";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(true);
  const [attempts, setAttempts] = useState(0);

  // 1. If this error is a redirect, show a branded loader while router navigates
  if (isRedirect(error)) {
    return <AppLoader fullscreen message="Navigating…" submessage="Preparing your destination" />;
  }

  // 2. Handle dynamic chunk import failures (e.g. stale cache or new deployment)
  useEffect(() => {
    const msg = error instanceof Error ? error.message : String(error ?? "");
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module")
    ) {
      const key = "ee_chunk_reload";
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || now - Number(last) > 15000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
        return;
      }
    }
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  // 3. Auto-retry with loader: smoothly hides transient network hiccups
  useEffect(() => {
    if (attempts < 2) {
      const timer = setTimeout(() => {
        setAttempts((prev) => prev + 1);
        try {
          router.invalidate();
          reset();
        } catch {
          // Continue
        }
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setRetrying(false);
    }
  }, [attempts, router, reset]);

  // While retrying, show a sleek branded EventEase loader
  if (retrying) {
    return (
      <AppLoader
        fullscreen
        message="Connecting to EventEase…"
        submessage="Restoring workspace and verifying session"
      />
    );
  }

  // Fallback after retries: Sleek themed card (not the stark white screen)
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8 text-center shadow-card animate-rise">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <RefreshCw className="size-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Connection paused
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          The page took longer than expected to respond. You can try refreshing or browse other events.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          <Button
            onClick={() => {
              setRetrying(true);
              setAttempts(0);
              router.invalidate();
              reset();
            }}
            variant="hero"
            className="h-10 text-sm"
          >
            <RefreshCw className="size-4" /> Try again
          </Button>
          <Button asChild variant="outline" className="h-10 text-sm">
            <Link to="/explore">
              <Compass className="size-4" /> Explore events
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-10 text-sm">
            <Link to="/">
              <Home className="size-4" /> Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1d4ed8" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "EventEase" },
      { title: "EventEase — College Event Registration & Check-In" },
      { name: "description", content: "Create events, issue QR entry codes and check participants in with zero duplicates." },
      { name: "author", content: "EventEase" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  pendingComponent: RootPendingScreen,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen w-full max-w-full overflow-x-hidden">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <ThemeProvider><ThemedRoot /></ThemeProvider>;
}

function ThemedRoot() {
  const { queryClient } = Route.useRouteContext();
  const { pathname } = useLocation();
  const inner = pathname !== "/";
  const { resolved } = useTheme();
  const standalone = pathname === "/auth" || pathname.startsWith("/register/") || pathname.startsWith("/ticket/");
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <TopNavigationProgress />
      <SplashScreen />
      <div className={inner ? "inner-theme relative min-h-screen w-full max-w-full overflow-x-hidden" : "relative min-h-screen w-full max-w-full overflow-x-hidden"} data-theme={resolved}><Outlet />{(!inner || standalone) && <div className={inner ? "theme-floating" : "theme-floating theme-floating--landing"}><ThemeControl /></div>}</div>
      <Toaster theme={inner ? resolved : "light"} position="top-center" richColors />
    </QueryClientProvider>
  );
}
