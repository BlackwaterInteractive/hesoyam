"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  Search,
  Sparkles,
  Trash2,
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
  getUploadAuth,
  lookupSteamGridDb,
  updateSingleSlot,
  type PickSource,
  type SteamGridDbAsset,
  type SteamGridDbGame,
  type SteamGridDbLookupMode,
} from "@/app/(admin)/games/steamgriddb-actions";

type AssetSlot = "grid" | "icon" | "hero" | "logo";
type Step = "search" | "pick";

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

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/gif") return "gif";
  if (m === "image/webp") return "webp";
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  return "jpg";
}

interface SlotEditDialogProps {
  gameId: string;
  gameName: string;
  steamAppId: string | null;
  existingSteamGridDbId: number | null;
  slot: AssetSlot;
  currentUrl: string | null;
  trigger: React.ReactNode;
}

interface PickedAsset {
  source: "steamgriddb" | "manual" | "skip";
  sgdbAsset?: SteamGridDbAsset;
  manualFile?: File;
  manualPreviewUrl?: string;
}

export function SlotEditDialog({
  gameId,
  gameName,
  steamAppId,
  existingSteamGridDbId,
  slot,
  currentUrl,
  trigger,
}: SlotEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("search");

  // Search state
  const [mode, setMode] = useState<SteamGridDbLookupMode>("name");
  const [nameQuery, setNameQuery] = useState(gameName);
  const [steamIdQuery, setSteamIdQuery] = useState(steamAppId ?? "");
  const [sgdbIdQuery, setSgdbIdQuery] = useState(
    existingSteamGridDbId !== null ? String(existingSteamGridDbId) : "",
  );
  const [results, setResults] = useState<SteamGridDbGame[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Pick state
  const [picked, setPicked] = useState<SteamGridDbGame | null>(null);
  const [assets, setAssets] = useState<SteamGridDbAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pick, setPick] = useState<PickedAsset>({ source: "skip" });

  const [isSaving, startSaving] = useTransition();

  // Cleanup blob URL when dialog closes.
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (open) return;
    if (pickRef.current.manualPreviewUrl) {
      URL.revokeObjectURL(pickRef.current.manualPreviewUrl);
    }
  }, [open]);

  // Shared by handlePickGame (search → click result) and the auto-skip path
  // in resetAll (re-edit a slot when the SGDB game is already known).
  const loadAssetsForGame = useCallback(
    async (game: SteamGridDbGame) => {
      setPicked(game);
      setPick({ source: "skip" });
      setIsLoadingAssets(true);
      const res = await fetchSlotAssetsPage({
        steamGridDbGameId: game.id,
        slot,
        page: 1,
      });
      setIsLoadingAssets(false);
      if (!res.success) {
        return { success: false as const, error: res.error };
      }
      setAssets(res.data ?? []);
      setPage(1);
      setHasMore(!!res.hasMore);
      return { success: true as const };
    },
    [slot],
  );

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
    setAssets([]);
    setPage(1);
    setHasMore(false);
    setPick({ source: "skip" });

    // Auto-skip search when the SGDB game is already known (issue #178). The
    // 90% case for editing a single slot is "I want a different image of the
    // same SGDB game" — re-searching to land on the same entry is friction.
    // Use the row's name as the display label rather than round-tripping SGDB.
    // Falls back to the search step on fetch failure.
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
          toast.error(res.error ?? "Failed to load assets");
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

  const handleSkipToManual = () => {
    setPicked(null);
    setAssets([]);
    setPick({ source: "skip" });
    setStep("pick");
  };

  const handleLoadMore = async () => {
    if (!picked || loadingMore) return;
    const next = page + 1;
    setLoadingMore(true);
    const res = await fetchSlotAssetsPage({
      steamGridDbGameId: picked.id,
      slot,
      page: next,
    });
    setLoadingMore(false);
    if (!res.success) {
      toast.error(res.error ?? "Failed to load more");
      return;
    }
    const newItems = res.data ?? [];
    const seen = new Set(assets.map((a) => a.id));
    setAssets((prev) => [...prev, ...newItems.filter((a) => !seen.has(a.id))]);
    setPage(next);
    setHasMore(!!res.hasMore);
  };

  const handlePickAsset = (asset: SteamGridDbAsset) => {
    if (pick.source === "steamgriddb" && pick.sgdbAsset?.id === asset.id) {
      setPick({ source: "skip" });
    } else {
      if (pick.manualPreviewUrl) URL.revokeObjectURL(pick.manualPreviewUrl);
      setPick({ source: "steamgriddb", sgdbAsset: asset });
    }
  };

  const handleManualFile = (file: File | null) => {
    if (pick.manualPreviewUrl) URL.revokeObjectURL(pick.manualPreviewUrl);
    if (!file) {
      setPick({ source: "skip" });
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error(`Only PNG, JPG, WebP, or GIF allowed`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`File too large (max 5 MB)`);
      return;
    }
    setPick({
      source: "manual",
      manualFile: file,
      manualPreviewUrl: URL.createObjectURL(file),
    });
  };

  const previewSrc = (): string | null => {
    if (pick.source === "steamgriddb")
      return pick.sgdbAsset?.url ?? pick.sgdbAsset?.thumb ?? null;
    if (pick.source === "manual") return pick.manualPreviewUrl ?? null;
    return null;
  };

  const submit = (pickSource: PickSource, successMessage: string) => {
    startSaving(async () => {
      const res = await updateSingleSlot({ gameId, slot, pick: pickSource });
      if (!res.success) {
        toast.error(res.error ?? "Save failed");
        return;
      }
      toast.success(successMessage);
      setOpen(false);
      router.refresh();
    });
  };

  const handleSave = () => {
    if (pick.source === "skip") {
      toast.error("Pick a SteamGridDB asset or upload an image first");
      return;
    }
    startSaving(async () => {
      let pickSource: PickSource;
      if (pick.source === "steamgriddb" && pick.sgdbAsset) {
        pickSource = { type: "steamgriddb", sourceUrl: pick.sgdbAsset.url };
      } else if (pick.source === "manual" && pick.manualFile) {
        // Upload manually-selected file via signature flow, then record the URL.
        try {
          const authRes = await getUploadAuth();
          if (!authRes.success || !authRes.data) {
            throw new Error(authRes.error ?? "Failed to get upload auth");
          }
          const auth = authRes.data;
          const ext = mimeToExt(pick.manualFile.type);
          const formData = new FormData();
          formData.append("file", pick.manualFile);
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
            throw new Error(`ImageKit upload ${res.status}: ${body}`);
          }
          const json = (await res.json()) as { url?: string };
          if (!json.url) throw new Error(`ImageKit upload returned no URL`);
          pickSource = { type: "manual", imageKitUrl: json.url };
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
          return;
        }
      } else {
        toast.error("No pick selected");
        return;
      }

      const res = await updateSingleSlot({ gameId, slot, pick: pickSource });
      if (!res.success) {
        toast.error(res.error ?? "Save failed");
        return;
      }
      toast.success(`${SLOT_LABELS[slot]} updated`);
      setOpen(false);
      router.refresh();
    });
  };

  const handleClear = () => {
    if (!confirm(`Clear the ${SLOT_LABELS[slot].toLowerCase()} for "${gameName}"? The file in ImageKit will be deleted.`)) return;
    submit({ type: "skip" }, `${SLOT_LABELS[slot]} cleared`);
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
      <DialogContent className="sm:max-w-[760px] max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Edit {SLOT_LABELS[slot]} for &ldquo;{gameName}&rdquo;
          </DialogTitle>
          {step === "search" && (
            <p className="text-sm text-muted-foreground mt-1">
              Find this game on SteamGridDB to pick a different {SLOT_LABELS[slot].toLowerCase()}, or skip to upload your own.
            </p>
          )}
        </DialogHeader>

        {step === "search" && (
          <SearchPane
            mode={mode}
            onModeChange={(m) => {
              setMode(m);
              setResults([]);
              setSearchError(null);
            }}
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
            currentUrl={currentUrl}
            onClear={handleClear}
            isSaving={isSaving}
          />
        )}

        {step === "pick" && (
          <PickPane
            slot={slot}
            picked={picked}
            assets={assets}
            isLoadingAssets={isLoadingAssets}
            pick={pick}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onPickAsset={handlePickAsset}
            onManualFile={handleManualFile}
            onLoadMore={handleLoadMore}
            onBack={() => setStep("search")}
          />
        )}

        {step === "pick" && (
          <>
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {pick.source === "skip" ? (
                  <span>No pick yet</span>
                ) : (
                  <>
                    <span>Selected:</span>
                    <div className={`rounded bg-black/30 overflow-hidden h-8 ${SLOT_ASPECT[slot]}`}>
                      {previewSrc() && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewSrc()!}
                          alt="selection"
                          className={`h-full w-full ${SLOT_OBJECT_FIT[slot]}`}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving || pick.source === "skip"}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Save {SLOT_LABELS[slot]}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Search pane (single-slot variant)
// ---------------------------------------------------------------------------

interface SearchPaneProps {
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
  currentUrl: string | null;
  onClear: () => void;
  isSaving: boolean;
}

function SearchPane({
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
  currentUrl,
  onClear,
  isSaving,
}: SearchPaneProps) {
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

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipToManual}
            className="text-muted-foreground hover:text-foreground"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Skip — manual upload only
          </Button>
          {currentUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={isSaving}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear this slot
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Click a result to load assets.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pick pane (single-slot variant)
// ---------------------------------------------------------------------------

interface PickPaneProps {
  slot: AssetSlot;
  picked: SteamGridDbGame | null;
  assets: SteamGridDbAsset[];
  isLoadingAssets: boolean;
  pick: PickedAsset;
  hasMore: boolean;
  loadingMore: boolean;
  onPickAsset: (asset: SteamGridDbAsset) => void;
  onManualFile: (file: File | null) => void;
  onLoadMore: () => void;
  onBack: () => void;
}

function PickPane({
  slot,
  picked,
  assets,
  isLoadingAssets,
  pick,
  hasMore,
  loadingMore,
  onPickAsset,
  onManualFile,
  onLoadMore,
  onBack,
}: PickPaneProps) {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-start"
      >
        <ArrowLeft className="h-3 w-3" />
        Change SteamGridDB game
      </button>

      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
        <div className="flex flex-col gap-3">
          <ManualUploadZone state={pick} onChange={onManualFile} />

          {picked && (
            <>
              <Separator className="bg-border/50" />
              <div>
                {isLoadingAssets ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : assets.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No SteamGridDB results — use upload above.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {assets.map((asset) => {
                        const isSelected =
                          pick.source === "steamgriddb" &&
                          pick.sgdbAsset?.id === asset.id;
                        return (
                          <button
                            key={asset.id}
                            onClick={() => onPickAsset(asset)}
                            className={`group relative rounded-md overflow-hidden bg-black/30 transition-all ${SLOT_ASPECT[slot]} ${
                              isSelected
                                ? "ring-2 ring-amber-400"
                                : "ring-1 ring-border/30 hover:ring-amber-400/50"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
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
                    {hasMore && (
                      <div className="flex justify-center mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onLoadMore}
                          disabled={loadingMore}
                          className="text-xs text-muted-foreground hover:text-amber-400"
                        >
                          {loadingMore ? (
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual upload zone
// ---------------------------------------------------------------------------

function ManualUploadZone({
  state,
  onChange,
}: {
  state: PickedAsset;
  onChange: (file: File | null) => void;
}) {
  const inputId = `slot-edit-upload`;
  const isManual = state.source === "manual";

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Or upload your own</p>
      {isManual && state.manualPreviewUrl ? (
        <div className="flex items-center gap-3 rounded-md border border-amber-400/30 bg-amber-400/5 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
