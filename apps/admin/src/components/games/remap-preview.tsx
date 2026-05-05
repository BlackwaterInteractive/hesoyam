"use client";

import { useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, ArrowRightLeft, GitMerge, Gamepad2, ShieldCheck, ChevronDown, ChevronRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type {
  IgdbMetadata,
  LibraryOverlapEntry,
  RemapMode,
  RemapPlan,
  UserGamesOverlapEntry,
} from "@/app/(admin)/games/actions";

interface RemapPreviewProps {
  plan: RemapPlan;
  igdbMetadata: IgdbMetadata;
  isApplying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const MODE_LABELS: Record<RemapMode, { title: string; tagline: string; icon: typeof RefreshCw }> = {
  refresh: {
    title: "Refresh metadata",
    tagline: "Source already has this IGDB id. Metadata will be re-pulled. No FK data moves.",
    icon: RefreshCw,
  },
  clean_retarget_no_target: {
    title: "Clean retarget (no target row)",
    tagline: "No row exists for this IGDB id. Source row's identity will be corrected in place. No FK data moves.",
    icon: ArrowRightLeft,
  },
  clean_retarget_empty_target: {
    title: "Clean retarget (empty target)",
    tagline: "An empty row exists for this IGDB id with zero FK references. It will be deleted and source retargeted.",
    icon: ArrowRightLeft,
  },
  merge_required: {
    title: "Merge retarget",
    tagline: "Two rows for the same logical game will be collapsed into one. Source's id survives; target's IGDB identity is copied onto source; target row is deleted. FK references on target are reassigned atomically.",
    icon: GitMerge,
  },
};

function pickStr(row: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!row) return null;
  const v = row[key];
  return typeof v === "string" ? v : null;
}

function pickArr(row: Record<string, unknown> | null | undefined, key: string): string[] {
  if (!row) return [];
  const v = row[key];
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
}

function pickNum(row: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!row) return null;
  const v = row[key];
  return typeof v === "number" ? v : null;
}

function MetadataDiffRow({
  label,
  before,
  after,
}: {
  label: string;
  before: React.ReactNode;
  after: React.ReactNode;
}) {
  const beforeStr = before == null || before === "" ? "—" : before;
  const afterStr = after == null || after === "" ? "—" : after;
  const changed = JSON.stringify(beforeStr) !== JSON.stringify(afterStr);

  return (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-3 py-1.5 text-xs">
      <div className="text-muted-foreground font-medium">{label}</div>
      <div className={`truncate ${changed ? "text-muted-foreground line-through" : ""}`}>{beforeStr}</div>
      <div className={`truncate ${changed ? "text-emerald-400" : ""}`}>{afterStr}</div>
    </div>
  );
}

