import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Compresses and scales an image using HTML5 canvas.
 * Produces a lightweight, web-optimized JPEG blob + base64 data URL.
 */
function compressImage(
  file: File,
  round: boolean
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Unable to decode image"));
      img.onload = () => {
        let sw = img.width;
        let sh = img.height;
        let sx = 0;
        let sy = 0;

        let tw = sw;
        let th = sh;

        if (round) {
          // Center-crop to 1:1 square for profile/organizer portraits (max 400x400)
          const size = Math.min(sw, sh);
          sx = Math.round((sw - size) / 2);
          sy = Math.round((sh - size) / 2);
          sw = size;
          sh = size;
          tw = Math.min(400, size);
          th = tw;
        } else {
          // Fit within 1280x720 max for event banners
          const maxW = 1280;
          const maxH = 720;
          if (tw > maxW || th > maxH) {
            const ratio = Math.min(maxW / tw, maxH / th);
            tw = Math.round(tw * ratio);
            th = Math.round(th * ratio);
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context is unavailable"));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);

        const quality = round ? 0.85 : 0.82;
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to generate image blob"));
              return;
            }
            resolve({ blob, dataUrl });
          },
          "image/jpeg",
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Robust photo uploader for events and organizers.
 * Automatically resizes & compresses images, uploads to Supabase storage,
 * and seamlessly falls back to inline base64 if storage is unconfigured.
 */
export function ImageUpload({
  userId,
  value,
  onChange,
  label,
  round,
}: {
  userId: string;
  value: string;
  onChange: (url: string) => void;
  label: string;
  round?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file (PNG, JPG, WEBP)");
      return;
    }

    setBusy(true);

    try {
      // 1. Process and compress image in the browser (handles large phone camera files)
      const { blob, dataUrl } = await compressImage(file, !!round);

      let savedUrl = dataUrl;

      // 2. Attempt uploading to local storage
      try {
        const path = `${userId || "organizer"}/${crypto.randomUUID()}.jpg`;
        const { data: upData, error: upError } = await supabase.storage
          .from("event-images")
          .upload(path, blob, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!upError && upData?.path) {
          const { data: pubData } = supabase.storage
            .from("event-images")
            .getPublicUrl(upData.path);

          if (pubData?.publicUrl) {
            savedUrl = pubData.publicUrl;
          }
        } else if (upError) {
          console.warn(
            "Storage upload notice (using optimized fallback):",
            upError.message
          );
        }
      } catch (storageErr) {
        console.warn("Storage exception (using optimized fallback):", storageErr);
      }

      // 3. Set the image URL (local /uploads link or compressed base64 fallback)
      onChange(savedUrl);
      toast.success(`${label} attached successfully`);
    } catch (err) {
      console.error("Image processing error:", err);
      toast.error("Could not process this image. Please choose another one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {value && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
            <Check className="size-3" /> Photo added
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          title={value ? "Click to replace photo" : "Click to choose photo"}
          className={cn(
            "group relative grid shrink-0 place-items-center overflow-hidden border-2 border-dashed bg-muted text-muted-foreground transition-all hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40",
            round ? "size-20 rounded-full" : "h-20 w-32 rounded-xl",
            value && "border-solid border-primary/40 bg-card"
          )}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-1 text-primary">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-[9px] font-medium">Processing…</span>
            </div>
          ) : value ? (
            <>
              <img
                src={value}
                alt={label}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 text-white">
                <RefreshCw className="size-4" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <ImagePlus className="size-5" />
              <span className="text-[10px] font-medium">Upload</span>
            </div>
          )}
        </button>

        <div className="flex-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            {value ? "Photo ready" : "Choose from device"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {round ? "Portrait or avatar" : "Banner landscape (16:9)"} · Auto-optimized
          </p>

          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => ref.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Upload className="size-3" /> {value ? "Change photo" : "Browse files"}
            </button>

            {value && (
              <>
                <span className="text-border">·</span>
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="inline-flex items-center gap-0.5 text-xs text-destructive hover:underline"
                >
                  <X className="size-3" /> Remove
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/*"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
