import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarPlus, ScanLine, Ticket, UserPlus } from "lucide-react";

const Scene = lazy(() => import("./StepScene"));
const icons = [CalendarPlus, UserPlus, Ticket, ScanLine];

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function StepAnimation({ index }: { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => {
      setActive(entry?.isIntersecting ?? false);
      if (entry?.isIntersecting) setReady(true);
    }, { rootMargin: "100px" });
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); media.removeEventListener("change", update); };
  }, []);
  const Icon = icons[index] ?? CalendarPlus;
  const fallback = <span className="grid size-20 place-items-center rounded-lg border border-border bg-accent text-primary"><Icon size={32} /></span>;
  return (
    <div ref={ref} aria-hidden="true" className="step-animation relative flex h-40 w-full items-center justify-center">
      {ready ? <SceneBoundary fallback={fallback}><Suspense fallback={fallback}><Scene index={index} active={active} reduced={reduced} /></Suspense></SceneBoundary> : fallback}
    </div>
  );
}