function FkBadge({ count, label }: { count: number; label: string }) {
  const tone = count > 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${tone}`}>
      {count} {label}
    </Badge>
  );
}

export function RemapPreview({ plan, igdbMetadata, isApplying, onConfirm, onCancel }: RemapPreviewProps) {
  const { mode, source, target, fk_counts } = plan;
  const cfg = MODE_LABELS[mode];
  const Icon = cfg.icon;

  const sourceName = pickStr(source, "name");
  const sourceCover = pickStr(source, "cover_url");
  const sourceIgdbId = pickNum(source, "igdb_id");
  const sourceSlug = pickStr(source, "slug");
  const sourceAdminRemappedAt = pickStr(source, "admin_remapped_at");
  const sourceGenres = pickArr(source, "genres");
  const sourceDeveloper = pickStr(source, "developer");
  const sourcePublisher = pickStr(source, "publisher");

  const targetName = pickStr(target, "name");
  const targetCover = pickStr(target, "cover_url");
  const targetIgdbId = pickNum(target, "igdb_id");

  const mergeDetails = plan.merge_details;
  const isMerge = mode === "merge_required";
  const isMergeBlocked = isMerge && (mergeDetails?.block_reasons.length ?? 0) > 0;
  const showIdentityDiff = mode !== "refresh";
  const willDeleteTarget = mode === "clean_retarget_empty_target" || isMerge;

  // Display labels: prefer the actual game name, fall back to the role.
  const sourceLabel = sourceName ? `${sourceName} (source)` : "source";
  const targetLabel = targetName ? `${targetName} (target)` : "target";

  return (
    <div className="space-y-4">
      {/* Mode banner */}
      <div className={`flex items-start gap-3 rounded-lg border p-3 ${
        isMergeBlocked
          ? "border-rose-500/30 bg-rose-500/5"
          : isMerge
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-indigo-500/30 bg-indigo-500/5"
      }`}>
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${
          isMergeBlocked ? "text-rose-400" : isMerge ? "text-amber-400" : "text-indigo-400"
        }`} />
        <div className="min-w-0">
          <div className="text-sm font-semibold">{cfg.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{cfg.tagline}</div>
        </div>
      </div>

      {/* Provenance: was this source already admin-remapped before? */}
      {sourceAdminRemappedAt && (
        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-muted-foreground">
            This row was previously admin-corrected on{" "}
            <span className="text-foreground font-medium">
              {new Date(sourceAdminRemappedAt).toLocaleString()}
            </span>
            .
          </span>
        </div>
      )}

      {/* Identity diff: only show for retargets, not for refresh */}
      {showIdentityDiff && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Identity change
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1">
            <div className="grid grid-cols-[120px_1fr_1fr] gap-3 pb-2 border-b border-border/30">
              <div />
              <div className="text-xs font-medium text-muted-foreground">Before</div>
              <div className="text-xs font-medium text-emerald-400">After</div>
            </div>
            <MetadataDiffRow label="Name" before={sourceName} after={igdbMetadata.name} />
            <MetadataDiffRow label="IGDB id" before={sourceIgdbId} after={igdbMetadata.igdb_id} />
            <MetadataDiffRow label="Slug" before={sourceSlug} after={igdbMetadata.slug} />
            <MetadataDiffRow label="Developer" before={sourceDeveloper} after={igdbMetadata.developer} />
            <MetadataDiffRow label="Publisher" before={sourcePublisher} after={igdbMetadata.publisher} />
            <MetadataDiffRow
              label="Release year"
              before={pickNum(source, "release_year")}
              after={igdbMetadata.release_year}
            />
            <MetadataDiffRow label="Genres" before={sourceGenres.join(", ")} after={igdbMetadata.genres.join(", ")} />

            {/* Cover thumbnails side-by-side */}
            <div className="grid grid-cols-[120px_1fr_1fr] gap-3 pt-2 text-xs">
              <div className="text-muted-foreground font-medium pt-1">Cover</div>
              <div className="h-20 w-15 rounded bg-muted/40 overflow-hidden flex items-center justify-center">
                {sourceCover ? (
                  <img src={sourceCover} alt={sourceName ?? ""} className="h-full w-full object-cover" />
                ) : (
                  <Gamepad2 className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="h-20 w-15 rounded bg-muted/40 overflow-hidden flex items-center justify-center">
                {igdbMetadata.cover_url ? (
                  <img src={igdbMetadata.cover_url} alt={igdbMetadata.name} className="h-full w-full object-cover" />
                ) : (
                  <Gamepad2 className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh-mode metadata diff: same row, just refresh */}
      {mode === "refresh" && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Metadata refresh
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1">
            <div className="grid grid-cols-[120px_1fr_1fr] gap-3 pb-2 border-b border-border/30">
              <div />
              <div className="text-xs font-medium text-muted-foreground">Current</div>
              <div className="text-xs font-medium text-emerald-400">Fresh from IGDB</div>
            </div>
            <MetadataDiffRow label="Name" before={sourceName} after={igdbMetadata.name} />
            <MetadataDiffRow label="Developer" before={sourceDeveloper} after={igdbMetadata.developer} />
            <MetadataDiffRow label="Publisher" before={sourcePublisher} after={igdbMetadata.publisher} />
            <MetadataDiffRow
              label="Release year"
              before={pickNum(source, "release_year")}
              after={igdbMetadata.release_year}
            />
            <MetadataDiffRow label="Genres" before={sourceGenres.join(", ")} after={igdbMetadata.genres.join(", ")} />
          </div>
        </div>
      )}

      {/* Preserved fields */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Preserved on {sourceLabel}
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ignored flag</span>
            <span>{String(source["ignored"] ?? false)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Row id</span>
            <code className="text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">
              {String(source["id"])}
            </code>
          </div>
        </div>
      </div>

      {/* FK attachments */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          FK attachments
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2 text-xs">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-muted-foreground shrink-0 max-w-[40%] truncate" title={sourceLabel}>
              {sourceLabel}:
            </span>
            <FkBadge count={fk_counts.source.sessions} label="sessions" />
            <FkBadge count={fk_counts.source.user_games} label="user_games" />
            <FkBadge count={fk_counts.source.library} label="library" />
            <span className="text-muted-foreground">— stay attached</span>
          </div>
          {fk_counts.target && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-muted-foreground shrink-0 max-w-[40%] truncate" title={targetLabel}>
                {targetLabel}:
              </span>
              <FkBadge count={fk_counts.target.sessions} label="sessions" />
              <FkBadge count={fk_counts.target.user_games} label="user_games" />
              <FkBadge count={fk_counts.target.library} label="library" />
              {isMerge && (
                <span className="text-amber-400">— reassign to {sourceLabel} on merge</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Empty target deletion warning (T2 only — for merge T3, the deletion message is in the merge sections) */}
      {willDeleteTarget && !isMerge && target && (
        <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">{targetLabel} will be deleted</div>
            <div className="text-muted-foreground">
              Empty row (igdb_id {targetIgdbId}) has zero FK references and will be removed.
            </div>
          </div>
        </div>
      )}

      {/* Mode 3 — Merge details */}
      {isMerge && mergeDetails && target && (
        <MergeSections
          mergeDetails={mergeDetails}
          sourceLabel={sourceLabel}
          targetLabel={targetLabel}
          targetIgdbId={targetIgdbId}
          fkCountsTarget={fk_counts.target}
        />
      )}

      <Separator className="bg-border/50" />

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isApplying}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isApplying || isMergeBlocked}
          className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
        >
          {isApplying ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Applying…</>
          ) : isMerge ? (
            "Confirm and merge"
          ) : (
            "Confirm and apply"
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 3 — merge-specific UI sections
// ---------------------------------------------------------------------------

interface MergeSectionsProps {
  mergeDetails: NonNullable<RemapPlan["merge_details"]>;
  sourceLabel: string;
  targetLabel: string;
  targetIgdbId: number | null;
  fkCountsTarget: { sessions: number; user_games: number; library: number } | null;
}

function MergeSections({
  mergeDetails,
  sourceLabel,
  targetLabel,
  targetIgdbId,
  fkCountsTarget,
}: MergeSectionsProps) {
  const [showUserGames, setShowUserGames] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const { block_reasons, user_games_overlap, library_overlap, live_sessions_count, warnings } = mergeDetails;

  const targetSessions = fkCountsTarget?.sessions ?? 0;
  const targetUserGames = fkCountsTarget?.user_games ?? 0;
  const targetLibrary = fkCountsTarget?.library ?? 0;

  return (
    <div className="space-y-3">
      {/* Block reasons (red banner) */}
      {block_reasons.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">Merge blocked</div>
            <ul className="text-muted-foreground space-y-0.5 list-disc pl-4">
              {block_reasons.includes("source_ignored") && (
                <li>{sourceLabel} has <code className="bg-muted/40 px-1 rounded">ignored = true</code>. Un-ignore it via the row's edit panel before merging.</li>
              )}
              {block_reasons.includes("target_ignored") && (
                <li>{targetLabel} has <code className="bg-muted/40 px-1 rounded">ignored = true</code>. Un-ignore it before merging.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Warnings (amber, non-blocking) */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">Warnings</div>
            <ul className="text-muted-foreground space-y-0.5 list-disc pl-4">
              {warnings.map((w, i) =>
                w.type === "curated_library_drop" ? (
                  <li key={i}>
                    {w.user_count} user{w.user_count === 1 ? "" : "s"} have curated library data on {sourceLabel} (non-default status or rating) that will be dropped on merge.
                  </li>
                ) : (
                  <li key={i}>{w.type}</li>
                )
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Live sessions notice */}
      {live_sessions_count > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs">
          <Radio className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{live_sessions_count}</span> live session{live_sessions_count === 1 ? "" : "s"} in flight on either row. Sessions will reassign without interruption; clients listening on the old game_id miss updates until next heartbeat.
          </span>
        </div>
      )}

      {/* Sessions reassignment summary */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Sessions reassignment
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-xs text-muted-foreground">
          {targetSessions === 0 ? (
            <span>No sessions on {targetLabel}. Nothing to reassign.</span>
          ) : (
            <span>
              <span className="font-medium text-foreground">{targetSessions}</span> session{targetSessions === 1 ? "" : "s"} from {targetLabel} will be reassigned to {sourceLabel}.
            </span>
          )}
        </div>
      </div>

      {/* user_games aggregation */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          user_games aggregation
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-xs">
          {targetUserGames === 0 ? (
            <span className="text-muted-foreground">No user_games on {targetLabel}.</span>
          ) : (
            <>
              <div className="text-muted-foreground mb-2">
                <span className="font-medium text-foreground">{targetUserGames}</span> user_games row{targetUserGames === 1 ? "" : "s"} on {targetLabel} will move to {sourceLabel}.{" "}
                {user_games_overlap.length > 0 && (
                  <>
                    <span className="font-medium text-foreground">{user_games_overlap.length}</span> user{user_games_overlap.length === 1 ? "" : "s"} have rows on both sides — stats aggregated.
                  </>
                )}
              </div>
              {user_games_overlap.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowUserGames((s) => !s)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-1"
                  >
                    {showUserGames ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {showUserGames ? "Hide" : "Show"} per-user breakdown
                  </button>
                  {showUserGames && (
                    <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                      {user_games_overlap.map((row) => (
                        <UserGamesOverlapRow key={row.user_id} row={row} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* user_game_library merge */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          user_game_library merge
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-xs">
          {targetLibrary === 0 ? (
            <span className="text-muted-foreground">No library entries on {targetLabel}.</span>
          ) : (
            <>
              <div className="text-muted-foreground mb-2">
                <span className="font-medium text-foreground">{targetLibrary}</span> library entr{targetLibrary === 1 ? "y" : "ies"} on {targetLabel} will move to {sourceLabel}.{" "}
                {library_overlap.length > 0 && (
                  <>
                    <span className="font-medium text-foreground">{library_overlap.length}</span> user{library_overlap.length === 1 ? "" : "s"} have entries on both sides — {targetLabel} wins, {sourceLabel} entry dropped.
                  </>
                )}
              </div>
              {library_overlap.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowLibrary((s) => !s)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-1"
                  >
                    {showLibrary ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {showLibrary ? "Hide" : "Show"} per-user breakdown
                  </button>
                  {showLibrary && (
                    <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                      {library_overlap.map((row) => (
                        <LibraryOverlapRow key={row.user_id} row={row} sourceLabel={sourceLabel} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Target row deletion */}
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-medium">{targetLabel} will be deleted</div>
          <div className="text-muted-foreground">
            Row (igdb_id {targetIgdbId}) is removed after FKs reassign.
          </div>
        </div>
      </div>
    </div>
  );
}

function UserGamesOverlapRow({ row }: { row: UserGamesOverlapEntry }) {
  return (
    <div className="rounded border border-border/30 bg-muted/20 p-2 grid grid-cols-[1fr_auto] gap-2">
      <code className="text-[10px] text-muted-foreground truncate">{row.user_id}</code>
      <div className="text-[10px] text-foreground tabular-nums whitespace-nowrap">
        {row.source_total_time_secs}s + {row.target_total_time_secs}s ={" "}
        <span className="text-emerald-400 font-medium">{row.merged_total_time_secs}s</span>
        <span className="text-muted-foreground">
          {" "}· {row.source_total_sessions} + {row.target_total_sessions} ={" "}
          <span className="text-emerald-400">{row.merged_total_sessions}</span> sess
        </span>
      </div>
    </div>
  );
}

function LibraryOverlapRow({ row, sourceLabel }: { row: LibraryOverlapEntry; sourceLabel: string }) {
  return (
    <div className={`rounded border p-2 grid grid-cols-[1fr_auto] gap-2 ${
      row.curated ? "border-amber-500/30 bg-amber-500/5" : "border-border/30 bg-muted/20"
    }`}>
      <div className="min-w-0">
        <code className="text-[10px] text-muted-foreground truncate block">{row.user_id}</code>
        {row.curated && (
          <span className="text-[10px] text-amber-400">curated entry on {sourceLabel} will be dropped</span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground whitespace-nowrap">
        <span className="line-through">
          {row.source_status}{row.source_personal_rating != null ? ` · ★${row.source_personal_rating}` : ""}
        </span>
        {" → "}
        <span className="text-emerald-400">
          {row.target_status}{row.target_personal_rating != null ? ` · ★${row.target_personal_rating}` : ""}
        </span>
      </div>
    </div>
  );
}
