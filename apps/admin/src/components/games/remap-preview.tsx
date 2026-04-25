"use client";

import { Loader2, AlertTriangle, RefreshCw, ArrowRightLeft, GitMerge, Gamepad2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type {
  IgdbMetadata,
  RemapMode,
  RemapPlan,
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
    title: "Merge required",
    tagline: "The target row has user data attached. Merge mode is shipping in PR 2 (#154 follow-up). This remap is blocked for now.",
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
  const sourceDiscordAppId = pickStr(source, "discord_application_id");
  const sourceAdminRemappedAt = pickStr(source, "admin_remapped_at");
  const sourceGenres = pickArr(source, "genres");
  const sourceDeveloper = pickStr(source, "developer");
  const sourcePublisher = pickStr(source, "publisher");

  const targetName = pickStr(target, "name");
  const targetCover = pickStr(target, "cover_url");
  const targetIgdbId = pickNum(target, "igdb_id");

  const isMergeBlocked = mode === "merge_required";
  const showIdentityDiff = mode !== "refresh";
  const willDeleteTarget = mode === "clean_retarget_empty_target";

  return (
    <div className="space-y-4">
      {/* Mode banner */}
      <div className={`flex items-start gap-3 rounded-lg border p-3 ${
        isMergeBlocked
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-indigo-500/30 bg-indigo-500/5"
      }`}>
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${isMergeBlocked ? "text-amber-400" : "text-indigo-400"}`} />
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
          Preserved on source
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discord application id</span>
            <code className="text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">
              {sourceDiscordAppId ?? "null"}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ignored flag</span>
            <span>{String(source["ignored"] ?? false)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Source row id</span>
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground w-16">Source:</span>
            <FkBadge count={fk_counts.source.sessions} label="sessions" />
            <FkBadge count={fk_counts.source.user_games} label="user_games" />
            <FkBadge count={fk_counts.source.library} label="library" />
            <span className="text-muted-foreground">— stay attached</span>
          </div>
          {fk_counts.target && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground w-16">Target:</span>
              <FkBadge count={fk_counts.target.sessions} label="sessions" />
              <FkBadge count={fk_counts.target.user_games} label="user_games" />
              <FkBadge count={fk_counts.target.library} label="library" />
              {isMergeBlocked && (
                <span className="text-amber-400">— merge required to reassign</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Empty target deletion warning */}
      {willDeleteTarget && target && (
        <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">Target row will be deleted</div>
            <div className="text-muted-foreground">
              Empty row "{targetName}" (igdb_id {targetIgdbId}) has zero FK references and will be removed.
              {pickStr(target, "discord_application_id") && (
                <>
                  {" "}Its <code className="bg-muted/40 px-1 rounded">discord_application_id</code> (
                  <code className="bg-muted/40 px-1 rounded">{pickStr(target, "discord_application_id")}</code>) will be lost — source's is preserved.
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merge-required block message */}
      {isMergeBlocked && target && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">Cannot apply from this UI yet</div>
            <div className="text-muted-foreground">
              Target row "{targetName}" (igdb_id {targetIgdbId}) has user data attached. Reassigning sessions, aggregating user_games, and merging library entries needs the <code className="bg-muted/40 px-1 rounded">admin_merge_games</code> RPC, which is shipping in PR 2 of #154.
            </div>
          </div>
        </div>
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
          ) : (
            "Confirm and apply"
          )}
        </Button>
      </div>
    </div>
  );
}
