"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  fetchSlotAssetsPage,
  fetchSteamGridDbAssets,
  getUploadAuth,
  lookupSteamGridDb,
  saveCuration,
  type PickSource,
  type SaveCurationInput,
  type SteamGridDbAsset,
  type SteamGridDbAssetSet,
  type SteamGridDbGame,
  type SteamGridDbLookupMode,
} from "@/app/(admin)/games/steamgriddb-actions";

type Step = "search" | "pick" | "preview";
type AssetSlot = "grid" | "icon" | "hero" | "logo";

interface SlotState {
  source: "steamgriddb" | "manual" | "skip";
  sgdbAsset?: SteamGridDbAsset;
  manualFile?: File;
  manualPreviewUrl?: string;
  manualUploadedUrl?: string;
}

const ALL_SLOTS: AssetSlot[] = ["grid", "icon", "hero", "logo"];
const SLOT_LABELS: Record<AssetSlot, string> = {
  grid: "Grid",
  icon: "Icon",
  hero: "Hero",
  logo: "Logo",
};
const SLOT_TO_SET_KEY: Record<AssetSlot, keyof SteamGridDbAssetSet> = {
  grid: "grids",
  icon: "icons",
  hero: "heroes",
  logo: "logos",
};

// Logo is the odd one out: SteamGridDB logos are transparent PNGs at varying
// aspect ratios, so they get a wide-ish container and object-contain (no crop).
// Other slots fill their container.
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

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// File extension that ImageKit should store / serve under, derived from MIME.
// Critical for animated formats — uploading a GIF as `.jpg` strips animation.
function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/gif") return "gif";
  if (m === "image/webp") return "webp";
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  return "jpg";
}

function freshSlotState(): Record<AssetSlot, SlotState> {
  return {
    grid: { source: "skip" },
    icon: { source: "skip" },
    hero: { source: "skip" },
    logo: { source: "skip" },
  };
}

interface SteamGridDbCurationDialogProps {
  gameId: string;
  gameName: string;
  steamAppId: string | null;
  existingSteamGridDbId: number | null;
  trigger: React.ReactNode;
}

