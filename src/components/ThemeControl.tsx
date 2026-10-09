import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ThemeChoice = "dark" | "light" | "system";
const ThemeContext = createContext<{ choice: ThemeChoice; resolved: "dark" | "light"; setChoice: (value: ThemeChoice) => void }>({ choice: "dark", resolved: "dark", setChoice: () => {} });
export function readTheme(value: string | null): ThemeChoice {
  return value === "light" || value === "system" ? value : "dark";
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>("dark");
  const [systemDark, setSystemDark] = useState(true);
  useEffect(() => {
    try { setChoice(readTheme(localStorage.getItem("eventease-theme"))); } catch { /* Storage can be unavailable. */ }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update(); media.addEventListener("change", update);
    const sync = (event: StorageEvent) => { if (event.key === "eventease-theme") setChoice(readTheme(event.newValue)); };
    window.addEventListener("storage", sync);
    return () => { media.removeEventListener("change", update); window.removeEventListener("storage", sync); };
  }, []);
  const change = (value: ThemeChoice) => {
    setChoice(value);
    try { localStorage.setItem("eventease-theme", value); } catch { /* Theme still works without persistence. */ }
  };
  const resolved = choice === "system" ? (systemDark ? "dark" : "light") : choice;
  return <ThemeContext.Provider value={{ choice, resolved, setChoice: change }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export function ThemeControl() {
  const { choice, setChoice } = useTheme();
  return (
    <div className="theme-control" role="group" aria-label="Appearance">
      {([{ value: "dark", label: "Dark theme", icon: Moon }, { value: "light", label: "Light theme", icon: Sun }, { value: "system", label: "System theme", icon: Monitor }] as const).map(({ value, label, icon: Icon }) => (
        <Button key={value} variant={choice === value ? "default" : "ghost"} size="icon" aria-label={label} aria-pressed={choice === value} title={label} onClick={() => setChoice(value)} className="theme-choice"><Icon className="size-4" /></Button>
      ))}
    </div>
  );
}