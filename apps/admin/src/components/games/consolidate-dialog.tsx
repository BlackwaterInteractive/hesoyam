"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  GitMerge,
  Loader2,
  Search,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  ArrowLeft,
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
import { toast } from "sonner";
import {
  getConsolidationCandidates,
  getConsolidationPlan,
  consolidateGames,
  searchGamesForConsolidation,
  type ConsolidationCandidate,
  type ConsolidationPlan,
} from "@/app/(admin)/games/actions";

type Step = "pick" | "preview";

interface PickedGame {
  id: string;
  name: string;
  igdb_id: number | null;
  metadata_source: string | null;
  cover_url: string | null;
}

export function ConsolidateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [candidates, setCandidates] = useState<ConsolidationCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [orphan, setOrphan] = useState<PickedGame | null>(null);
  const [canonical, setCanonical] = useState<PickedGame | null>(null);
  const [plan, setPlan] = useState<ConsolidationPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [isApplying, startApply] = useTransition();

  // Load candidates whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCandidatesLoading(true);
    getConsolidationCandidates().then(({ candidates: data, error }) => {
      if (error) toast.error(error);
      setCandidates(data);
      setCandidatesLoading(false);
    });
  }, [open]);

  const resetAll = () => {
    setStep("pick");
    setOrphan(null);
    setCanonical(null);
    setPlan(null);
  };

  const handlePickCandidate = (c: ConsolidationCandidate) => {
    if (!c.canonical_id || !c.canonical_name) {
      // Singleton orphan — admin still needs to manually pick a canonical.
      setOrphan({
        id: c.orphan_id,
        name: c.orphan_name,
        igdb_id: null,
        metadata_source: "discord",
        cover_url: null,
      });
      setCanonical(null);
      toast.message("Orphan loaded — pick a canonical game manually below.");
      return;
    }
    setOrphan({
      id: c.orphan_id,
      name: c.orphan_name,
      igdb_id: null,
      metadata_source: null,
      cover_url: null,
    });
    setCanonical({
      id: c.canonical_id,
      name: c.canonical_name,
      igdb_id: null,
      metadata_source: null,
      cover_url: null,
    });
  };

  const handleShowPreview = async () => {
    if (!orphan || !canonical) return;
    setPlanLoading(true);
    const result = await getConsolidationPlan(orphan.id, canonical.id);
    setPlanLoading(false);
    if (result.error || !result.plan) {
      toast.error(result.error ?? "Failed to load consolidate plan");
      return;
    }
    setPlan(result.plan);
    setStep("preview");
  };

  const handleApply = () => {
    if (!orphan || !canonical) return;
    startApply(async () => {
      const result = await consolidateGames(orphan.id, canonical.id);
      if (!result.success) {
        if (result.error === "consolidate_blocked") {
          toast.error(
            `Blocked: ${result.blockReasons?.join(", ") ?? "ignored flag set"}. Un-ignore both rows first.`,
          );
        } else {
          toast.error(result.error ?? "Consolidate failed");
        }
        return;
      }
      const cacheNote = result.cacheInvalidated
        ? "Resolver cache invalidated."
        : "Resolver cache NOT invalidated — restart backend or wait 1h.";
      toast.success(
        `Consolidated. ${result.sessionsDeleted ?? 0} duplicate sessions deleted, ${result.sessionsRepointed ?? 0} repointed, ${result.movedApplicationIds?.length ?? 0} Discord ids moved. ${cacheNote}`,
      );
      setOpen(false);
      resetAll();
      router.refresh();
    });
  };

  const blocked =
    plan && plan.block_reasons.length > 0;
  const sameRow = orphan && canonical && orphan.id === canonical.id;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetAll();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5" />
        }
      >
        <GitMerge className="h-4 w-4" />
        Consolidate Games
      </DialogTrigger>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {step === "pick" ? "Consolidate Games" : "Confirm consolidation"}
          </DialogTitle>
          {step === "pick" && (
            <p className="text-sm text-muted-foreground mt-1">
              Fold an orphan game row (e.g. an unfederated Discord companion bot or launcher) into its canonical row. Auto-suggestions below are based on overlapping play sessions or orphan-shaped metadata. You can also pick both manually.
            </p>
          )}
        </DialogHeader>

        {step === "pick" && (
          <div className="flex-1 overflow-y-auto space-y-5">
            {/* Auto-suggestions */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Auto-suggested
                </h3>
                <span className="text-xs text-muted-foreground">
                  {candidatesLoading
                    ? "loading…"
                    : `${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`}
                </span>
              </div>
              {candidatesLoading ? (
                <div className="rounded-lg border border-border/40 p-6 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/40 p-4 text-xs text-muted-foreground text-center">
                  No suggestions. Pick orphan + canonical manually below.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {candidates.slice(0, 10).map((c) => (
                    <li
                      key={`${c.orphan_id}:${c.canonical_id ?? "none"}`}
                      className="rounded-lg border border-border/40 p-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handlePickCandidate(c)}
                        className="w-full flex items-center gap-2 text-left text-sm"
                      >
                        <Badge
                          variant="secondary"
                          className={
                            c.reason === "time_overlap"
                              ? "text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }
                        >
                          {c.reason === "time_overlap" ? "overlap" : "orphan"}
                        </Badge>
                        <span className="font-medium truncate flex-1">
                          {c.orphan_name}
                        </span>
                        {c.canonical_id && c.canonical_name ? (
                          <>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate flex-1 text-muted-foreground">
                              {c.canonical_name}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            pick canonical
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator className="bg-border/50" />

            {/* Manual pickers */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Manual pick</h3>
              <GamePicker
                label="Orphan (will be deleted)"
                picked={orphan}
                onPick={setOrphan}
                accent="rose"
              />
              <GamePicker
                label="Canonical (will survive)"
                picked={canonical}
                onPick={setCanonical}
                accent="emerald"
              />
            </section>

            {sameRow && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Orphan and canonical must be different rows.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40 sticky bottom-0 bg-background pb-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleShowPreview}
                disabled={!orphan || !canonical || !!sameRow || planLoading}
              >
                {planLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Preview
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && plan && orphan && canonical && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Header summary */}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-sm flex items-center gap-2">
              <span className="font-medium truncate">{orphan.name}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{canonical.name}</span>
            </div>

            {/* Block reasons */}
            {plan.block_reasons.length > 0 && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
                <div className="font-medium text-rose-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Consolidate blocked
                </div>
                <ul className="text-muted-foreground space-y-0.5 list-disc pl-4">
                  {plan.block_reasons.includes("orphan_ignored") && (
                    <li>Orphan has <code>ignored = true</code>. Un-ignore via the row's edit panel first.</li>
                  )}
                  {plan.block_reasons.includes("canonical_ignored") && (
                    <li>Canonical has <code>ignored = true</code>. Un-ignore first.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Counts */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Counter
                label="Sessions to delete"
                value={plan.sessions_overlapping}
                hint="overlap with canonical sessions = duplicates of the same physical play"
                tone="rose"
              />
              <Counter
                label="Sessions to repoint"
                value={plan.sessions_distinct}
                hint="orphan sessions with no canonical overlap = distinct play time"
                tone="emerald"
              />
              <Counter
                label="Library entries to delete"
                value={plan.library_overlapping}
                hint="canonical already has an entry for the same user"
                tone="rose"
              />
              <Counter
                label="Library entries to repoint"
                value={plan.library_distinct}
                hint="orphan-only library entries"
                tone="emerald"
              />
            </div>

            {/* App ids */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3 text-xs">
              <div className="font-medium mb-1.5">
                Discord application IDs to repoint
                {" "}
                <span className="text-muted-foreground">({plan.application_ids.length})</span>
              </div>
              {plan.application_ids.length === 0 ? (
                <span className="text-muted-foreground italic">None — orphan has no junction rows.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {plan.application_ids.map((id) => (
                    <code key={id} className="text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">
                      {id}
                    </code>
                  ))}
                </div>
              )}
            </div>

            {/* Orphan deletion warning */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-amber-400">Orphan row will be deleted</div>
                <div className="text-muted-foreground">
                  After repointing FKs, <code>{orphan.name}</code> ({orphan.id.slice(0, 8)}…) is removed permanently. Action is logged in <code>game_consolidation_log</code>.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 sticky bottom-0 bg-background pb-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("pick")}
                disabled={isApplying}
                className="gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={isApplying || !!blocked}
              >
                {isApplying && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Confirm consolidate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Counter({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "rose" | "emerald";
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-400"
      : "text-emerald-400";
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-0.5">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground/70">{hint}</div>
    </div>
  );
}

function GamePicker({
  label,
  picked,
  onPick,
  accent,
}: {
  label: string;
  picked: PickedGame | null;
  onPick: (g: PickedGame | null) => void;
  accent: "rose" | "emerald";
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedGame[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const accentClass =
    accent === "rose"
      ? "border-rose-500/30 bg-rose-500/5"
      : "border-emerald-500/30 bg-emerald-500/5";

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { results: data } = await searchGamesForConsolidation(q);
    setResults(data);
    setSearching(false);
    setShowResults(true);
  }, []);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => handleSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, handleSearch]);

  if (picked) {
    return (
      <div className={`rounded-lg border ${accentClass} p-2.5 flex items-center gap-2 text-sm`}>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="font-medium truncate">{picked.name}</div>
          <code className="text-[11px] text-muted-foreground">{picked.id}</code>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onPick(null);
            setQuery("");
            setResults([]);
          }}
        >
          Clear
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games by name…"
          className="pl-8 text-sm"
          onFocus={() => setShowResults(true)}
        />
        {showResults && query.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border/50 bg-popover shadow-lg z-10 max-h-56 overflow-y-auto">
            {searching ? (
              <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No matches.</div>
            ) : (
              <ul>
                {results.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(g);
                        setShowResults(false);
                        setQuery("");
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/40 flex items-center gap-2"
                    >
                      <span className="flex-1 truncate">{g.name}</span>
                      {g.igdb_id != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          igdb {g.igdb_id}
                        </Badge>
                      )}
                      {g.metadata_source === "discord" && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20"
                        >
                          orphan
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
