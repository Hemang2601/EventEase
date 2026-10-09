import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Copy, ExternalLink, ShieldCheck, CalendarDays, MapPin, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { BrandMark } from "./Brand";

type Props = {
  code: string;
  name: string;
  email?: string | undefined;
  eventTitle: string;
  meta?: string | undefined;
  date?: string | undefined;
  checkedInAt?: string | null | undefined;
  actions?: boolean;
};

/** Premium digital event pass — boarding-pass style with a tear-off QR stub. */
export function Ticket({ code, name, email, eventTitle, meta, date, checkedInAt, actions = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const used = !!checkedInAt;

  /** Renders the full premium pass to a PNG (not just the QR). */
  function download() {
    const qr = ref.current?.querySelector("canvas");
    if (!qr) return;

    const W = 760, H = 1180, S = 2;
    const c = document.createElement("canvas");
    c.width = W * S; c.height = H * S;
    const x = c.getContext("2d");
    if (!x) return;
    x.scale(S, S);

    const rr = (px: number, py: number, pw: number, ph: number, r: number) => {
      x.beginPath();
      x.roundRect(px, py, pw, ph, r);
    };
    rr(0, 0, W, H, 36); x.fillStyle = "#0B1728"; x.fill();

    // Header band
    x.save();
    rr(0, 0, W, 330, 36); x.clip();
    const g = x.createLinearGradient(0, 0, W, 330);
    g.addColorStop(0, "#07111F"); g.addColorStop(1, "#102542");
    x.fillStyle = g; x.fillRect(0, 0, W, 330);
    const blob = (bx: number, by: number, br: number, a: number) => {
      const rg = x.createRadialGradient(bx, by, 0, bx, by, br);
      rg.addColorStop(0, `rgba(79,140,255,${a})`); rg.addColorStop(1, "rgba(79,140,255,0)");
      x.fillStyle = rg; x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fill();
    };
    blob(W - 60, -40, 260, 0.5); blob(80, 330, 200, 0.22);

    // Brand + verified chip
    x.fillStyle = "#4F8CFF"; rr(48, 48, 44, 44, 12); x.fill();
    x.strokeStyle = "#07111F"; x.lineWidth = 4;
    x.strokeRect(60, 60, 9, 9); x.strokeRect(73, 60, 7, 7); x.strokeRect(60, 73, 7, 7);
    x.fillStyle = "#F7FAFF"; x.font = "700 26px Inter, sans-serif"; x.textBaseline = "middle";
    x.fillText("EventEase", 108, 71);
    x.font = "700 13px Inter, sans-serif";
    const chip = "✓ VERIFIED PASS";
    const cw = x.measureText(chip).width + 36;
    x.fillStyle = "rgba(25,195,125,0.16)"; rr(W - 48 - cw, 52, cw, 36, 18); x.fill();
    x.strokeStyle = "rgba(25,195,125,0.5)"; x.lineWidth = 1.5; rr(W - 48 - cw, 52, cw, 36, 18); x.stroke();
    x.fillStyle = "#19C37D"; x.fillText(chip, W - 48 - cw + 18, 71);

    // Title block
    x.fillStyle = "#94A3B8"; x.font = "600 14px Inter, sans-serif";
    x.fillText("D I G I T A L   E V E N T   P A S S", 48, 150);
    x.fillStyle = "#F7FAFF"; x.font = "700 40px Inter, sans-serif";
    const title = eventTitle.length > 26 ? eventTitle.slice(0, 26) + "…" : eventTitle;
    x.fillText(title, 48, 200);

    // Participant / status
    x.font = "600 12px Inter, sans-serif"; x.fillStyle = "#94A3B8";
    x.fillText("PARTICIPANT", 48, 258);
    x.fillText("STATUS", W - 160, 258);
    x.font = "700 22px Inter, sans-serif"; x.fillStyle = "#F7FAFF";
    const nm = name.length > 24 ? name.slice(0, 24) + "…" : name;
    x.fillText(nm, 48, 290);
    x.fillStyle = used ? "#94A3B8" : "#19C37D";
    x.fillText(used ? "USED" : "REGISTERED", W - 160, 290);
    x.restore();

    // Date / venue rows
    x.textBaseline = "middle";
    x.font = "500 18px Inter, sans-serif"; x.fillStyle = "#CBD5E1";
    let yy = 385;
    if (date) { x.fillText("📅  " + date, 48, yy); yy += 34; }
    if (meta) { x.fillText("📍  " + (meta.length > 44 ? meta.slice(0, 44) + "…" : meta), 48, yy); yy += 34; }

    // Perforation with side notches
    const py = yy + 26;
    x.fillStyle = "#07111F";
    x.beginPath(); x.arc(0, py, 22, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(W, py, 22, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "rgba(255,255,255,0.2)"; x.lineWidth = 3; x.setLineDash([12, 10]);
    x.beginPath(); x.moveTo(34, py); x.lineTo(W - 34, py); x.stroke();
    x.setLineDash([]);

    // QR card
    const qs = 300, qx = (W - qs) / 2, qy = py + 50;
    x.save();
    x.shadowColor = "rgba(0,0,0,0.45)"; x.shadowBlur = 30; x.shadowOffsetY = 10;
    rr(qx, qy, qs, qs, 24); x.fillStyle = "#ffffff"; x.fill();
    x.restore();
    x.strokeStyle = "rgba(255,255,255,0.12)"; x.lineWidth = 2; rr(qx, qy, qs, qs, 24); x.stroke();
    x.drawImage(qr, qx + 22, qy + 22, qs - 44, qs - 44);

    // Code + hint
    x.textAlign = "center";
    x.fillStyle = "#F7FAFF"; x.font = "700 34px 'JetBrains Mono', monospace";
    x.fillText(code, W / 2, qy + qs + 62);
    x.fillStyle = "#94A3B8"; x.font = "500 16px Inter, sans-serif";
    x.fillText(used ? "This pass has been checked in" : "Show this QR at the gate · valid for one entry", W / 2, qy + qs + 100);
    x.fillStyle = "#6B7E99"; x.font = "600 13px Inter, sans-serif";
    x.fillText("Powered by EventEase", W / 2, H - 34);
    x.textAlign = "left";

    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `EventEase-Pass-${code}.png`;
    a.click();
    toast.success("Premium pass downloaded");
  }

  return (
    <div className="animate-pop group mx-auto w-full max-w-[380px] overflow-hidden transition-transform duration-300 hover:-translate-y-1">
      <div className="ticket-notch overflow-hidden rounded-[22px] bg-elevated shadow-float ring-1 ring-border">
        {/* Header */}
        <div className="relative overflow-hidden bg-navy px-5 sm:px-6 pb-5 sm:pb-6 pt-4 sm:pt-5 text-navy-foreground">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <BrandMark light />
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success ring-1 ring-success/40">
              <ShieldCheck className="size-3" /> Verified pass
            </span>
          </div>
          <p className="relative mt-5 sm:mt-6 label-mono !text-navy-muted">Digital event pass</p>
          <h3 className="relative mt-1 font-display text-xl sm:text-2xl font-bold leading-tight line-clamp-2">{eventTitle}</h3>
          <div className="relative mt-4 sm:mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-muted">Participant</p>
              <p className="mt-0.5 truncate text-sm sm:text-base font-semibold tracking-tight">{name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-muted">Status</p>
              <p className={`mt-0.5 text-xs sm:text-sm font-semibold ${used ? "text-navy-muted" : "text-success"}`}>{used ? "Used" : "Registered"}</p>
            </div>
          </div>
        </div>

        {/* Details */}
        {(date || meta || email) && (
          <div className="space-y-1.5 sm:space-y-2 px-5 sm:px-6 py-3.5 sm:py-4 font-mono text-xs text-muted-foreground">
            {date && <p className="flex items-center gap-2"><CalendarDays className="size-3.5 text-primary shrink-0" /><span className="truncate">{date}</span></p>}
            {meta && <p className="flex items-center gap-2"><MapPin className="size-3.5 text-primary shrink-0" /><span className="truncate">{meta}</span></p>}
            {email && <p className="truncate text-muted-foreground/80">{email}</p>}
          </div>
        )}

        {/* Perforation / tear line */}
        <div className="relative mx-5 sm:mx-6 border-t-2 border-dashed border-border">
          <span aria-hidden className="absolute -left-9 -top-3 size-6 rounded-full bg-background" />
          <span aria-hidden className="absolute -right-9 -top-3 size-6 rounded-full bg-background" />
        </div>

        {/* QR stub */}
        <div className="flex flex-col items-center px-5 sm:px-6 py-5 sm:py-6 text-center">
          <div ref={ref} className={`rounded-2xl qr-paper p-3 shadow-card ring-1 ring-border transition-transform duration-300 group-hover:scale-[1.03] ${used ? "opacity-40" : ""}`}>
            <QRCodeCanvas value={code} size={168} level="H" bgColor="#ffffff" fgColor="#07111F" marginSize={1} />
          </div>
          <p className="mt-3.5 sm:mt-4 font-mono text-lg sm:text-xl font-bold tabular-nums tracking-[0.2em] text-foreground">{code}</p>
          {used ? (
            <p className="mt-2.5 sm:mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
              <CheckCircle2 className="size-4 shrink-0" /> Checked in at {new Date(checkedInAt ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : (
            <p className="mt-1.5 sm:mt-2 text-xs text-muted-foreground">Show this QR at the gate · valid for one entry</p>
          )}
          {actions && (
            <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-1.5 sm:gap-2 w-full">
              <Button variant="outline" size="sm" onClick={download} className="h-9 px-1 sm:px-2.5 text-[11px] sm:text-xs">
                <Download className="size-3.5 shrink-0" /> <span className="truncate">Download</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(code); toast.success("Code copied"); }} className="h-9 px-1 sm:px-2.5 text-[11px] sm:text-xs">
                <Copy className="size-3.5 shrink-0" /> <span className="truncate">Copy</span>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 px-1 sm:px-2.5 text-[11px] sm:text-xs">
                <Link to="/ticket/$code" params={{ code }}>
                  <ExternalLink className="size-3.5 shrink-0" /> <span className="truncate">Open</span>
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
