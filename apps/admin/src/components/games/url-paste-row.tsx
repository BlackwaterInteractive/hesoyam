"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Issue #179: paste any image URL as an alternative to SGDB picks / manual
// uploads. Used by both the bulk curation dialog and the per-slot edit dialog.
//
// SSRF: the server hands the pasted URL to ImageKit's URL-import. Mitigations:
// admin-only auth, https-only, ImageKit fetches from its infra (not our VPC).
// Server runs the parse + https check defensively too.

type AssetSlot = "grid" | "icon" | "hero" | "logo";

const SLOT_LABELS: Record<AssetSlot, string> = {
  grid: "Grid",
  icon: "Icon",
  hero: "Hero",
  logo: "Logo",
};
const SLOT_ASPECT: Record<AssetSlot, string> = {
  grid: "aspect-[3/4]",
  icon: "aspect-square",
  hero: "aspect-[3/1]",
  logo: "aspect-[2/1]",
};
const SLOT_OBJECT_FIT: Record<AssetSlot, string> = {
  grid: "object-cover",
  icon: "object-cover",
  hero: "object-cover",
  logo: "object-contain",
};

// Sync validation: parses + https. Returns the normalized URL on success.
function validatePasteUrlClient(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

type ProbeState = "idle" | "syntax-invalid" | "probing" | "image" | "not-image";

// Image probe: create an offscreen <img>, set src, listen for load/error.
// Browser image loads bypass CORS for non-canvas use, so this works across
// origins. A successful decode is the strongest signal we can get from the
// client that the URL points to an image — covers extensionless CDN URLs and
// signed URLs, rejects HTML pages / 404s. The probe downloads the full image
// (browser caches it, so the eventual ImageKit re-fetch is a separate request
// from its own infra). 8s safety timeout: a slow URL shouldn't trap the user
// in "Checking…" indefinitely if the browser default is much longer.
//
// Implementation: only the probe verdict (URL + image|not-image) lives in
// state. "probing" is derived during render from "result hasn't caught up
// with the current URL yet". Avoids setState-in-effect cascading-render.
function useImageProbe(raw: string): ProbeState {
  const trimmed = raw.trim();
  const validated = trimmed ? validatePasteUrlClient(trimmed) : null;

  const [result, setResult] = useState<{ url: string; verdict: "image" | "not-image" } | null>(null);

  useEffect(() => {
    if (!validated) return;
    let cancelled = false;
    // Debounce so rapid typing doesn't fan out a probe per keystroke.
    const debounce = setTimeout(() => {
      const img = new Image();
      // Safety net for URLs that hang. Mark not-image after 8s.
      const safetyTimeout = setTimeout(() => {
        if (cancelled) return;
        img.src = "";
        setResult({ url: validated, verdict: "not-image" });
      }, 8000);
      img.onload = () => {
        if (cancelled) return;
        clearTimeout(safetyTimeout);
        setResult({ url: validated, verdict: "image" });
      };
      img.onerror = () => {
        if (cancelled) return;
        clearTimeout(safetyTimeout);
        setResult({ url: validated, verdict: "not-image" });
      };
      img.src = validated;
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [validated]);

  if (!trimmed) return "idle";
  if (!validated) return "syntax-invalid";
  if (result?.url === validated) return result.verdict;
  return "probing";
}

interface UrlPasteRowProps {
  slot: AssetSlot;
  // The currently-committed pasted URL for this slot, or null. Used to
  // pre-fill the input on mount and show the "Used" state when the input
  // matches what's already been committed.
  committedUrl: string | null;
  // Called with the validated, normalized URL when the user clicks Use or
  // hits Enter. Parent can trust the URL — it's already passed parse + https
  // + image-probe checks.
  onCommit: (validatedUrl: string) => void;
}

export function UrlPasteRow({ slot, committedUrl, onCommit }: UrlPasteRowProps) {
  const [raw, setRaw] = useState<string>(committedUrl ?? "");
  const probeState = useImageProbe(raw);
  const validated = validatePasteUrlClient(raw);
  const canUse = probeState === "image" && validated !== null;
  const isCommitted = canUse && committedUrl === validated;

  const handleCommit = () => {
    if (!canUse || !validated) return;
    onCommit(validated);
  };

  const statusText = (() => {
    if (probeState === "idle") return "Or paste an image URL";
    if (probeState === "syntax-invalid") return "Must be an https:// URL";
    if (probeState === "probing") return "Checking the URL…";
    if (probeState === "image") return "Looks like an image";
    return "This doesn't look like an image";
  })();

  const statusTone =
    probeState === "image"
      ? "text-emerald-400"
      : probeState === "not-image" || probeState === "syntax-invalid"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div>
      <p className={`text-xs mb-2 ${statusTone}`}>{statusText}</p>
      <div className="flex gap-2">
        <Input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCommit();
            }
          }}
          placeholder="https://example.com/image.png"
          inputMode="url"
          className="text-sm"
          aria-label={`Paste ${SLOT_LABELS[slot]} URL`}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCommit}
          disabled={!canUse || isCommitted}
        >
          {isCommitted ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Used
            </>
          ) : probeState === "probing" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Checking
            </>
          ) : (
            "Use"
          )}
        </Button>
      </div>
      {/* Inline preview at slot aspect ratio once the probe confirms it's an
          image. Lets the admin verify the visual *before* clicking Use. */}
      {canUse && validated && (
        <div
          className={`mt-3 rounded-md bg-black/30 overflow-hidden max-w-[280px] ${SLOT_ASPECT[slot]}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={validated}
            alt={`${SLOT_LABELS[slot]} URL preview`}
            className={`h-full w-full ${SLOT_OBJECT_FIT[slot]}`}
          />
        </div>
      )}
    </div>
  );
}
