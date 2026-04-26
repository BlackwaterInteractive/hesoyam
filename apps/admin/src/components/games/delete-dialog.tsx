"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Trash2,
  AlertTriangle,
  Radio,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  getDeletePlan,
  deleteGame,
  type DeletePerUserEntry,
  type DeletePlan,
} from "@/app/(admin)/games/actions";

interface DeleteDialogProps {
  gameId: string;
  gameName: string;
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
}

export function DeleteDialog({ gameId, gameName }: DeleteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isApplying, startApply] = useTransition();
  const [plan, setPlan] = useState<DeletePlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showPerUser, setShowPerUser] = useState(false);

  const isBlocked = (plan?.block_reasons.length ?? 0) > 0;

  const loadPlan = async () => {
    setIsLoadingPlan(true);
    setPlanError(null);
    setPlan(null);
    setShowPerUser(false);
    const result = await getDeletePlan(gameId);
    setIsLoadingPlan(false);
    if (result.error) {
      setPlanError(result.error);
    } else if (result.plan) {
      setPlan(result.plan);
    }
  };

  const handleConfirm = () => {
    if (!plan || isBlocked) return;

    startApply(async () => {
      const result = await deleteGame(gameId);
      if (result.success) {
        toast.success(
          `Deleted "${gameName}" (${result.sessionsDeleted ?? 0} sessions, ${
            result.userGamesDeleted ?? 0
          } user_games, ${result.libraryDeleted ?? 0} library)`,
        );
        setOpen(false);
        // Game's detail page is gone — redirect to the games list.
        router.push("/games");
        router.refresh();
        return;
      }

      if (result.error === "delete_blocked") {
        toast.warning(
          `Delete blocked: ${result.blockReasons?.join(", ") ?? "live sessions"}. Reloading preview.`,
        );
        await loadPlan();
        return;
      }

      toast.error(result.error ?? "Delete failed");
    });
  };

  const fk = plan?.fk_counts;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) loadPlan();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 text-rose-400/80 transition-all"
          />
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-400" />
            Delete game
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently remove{" "}
            <span className="font-medium text-foreground">"{gameName}"</span>{" "}
            and every session, library entry, and user_games stat that points
            at it. This cannot be undone.
          </p>
        </DialogHeader>

        {isLoadingPlan && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading impact preview…
          </div>
        )}

        {planError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Couldn't load preview</div>
              <div className="text-muted-foreground">{planError}</div>
            </div>
          </div>
        )}

        {plan && fk && (
          <div className="space-y-4 flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
            {/* Block reasons (red banner) */}
            {isBlocked && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium">Delete blocked</div>
                  <ul className="text-muted-foreground space-y-0.5 list-disc pl-4">
                    {plan.block_reasons.includes("live_sessions") && (
                      <li>
                        {fk.live_sessions} live session
                        {fk.live_sessions === 1 ? "" : "s"} in flight on this
                        row. Wait for them to end (or end them manually) before
                        deleting.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* What will be deleted */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                What will be deleted
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sessions</span>
                  <Badge
                    variant="secondary"
                    className={`text-[11px] ${
                      fk.sessions > 0
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {fk.sessions}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">user_games rows</span>
                  <Badge
                    variant="secondary"
                    className={`text-[11px] ${
                      fk.user_games > 0
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {fk.user_games}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Library entries</span>
                  <Badge
                    variant="secondary"
                    className={`text-[11px] ${
                      fk.library > 0
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {fk.library}
                  </Badge>
                </div>
                <Separator className="bg-border/30" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Distinct users affected
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      fk.users_affected > 0 ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {fk.users_affected}
                  </span>
                </div>
                {fk.live_sessions > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-rose-400 flex items-center gap-1">
                      <Radio className="h-3 w-3" />
                      Live sessions in flight
                    </span>
                    <span className="tabular-nums font-medium text-rose-400">
                      {fk.live_sessions}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Per-user breakdown */}
            {plan.per_user.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowPerUser((s) => !s)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showPerUser ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {showPerUser ? "Hide" : "Show"} per-user breakdown ({plan.per_user.length} user
                  {plan.per_user.length === 1 ? "" : "s"})
                </button>
                {showPerUser && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {plan.per_user.map((u) => (
                      <PerUserRow key={u.user_id} entry={u} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Separator className="bg-border/50" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isApplying || isLoadingPlan || !plan || isBlocked}
            className="bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Confirm and delete
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PerUserRow({ entry }: { entry: DeletePerUserEntry }) {
  return (
    <div className="rounded border border-border/30 bg-muted/20 p-2 grid grid-cols-[1fr_auto] gap-2 text-[10px]">
      <code className="text-muted-foreground truncate">{entry.user_id}</code>
      <div className="text-foreground tabular-nums whitespace-nowrap">
        {entry.sessions > 0 && (
          <>
            {entry.sessions} session{entry.sessions === 1 ? "" : "s"}
            {entry.total_time_secs > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {formatDuration(entry.total_time_secs)}
              </span>
            )}
          </>
        )}
        {entry.has_user_games && (
          <span className="text-muted-foreground"> · stats</span>
        )}
        {entry.has_library && (
          <span className="text-muted-foreground"> · in library</span>
        )}
      </div>
    </div>
  );
}
