import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** Uploads an image to event storage and returns a long-lived viewable link. */
export function ImageUpload({ userId, value, onChange, label, round }: {
  userId: string; value: string; onChange: (url: string) => void; label: string; round?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("event-images").upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); toast.error("Upload failed"); return; }
    const { data, error } = await supabase.storage.from("event-images").createSignedUrl(path, TEN_YEARS);
    setBusy(false);
    if (error || !data) { toast.error("Upload failed"); return; }
    onChange(data.signedUrl);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => ref.current?.click()}
          className={cn("relative grid shrink-0 place-items-center overflow-hidden border-2 border-dashed bg-muted text-muted-foreground transition-colors hover:border-primary hover:text-primary",
            round ? "size-20 rounded-full" : "h-20 w-32 rounded-xl")}>
          {busy ? <Loader2 className="animate-spin" /> : value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus />}
        </button>
        <div className="text-xs text-muted-foreground">
          <p>{value ? "Click to replace" : "Click to upload"} · max 5 MB</p>
          {value && <button type="button" onClick={() => onChange("")} className="mt-1 flex items-center gap-1 text-destructive"><X size={12} /> Remove</button>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