export function SteamGridDbCurationDialog({
  gameId,
  gameName,
  steamAppId,
  existingSteamGridDbId,
  trigger,
}: SteamGridDbCurationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("search");

  // Step 1 — search
  const [mode, setMode] = useState<SteamGridDbLookupMode>("name");
  const [nameQuery, setNameQuery] = useState(gameName);
  const [steamIdQuery, setSteamIdQuery] = useState(steamAppId ?? "");
  const [sgdbIdQuery, setSgdbIdQuery] = useState(
    existingSteamGridDbId !== null ? String(existingSteamGridDbId) : "",
  );
  const [results, setResults] = useState<SteamGridDbGame[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Step 2 — pick
  const [picked, setPicked] = useState<SteamGridDbGame | null>(null);
  const [assetSet, setAssetSet] = useState<SteamGridDbAssetSet | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [slotStates, setSlotStates] = useState(freshSlotState);
  const [activeSlot, setActiveSlot] = useState<AssetSlot>("grid");
  // Pagination state (per slot). slotPages[slot] = highest page already loaded.
  // slotHasMore[slot] = derived from last response — false hides the "Load more"
  // button. slotLoadingMore[slot] = loading spinner on the button.
  const [slotPages, setSlotPages] = useState<Record<AssetSlot, number>>({
    grid: 1, icon: 1, hero: 1, logo: 1,
  });
  const [slotHasMore, setSlotHasMore] = useState<Record<AssetSlot, boolean>>({
    grid: false, icon: false, hero: false, logo: false,
  });
  const [slotLoadingMore, setSlotLoadingMore] = useState<Record<AssetSlot, boolean>>({
    grid: false, icon: false, hero: false, logo: false,
  });

  // Step 3 — save
  const [isSaving, startSaving] = useTransition();

  // Mirror slotStates into a ref so the unmount/close cleanup effect can read
  // the latest URLs without putting slotStates in its dep array (which would
  // re-fire on every render).
  const slotStatesRef = useRef(slotStates);
  slotStatesRef.current = slotStates;

  // Revoke any outstanding blob URLs when the dialog transitions to closed,
  // so cancelled upload sessions don't leak preview blobs (up to 4 × 5 MB)
  // until page reload.
  useEffect(() => {
    if (open) return;
    for (const slot of ALL_SLOTS) {
      const url = slotStatesRef.current[slot].manualPreviewUrl;
      if (url) URL.revokeObjectURL(url);
    }
  }, [open]);

  // Switching search modes shouldn't carry stale results or error messages
  // from the previous mode into the new tab.
  const handleModeChange = useCallback((next: SteamGridDbLookupMode) => {
    setMode(next);
    setResults([]);
    setSearchError(null);
  }, []);

  // Shared by handlePickGame (search → click result) and the auto-skip path
  // in resetAll (re-enrich with a known SteamGridDB id, issue #178).
  const loadAssetsForGame = useCallback(async (game: SteamGridDbGame) => {
    setPicked(game);
    setSlotStates(freshSlotState());
    setSlotPages({ grid: 1, icon: 1, hero: 1, logo: 1 });
    setIsLoadingAssets(true);
    const res = await fetchSteamGridDbAssets(game.id);
    setIsLoadingAssets(false);
    if (!res.success) {
      return { success: false as const, error: res.error };
    }
    const data = res.data ?? null;
    setAssetSet(data);
    if (data) {
      setSlotHasMore({
        grid: data.grids.length >= 50,
        icon: data.icons.length >= 50,
        hero: data.heroes.length >= 50,
        logo: data.logos.length >= 50,
      });
    }
    return { success: true as const };
  }, []);

  const resetAll = useCallback(() => {
    setStep("search");
    setMode("name");
    setNameQuery(gameName);
    setSteamIdQuery(steamAppId ?? "");
    setSgdbIdQuery(
      existingSteamGridDbId !== null ? String(existingSteamGridDbId) : "",
    );
    setResults([]);
    setSearchError(null);
    setPicked(null);
    setAssetSet(null);
    setSlotStates(freshSlotState());
    setActiveSlot("grid");
    setSlotPages({ grid: 1, icon: 1, hero: 1, logo: 1 });
    setSlotHasMore({ grid: false, icon: false, hero: false, logo: false });
    setSlotLoadingMore({ grid: false, icon: false, hero: false, logo: false });

    // Issue #178: when re-enriching a game whose SteamGridDB id we already
    // know, jump straight to the pick step and load that game's assets in
    // the background. The 90% case for re-enrich is "swap an asset on the
    // same SGDB game"; forcing a re-search adds friction. Synthesize a
    // minimal SteamGridDbGame from the stored id — we use the row's name as
    // the display label rather than round-tripping SGDB to fetch the real
    // SGDB-side name. Falls back to the search step on fetch failure.
    if (existingSteamGridDbId !== null) {
      const synthGame: SteamGridDbGame = {
        id: existingSteamGridDbId,
        name: gameName,
        release_date: null,
        types: [],
      };
      setStep("pick");
      void loadAssetsForGame(synthGame).then((res) => {
        if (!res.success) {
          toast.error(res.error ?? "Failed to load previously enriched assets");
          setStep("search");
          setPicked(null);
        }
      });
    }
  }, [gameName, steamAppId, existingSteamGridDbId, loadAssetsForGame]);

  const currentValue = (): string => {
    if (mode === "name") return nameQuery;
    if (mode === "steam_id") return steamIdQuery;
    return sgdbIdQuery;
  };

  const handleSearch = useCallback(async () => {
    const value = currentValue().trim();
    if (!value) return;
    setIsSearching(true);
    setSearchError(null);
    setResults([]);
    const res = await lookupSteamGridDb({ mode, value });
    setIsSearching(false);
    if (!res.success) {
      setSearchError(res.error ?? "Lookup failed");
      return;
    }
    setResults(res.data ?? []);
    if ((res.data ?? []).length === 0) {
      setSearchError("No matches");
    }
  }, [mode, nameQuery, steamIdQuery, sgdbIdQuery]);

  const handlePickGame = async (game: SteamGridDbGame) => {
    const res = await loadAssetsForGame(game);
    if (!res.success) {
      toast.error(res.error ?? "Failed to load assets");
      return;
    }
    setStep("pick");
  };

  // Append the next page of one slot's results to the displayed list.
  const handleLoadMore = async (slot: AssetSlot) => {
    if (!picked || slotLoadingMore[slot]) return;
    const nextPage = slotPages[slot] + 1;
    setSlotLoadingMore((p) => ({ ...p, [slot]: true }));
    const res = await fetchSlotAssetsPage({
      steamGridDbGameId: picked.id,
      slot,
      page: nextPage,
    });
    setSlotLoadingMore((p) => ({ ...p, [slot]: false }));
    if (!res.success) {
      toast.error(res.error ?? "Failed to load more assets");
      return;
    }
    const newItems = res.data ?? [];
    setAssetSet((prev) => {
      if (!prev) return prev;
      const setKey = SLOT_TO_SET_KEY[slot];
      return { ...prev, [setKey]: [...prev[setKey], ...newItems] };
    });
    setSlotPages((p) => ({ ...p, [slot]: nextPage }));
    setSlotHasMore((p) => ({ ...p, [slot]: !!res.hasMore }));
  };

  const handleSkipToManual = () => {
    setPicked(null);
    setAssetSet(null);
    setSlotStates(freshSlotState());
    setStep("pick");
  };

  const updateSlot = (slot: AssetSlot, next: SlotState) => {
    setSlotStates((prev) => ({ ...prev, [slot]: next }));
  };

  const handlePickAsset = (slot: AssetSlot, asset: SteamGridDbAsset) => {
    const current = slotStates[slot];
    if (current.source === "steamgriddb" && current.sgdbAsset?.id === asset.id) {
      updateSlot(slot, { source: "skip" });
    } else {
      if (current.manualPreviewUrl) URL.revokeObjectURL(current.manualPreviewUrl);
      updateSlot(slot, { source: "steamgriddb", sgdbAsset: asset });
    }
  };

  const handleManualFile = (slot: AssetSlot, file: File | null) => {
    const current = slotStates[slot];
    if (current.manualPreviewUrl) URL.revokeObjectURL(current.manualPreviewUrl);
    if (!file) {
      updateSlot(slot, { source: "skip" });
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error(`${SLOT_LABELS[slot]}: only PNG, JPG, WebP, or GIF allowed`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`${SLOT_LABELS[slot]}: file too large (max 5 MB)`);
      return;
    }
    updateSlot(slot, {
      source: "manual",
      manualFile: file,
      manualPreviewUrl: URL.createObjectURL(file),
    });
  };

  const slotResolvedPreview = (slot: AssetSlot): string | null => {
    const s = slotStates[slot];
    // Use the full asset URL (not thumb) for SteamGridDB picks so animated
    // GIF / WebP assets actually animate in the preview.
    if (s.source === "steamgriddb") return s.sgdbAsset?.url ?? s.sgdbAsset?.thumb ?? null;
    if (s.source === "manual") return s.manualPreviewUrl ?? null;
    return null;
  };

  const hasAnyPick = ALL_SLOTS.some((slot) => slotStates[slot].source !== "skip");

  const handleSave = () => {
    if (!hasAnyPick) {
      toast.error("Pick at least one asset (or upload one) before saving");
      return;
    }
    startSaving(async () => {
      // Upload manuals client-side first via signature flow.
      const manualSlots = ALL_SLOTS.filter(
        (s) => slotStates[s].source === "manual" && slotStates[s].manualFile,
      );

      if (manualSlots.length > 0) {
        try {
          for (const slot of manualSlots) {
            // Fresh auth per upload: ImageKit's token is single-use (it's a
            // nonce in the signed payload). Reusing the same token across
            // multiple uploads gets rejected with "token has been used before".
            const authRes = await getUploadAuth();
            if (!authRes.success || !authRes.data) {
              throw new Error(authRes.error ?? "Failed to get upload auth");
            }
            const auth = authRes.data;
            const file = slotStates[slot].manualFile!;
            // Use the file's actual extension so ImageKit stores/serves with
            // the correct format. Hardcoding `.jpg` would strip animation
            // from GIFs/animated WebPs.
            const ext = mimeToExt(file.type);
            const formData = new FormData();
            formData.append("file", file);
            formData.append("fileName", `${slot}.${ext}`);
            formData.append("folder", `/games/${gameId}`);
            formData.append("useUniqueFileName", "false");
            formData.append("overwriteFile", "true");
            formData.append("publicKey", auth.publicKey);
            formData.append("token", auth.token);
            formData.append("expire", String(auth.expire));
            formData.append("signature", auth.signature);

            const res = await fetch(
              "https://upload.imagekit.io/api/v1/files/upload",
              { method: "POST", body: formData },
            );
            if (!res.ok) {
              const body = await res.text();
              throw new Error(`ImageKit upload (${slot}) ${res.status}: ${body}`);
            }
            const json = (await res.json()) as { url?: string };
            if (!json.url) throw new Error(`ImageKit upload (${slot}) returned no URL`);
            setSlotStates((prev) => ({
              ...prev,
              [slot]: { ...prev[slot], manualUploadedUrl: json.url! },
            }));
            slotStates[slot].manualUploadedUrl = json.url;
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Manual upload failed");
          return;
        }
      }

      const picks: SaveCurationInput["picks"] = {};
      for (const slot of ALL_SLOTS) {
        const s = slotStates[slot];
        if (s.source === "steamgriddb" && s.sgdbAsset) {
          picks[slot] = { type: "steamgriddb", sourceUrl: s.sgdbAsset.url };
        } else if (s.source === "manual" && s.manualUploadedUrl) {
          picks[slot] = { type: "manual", imageKitUrl: s.manualUploadedUrl };
        } else {
          picks[slot] = { type: "skip" } as PickSource;
        }
      }

      const res = await saveCuration({
        gameId,
        steamGridDbGameId: picked?.id ?? null,
        picks,
      });
      if (!res.success) {
        toast.error(res.error ?? "Save failed");
        return;
      }
      toast.success(`Enriched "${gameName}"`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetAll();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-[960px] max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            {step === "search"
              ? "Enrich assets via SteamGridDB"
              : step === "pick"
                ? `Pick assets for "${picked?.name ?? gameName}"`
                : "Preview & save"}
          </DialogTitle>
          {step === "search" && (
            <p className="text-sm text-muted-foreground mt-1">
              Find this game on SteamGridDB to pull curated icons, transparent logos, hero banners, and stylized covers. Or skip to upload your own.
            </p>
          )}
        </DialogHeader>

        {step === "search" && (
          <SearchStep
            mode={mode}
            onModeChange={handleModeChange}
            nameQuery={nameQuery}
            onNameQueryChange={setNameQuery}
            steamIdQuery={steamIdQuery}
            onSteamIdQueryChange={setSteamIdQuery}
            sgdbIdQuery={sgdbIdQuery}
            onSgdbIdQueryChange={setSgdbIdQuery}
            isSearching={isSearching}
            results={results}
            searchError={searchError}
            onSearch={handleSearch}
            onPickGame={handlePickGame}
            onSkipToManual={handleSkipToManual}
            isLoadingAssets={isLoadingAssets}
          />
        )}

        {step === "pick" && (
          <PickStep
            picked={picked}
            assetSet={assetSet}
            slotStates={slotStates}
            activeSlot={activeSlot}
            onActiveSlotChange={setActiveSlot}
            onPickAsset={handlePickAsset}
            onManualFile={handleManualFile}
            slotHasMore={slotHasMore}
            slotLoadingMore={slotLoadingMore}
            onLoadMore={handleLoadMore}
            onBack={() => setStep("search")}
            onContinue={() => {
              if (!hasAnyPick) {
                toast.error("Pick at least one asset before continuing");
                return;
              }
              setStep("preview");
            }}
          />
        )}

        {step === "preview" && (
          <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 flex flex-col gap-4">
            <button
              onClick={() => setStep("pick")}
              disabled={isSaving}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-start disabled:opacity-50"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to picks
            </button>

            <div className="grid grid-cols-2 gap-4">
              {ALL_SLOTS.map((slot) => {
                const previewSrc = slotResolvedPreview(slot);
                return (
                  <div
                    key={slot}
                    className="rounded-lg border border-border/50 bg-muted/20 p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                      <span>{SLOT_LABELS[slot]}</span>
                      <span className="text-[10px] opacity-70">
                        {slotStates[slot].source === "skip"
                          ? "Skipped"
                          : slotStates[slot].source === "manual"
                            ? "Manual upload"
                            : "From SteamGridDB"}
                      </span>
                    </div>
                    <div
                      className={`rounded-md bg-black/30 overflow-hidden flex items-center justify-center ${SLOT_ASPECT[slot]}`}
                    >
                      {previewSrc ? (
                        <img
                          src={previewSrc}
                          alt={`${slot} preview`}
                          className={`h-full w-full ${SLOT_OBJECT_FIT[slot]}`}
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator className="bg-border/50" />

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {ALL_SLOTS.filter((s) => slotStates[s].source !== "skip").length} of 4 slots will be saved.
              </p>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Uploading to ImageKit…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Save enrichment
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Search
// ---------------------------------------------------------------------------

interface SearchStepProps {
  mode: SteamGridDbLookupMode;
  onModeChange: (m: SteamGridDbLookupMode) => void;
  nameQuery: string;
  onNameQueryChange: (v: string) => void;
  steamIdQuery: string;
  onSteamIdQueryChange: (v: string) => void;
  sgdbIdQuery: string;
  onSgdbIdQueryChange: (v: string) => void;
  isSearching: boolean;
  results: SteamGridDbGame[];
  searchError: string | null;
  onSearch: () => void;
  onPickGame: (g: SteamGridDbGame) => void;
  onSkipToManual: () => void;
  isLoadingAssets: boolean;
}

function SearchStep({
  mode,
  onModeChange,
  nameQuery,
  onNameQueryChange,
  steamIdQuery,
  onSteamIdQueryChange,
  sgdbIdQuery,
  onSgdbIdQueryChange,
  isSearching,
  results,
  searchError,
  onSearch,
  onPickGame,
  onSkipToManual,
  isLoadingAssets,
}: SearchStepProps) {
  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearch();
    }
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <Tabs
        value={mode}
        onValueChange={(v) => onModeChange(v as SteamGridDbLookupMode)}
        className="w-full"
      >
        <TabsList className="w-full">
          <TabsTrigger value="name">By Name</TabsTrigger>
          <TabsTrigger value="steam_id">By Steam App ID</TabsTrigger>
          <TabsTrigger value="steamgriddb_id">By SteamGridDB ID</TabsTrigger>
        </TabsList>

        <TabsContent value="name" className="mt-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={nameQuery}
                onChange={(e) => onNameQueryChange(e.target.value)}
                onKeyDown={handleEnter}
                placeholder="Game name…"
                className="pl-9"
                autoFocus
              />
            </div>
            <Button onClick={onSearch} disabled={isSearching || !nameQuery.trim()} variant="secondary">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="steam_id" className="mt-3">
          <div className="flex gap-2">
            <Input
              value={steamIdQuery}
              onChange={(e) => onSteamIdQueryChange(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleEnter}
              placeholder="Steam App ID, e.g. 1245620"
              inputMode="numeric"
            />
            <Button onClick={onSearch} disabled={isSearching || !steamIdQuery.trim()} variant="secondary">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="steamgriddb_id" className="mt-3">
          <div className="flex gap-2">
            <Input
              value={sgdbIdQuery}
              onChange={(e) => onSgdbIdQueryChange(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleEnter}
              placeholder="SteamGridDB game ID"
              inputMode="numeric"
            />
            <Button onClick={onSearch} disabled={isSearching || !sgdbIdQuery.trim()} variant="secondary">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {searchError && (
        <p className="text-sm text-muted-foreground">{searchError}</p>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
        {results.length > 0 && (
          <div className="space-y-1">
            {results.map((game) => {
              const year = game.release_date
                ? new Date(game.release_date * 1000).getFullYear()
                : null;
              return (
                <button
                  key={game.id}
                  onClick={() => onPickGame(game)}
                  disabled={isLoadingAssets}
                  className="w-full flex items-center gap-3 rounded-lg p-3 text-left transition-all hover:bg-muted/40 disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{game.name}</p>
                      {year && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({year})
                        </span>
                      )}
                      {game.verified && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0"
                        >
                          Verified
                        </Badge>
                      )}
                    </div>
                    {game.types && game.types.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {game.types.slice(0, 4).map((t) => (
                          <span key={t} className="text-[10px] text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    #{game.id}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Separator className="bg-border/50" />

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onSkipToManual} className="text-muted-foreground hover:text-foreground">
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Skip — manual upload only
        </Button>
        <p className="text-xs text-muted-foreground">
          Click a result to load its assets.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Pick assets
// ---------------------------------------------------------------------------

interface PickStepProps {
  picked: SteamGridDbGame | null;
  assetSet: SteamGridDbAssetSet | null;
  slotStates: Record<AssetSlot, SlotState>;
  activeSlot: AssetSlot;
  onActiveSlotChange: (s: AssetSlot) => void;
  onPickAsset: (slot: AssetSlot, asset: SteamGridDbAsset) => void;
  onManualFile: (slot: AssetSlot, file: File | null) => void;
  slotHasMore: Record<AssetSlot, boolean>;
  slotLoadingMore: Record<AssetSlot, boolean>;
  onLoadMore: (slot: AssetSlot) => void;
  onBack: () => void;
  onContinue: () => void;
}

function PickStep({
  picked,
  assetSet,
  slotStates,
  activeSlot,
  onActiveSlotChange,
  onPickAsset,
  onManualFile,
  slotHasMore,
  slotLoadingMore,
  onLoadMore,
  onBack,
  onContinue,
}: PickStepProps) {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-start"
      >
        <ArrowLeft className="h-3 w-3" />
        Change SteamGridDB game
      </button>

      <Tabs
        value={activeSlot}
        onValueChange={(v) => onActiveSlotChange(v as AssetSlot)}
        className="w-full flex flex-col gap-3 flex-1 min-h-0"
      >
        <TabsList className="w-full">
          {ALL_SLOTS.map((slot) => {
            const s = slotStates[slot];
            const filled = s.source !== "skip";
            return (
              <TabsTrigger key={slot} value={slot} className="gap-1.5">
                {SLOT_LABELS[slot]}
                {filled && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {ALL_SLOTS.map((slot) => {
          const s = slotStates[slot];
          const sgdbList = assetSet?.[SLOT_TO_SET_KEY[slot]] ?? [];
          return (
            <TabsContent
              key={slot}
              value={slot}
              className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1"
            >
              <div className="flex flex-col gap-3">
                <ManualUploadZone
                  slot={slot}
                  state={s}
                  onChange={(file) => onManualFile(slot, file)}
                />

                {picked && (
                  <>
                    <Separator className="bg-border/50" />
                    <div>
                      {sgdbList.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          No SteamGridDB results — use upload above.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            {sgdbList.map((asset) => {
                              const isSelected =
                                s.source === "steamgriddb" &&
                                s.sgdbAsset?.id === asset.id;
                              return (
                                <button
                                  key={asset.id}
                                  onClick={() => onPickAsset(slot, asset)}
                                  className={`group relative rounded-md overflow-hidden bg-black/30 transition-all ${SLOT_ASPECT[slot]} ${
                                    isSelected
                                      ? "ring-2 ring-amber-400"
                                      : "ring-1 ring-border/30 hover:ring-amber-400/50"
                                  }`}
                                >
                                  <img
                                    src={
                                      // GIFs and (potentially-animated) WebPs need
                                      // the full URL to actually animate. Other
                                      // formats use the smaller thumb for faster
                                      // picker load.
                                      asset.mime === "image/gif" ||
                                      asset.mime === "image/webp"
                                        ? asset.url
                                        : asset.thumb || asset.url
                                    }
                                    alt={`Option by ${asset.author?.name ?? "unknown"}`}
                                    loading="lazy"
                                    className={`h-full w-full ${SLOT_OBJECT_FIT[slot]}`}
                                  />
                                  {isSelected && (
                                    <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center">
                                      <Check className="h-3 w-3 text-black" />
                                    </span>
                                  )}
                                  <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-white p-1 truncate">
                                    {asset.author?.name ?? "?"} · ↑{asset.upvotes}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {slotHasMore[slot] && (
                            <div className="flex justify-center mt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onLoadMore(slot)}
                                disabled={slotLoadingMore[slot]}
                                className="text-xs text-muted-foreground hover:text-amber-400"
                              >
                                {slotLoadingMore[slot] ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                    Loading…
                                  </>
                                ) : (
                                  "Load more"
                                )}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <Separator className="bg-border/50" />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {ALL_SLOTS.filter((s) => slotStates[s].source !== "skip").length} of 4 slots filled
        </p>
        <Button
          onClick={onContinue}
          className="bg-amber-600 hover:bg-amber-500 text-white"
        >
          Continue to preview
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual upload zone (per slot)
// ---------------------------------------------------------------------------

function ManualUploadZone({
  slot,
  state,
  onChange,
}: {
  slot: AssetSlot;
  state: SlotState;
  onChange: (file: File | null) => void;
}) {
  const inputId = `upload-${slot}`;
  const isManual = state.source === "manual";

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Or upload your own</p>
      {isManual && state.manualPreviewUrl ? (
        <div className="flex items-center gap-3 rounded-md border border-amber-400/30 bg-amber-400/5 p-2">
          <img
            src={state.manualPreviewUrl}
            alt="upload preview"
            className="h-12 w-12 rounded object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{state.manualFile?.name}</p>
            <p className="text-xs text-muted-foreground">
              {state.manualFile
                ? `${(state.manualFile.size / 1024).toFixed(0)} KB · ${state.manualFile.type}`
                : ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground hover:border-amber-400/50 hover:bg-amber-400/5 hover:text-foreground cursor-pointer transition-colors"
        >
          <Upload className="h-4 w-4" />
          Drop a PNG/JPG/WebP/GIF here or click to choose (max 5 MB)
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
