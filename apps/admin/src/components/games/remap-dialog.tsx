"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Gamepad2, ArrowRight, Check, ArrowLeft } from "lucide-react";
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
import { toast } from "sonner";
import {
  searchIgdb,
  getRemapPlan,
  remapGame,
  type IgdbSearchResult,
  type IgdbMetadata,
  type RemapPlan,
} from "@/app/(admin)/games/actions";
import { RemapPreview } from "./remap-preview";

interface RemapDialogProps {
  gameId: string;
  currentName: string;
  currentCoverUrl: string | null;
  currentIgdbId: number | null;
  discordApplicationId: string | null;
}

type Step = "search" | "preview";

export function RemapDialog({
  gameId,
  currentName,
  currentCoverUrl,
  currentIgdbId,
  discordApplicationId,
}: RemapDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState(currentName);
  const [results, setResults] = useState<IgdbSearchResult[]>([]);
  const [selected, setSelected] = useState<IgdbSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isApplying, startApply] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RemapPlan | null>(null);
  const [igdbMetadata, setIgdbMetadata] = useState<IgdbMetadata | null>(null);

  const resetToSearch = () => {
    setStep("search");
    setPlan(null);
    setIgdbMetadata(null);
  };

  const resetAll = () => {
    setQuery(currentName);
    setResults([]);
    setSelected(null);
    setSearchError(null);
    resetToSearch();
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setSelected(null);

    const { results: data, error } = await searchIgdb(query);
    setResults(data);
    if (error) setSearchError(error);
    setIsSearching(false);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleShowPreview = async () => {
    if (!selected) return;
    setIsLoadingPlan(true);
    const result = await getRemapPlan(gameId, selected.igdb_id);
    setIsLoadingPlan(false);

    if (result.error || !result.plan || !result.igdbMetadata) {
      toast.error(result.error ?? "Failed to load remap plan");
      return;
    }

    setPlan(result.plan);
    setIgdbMetadata(result.igdbMetadata);
    setStep("preview");
  };

  const handleConfirm = () => {
    if (!plan || !igdbMetadata || !selected) return;
    const expectedMode = plan.mode;

    startApply(async () => {
      const result = await remapGame(gameId, selected.igdb_id, igdbMetadata, expectedMode);

      if (result.success) {
        toast.success(
          result.mode === "refresh"
            ? `Metadata refreshed for "${igdbMetadata.name}"`
            : `Game remapped to "${igdbMetadata.name}"`,
        );
        setOpen(false);
        router.refresh();
        return;
      }

      // Mode drifted between plan and apply — re-fetch and let admin decide.
      if (result.error === "mode_mismatch") {
        toast.warning(
          `Mode changed since preview (was ${result.expectedMode}, now ${result.actualMode}). Reloading preview.`,
        );
        const fresh = await getRemapPlan(gameId, selected.igdb_id);
        if (fresh.plan && fresh.igdbMetadata) {
          setPlan(fresh.plan);
          setIgdbMetadata(fresh.igdbMetadata);
        } else {
          resetToSearch();
        }
        return;
      }

      // merge_required shouldn't reach here (UI disables confirm) but defend.
      if (result.error === "merge_required") {
        toast.error("Merge mode required — not yet supported in this UI (PR 2).");
        return;
      }

      toast.error(result.error ?? "Remap failed");
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
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border/50 hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:text-indigo-400 transition-all"
          />
        }
      >
        <ArrowRight className="h-3.5 w-3.5" />
        Remap
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {step === "search" ? "Remap Game" : "Confirm remap"}
          </DialogTitle>
          {step === "search" && (
            <p className="text-sm text-muted-foreground mt-1">
              Search IGDB and select the correct game. The Discord Application ID
              {discordApplicationId ? (
                <> (<code className="text-xs bg-muted px-1.5 py-0.5 rounded">{discordApplicationId}</code>)</>
              ) : null}{" "}
              will be preserved.
            </p>
          )}
        </DialogHeader>

        {step === "search" && (
          <>
            {/* Current game preview */}
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="h-10 w-8 rounded bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                {currentCoverUrl ? (
                  <img src={currentCoverUrl} alt={currentName} className="h-full w-full object-cover" />
                ) : (
                  <Gamepad2 className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{currentName}</p>
                <p className="text-xs text-muted-foreground">Current mapping</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search IGDB..."
                  className="pl-9 bg-background/50 border-border/50"
                  autoFocus
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !query.trim()} variant="secondary">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {searchError && (
              <p className="text-sm text-destructive">{searchError}</p>
            )}

            {/* Results */}
            <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
              {results.length > 0 && (
                <div className="space-y-1">
                  {results.map((result, index) => {
                    const isSelected = selected?.igdb_id === result.igdb_id;
                    return (
                      <button
                        key={`${result.igdb_id}-${index}`}
                        onClick={() => setSelected(isSelected ? null : result)}
                        className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-all ${
                          isSelected
                            ? "bg-indigo-500/10 ring-1 ring-indigo-500/30"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="h-12 w-9 rounded bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                          {result.cover_url ? (
                            <img src={result.cover_url} alt={result.name} className="h-full w-full object-cover" />
                          ) : (
                            <Gamepad2 className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{result.name}</p>
                            {result.release_year && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                ({result.release_year})
                              </span>
                            )}
                            {result.igdb_id === currentIgdbId ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shrink-0">
                                Current
                              </Badge>
                            ) : result.existing_game_id ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0">
                                In DB
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {result.genres && result.genres.length > 0 && (
                              <div className="flex gap-1 shrink-0">
                                {result.genres.slice(0, 2).map((g) => (
                                  <Badge key={g} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground">
                                    {g}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="shrink-0 h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {results.length === 0 && !isSearching && !searchError && query && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Click Search to find games on IGDB
                </p>
              )}
            </div>

            {/* Show preview */}
            {selected && (
              <>
                <Separator className="bg-border/50" />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Remap to <span className="font-medium text-foreground">{selected.name}</span>
                  </p>
                  <Button
                    onClick={handleShowPreview}
                    disabled={isLoadingPlan}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {isLoadingPlan ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Loading preview…</>
                    ) : (
                      "Show preview"
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {step === "preview" && plan && igdbMetadata && (
          <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
            <button
              onClick={resetToSearch}
              disabled={isApplying}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 disabled:opacity-50"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to search
            </button>
            <RemapPreview
              plan={plan}
              igdbMetadata={igdbMetadata}
              isApplying={isApplying}
              onConfirm={handleConfirm}
              onCancel={() => setOpen(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
