"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Gamepad2,
  Users,
  Clock,
  BarChart3,
  Save,
  Loader2,
  Trophy,
  History,
  RefreshCw,
  Sparkles,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDuration, formatDate } from "@/lib/format";
import { updateGame, syncFromIgdb } from "@/app/(admin)/games/actions";
import { clearCuration } from "@/app/(admin)/games/steamgriddb-actions";
import { toast } from "sonner";
import { RemapDialog } from "@/components/games/remap-dialog";
import { DeleteDialog } from "@/components/games/delete-dialog";
import { SteamGridDbCurationDialog } from "@/components/games/steamgriddb-curation-dialog";
import { SlotEditDialog } from "@/components/games/slot-edit-dialog";
import type { Game } from "@/lib/types";

type AssetSlot = "grid" | "icon" | "hero" | "logo";

function SyncButton({ gameId, igdbId }: { gameId: string; igdbId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      const result = await syncFromIgdb(gameId, igdbId);
      if (result.success) {
        toast.success("Game synced with latest IGDB data");
        router.refresh();
      } else {
        toast.error(result.error ?? "Sync failed");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isPending}
      className="gap-1.5 border-border/50 hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400 transition-all"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      Sync from IGDB
    </Button>
  );
}

// --- Types ---

interface GameStats {
  session_count: number;
  player_count: number;
  avg_duration: number;
}

interface RecentSession {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  started_at: string;
  ended_at: string | null;
  duration_secs: number;
  source: "agent" | "discord";
}

interface TopPlayer {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_time_secs: number;
  total_sessions: number;
}

interface GameDetailProps {
  game: Game;
  stats: GameStats;
  recentSessions: RecentSession[];
  topPlayers: TopPlayer[];
}

// --- Helpers ---

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// --- Component ---

export function GameDetail({
  game,
  stats,
  recentSessions,
  topPlayers,
}: GameDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState(game.name);
  const [developer, setDeveloper] = useState(game.developer ?? "");
  const [publisher, setPublisher] = useState(game.publisher ?? "");
  const [genres, setGenres] = useState((game.genres ?? []).join(", "));
  const [coverUrl, setCoverUrl] = useState(game.cover_url ?? "");
  const [ignored, setIgnored] = useState(game.ignored);

  async function handleSave() {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("developer", developer);
    formData.set("publisher", publisher);
    formData.set("genres", genres);
    formData.set("cover_url", coverUrl);
    formData.set("ignored", String(ignored));

    startTransition(async () => {
      const result = await updateGame(game.id, formData);
      if (result.success) {
        toast.success("Game updated successfully");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update game");
      }
    });
  }

  const statCards = [
    {
      icon: BarChart3,
      label: "Sessions",
      value: stats.session_count.toLocaleString(),
    },
    {
      icon: Users,
      label: "Players",
      value: stats.player_count.toLocaleString(),
    },
    {
      icon: Clock,
      label: "Avg Duration",
      value: formatDuration(stats.avg_duration),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/games"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Games
      </Link>

      {/* Game header */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Cover */}
            <div className="h-32 w-24 rounded-lg bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
              {game.cover_url ? (
                <img
                  src={game.cover_url}
                  alt={game.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Gamepad2 className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">
                  {game.name}
                </h1>
                {game.ignored && (
                  <Badge
                    variant="secondary"
                    className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  >
                    Ignored
                  </Badge>
                )}
                {game.igdb_id && (
                  <SyncButton gameId={game.id} igdbId={game.igdb_id} />
                )}
                <RemapDialog
                  gameId={game.id}
                  currentName={game.name}
                  currentCoverUrl={game.cover_url}
                  currentIgdbId={game.igdb_id}
                />
                <DeleteDialog gameId={game.id} gameName={game.name} />
              </div>
              {(game.developer || game.publisher) && (
                <p className="text-sm text-muted-foreground">
                  {game.developer && <span>{game.developer}</span>}
                  {game.developer && game.publisher && <span> / </span>}
                  {game.publisher && <span>{game.publisher}</span>}
                </p>
              )}
              {game.igdb_url && (
                <a
                  href={game.igdb_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View on IGDB
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
              {game.genres && game.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {game.genres.map((genre) => (
                    <Badge
                      key={genre}
                      variant="secondary"
                      className="bg-muted text-muted-foreground"
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <card.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </span>
              </div>
              <p className="text-2xl font-bold tracking-tight mt-3">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit form */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">
            Edit Game Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Game name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="developer">Developer</Label>
              <Input
                id="developer"
                value={developer}
                onChange={(e) => setDeveloper(e.target.value)}
                placeholder="Developer studio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input
                id="publisher"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="Publisher"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="genres">Genres</Label>
              <Input
                id="genres"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                placeholder="RPG, Action, Adventure"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover_url">Cover URL</Label>
              <Input
                id="cover_url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ignored}
                onChange={(e) => setIgnored(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-muted accent-indigo-500"
              />
              <span className="text-sm text-muted-foreground">
                Ignore this game (hidden from public views)
              </span>
            </label>
          </div>

          <Separator className="bg-border/50" />

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Asset Enrichment */}
      <EnrichmentSection game={game} />

      {/* Recent Sessions + Top Players side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">
                Recent Sessions
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">
                No sessions recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="pr-6">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSessions.map((session) => (
                    <TableRow
                      key={session.id}
                      className="border-border/30 hover:bg-muted/20"
                    >
                      <TableCell className="pl-6">
                        <Link
                          href={`/users/${session.user_id}`}
                          className="flex items-center gap-2 group"
                        >
                          <Avatar className="h-6 w-6">
                            {session.avatar_url && (
                              <AvatarImage
                                src={session.avatar_url}
                                alt={session.username}
                              />
                            )}
                            <AvatarFallback className="text-[9px] bg-muted">
                              {getInitials(session.username)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm group-hover:text-indigo-400 transition-colors truncate">
                            {session.username}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(session.started_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm tabular-nums">
                          {formatDuration(session.duration_secs)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6">
                        <Badge
                          variant="secondary"
                          className={
                            session.source === "discord"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }
                        >
                          {session.source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Players */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">
                Top Players
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {topPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">
                No players yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="pl-6">Player</TableHead>
                    <TableHead className="text-right">Total Time</TableHead>
                    <TableHead className="pr-6 text-right">Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPlayers.map((player, i) => (
                    <TableRow
                      key={player.user_id}
                      className="border-border/30 hover:bg-muted/20"
                    >
                      <TableCell className="pl-6">
                        <Link
                          href={`/users/${player.user_id}`}
                          className="flex items-center gap-2.5 group"
                        >
                          <span className="text-xs font-medium text-muted-foreground w-4 text-right tabular-nums">
                            {i + 1}
                          </span>
                          <Avatar className="h-7 w-7">
                            {player.avatar_url && (
                              <AvatarImage
                                src={player.avatar_url}
                                alt={player.username}
                              />
                            )}
                            <AvatarFallback className="text-[10px] bg-muted">
                              {getInitials(player.username)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium group-hover:text-indigo-400 transition-colors truncate">
                            {player.username}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium tabular-nums">
                          {formatDuration(player.total_time_secs)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {player.total_sessions.toLocaleString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset Enrichment section
// ---------------------------------------------------------------------------

function EnrichmentSection({ game }: { game: Game }) {
  const router = useRouter();
  const [isClearing, startClear] = useTransition();

  const enriched = game.assets_enriched;
  // Logos are transparent PNGs at varying aspect ratios — give them a wide
  // container and object-contain so they're never cropped. Other slots fill.
  const slots: Array<{
    key: AssetSlot;
    label: string;
    url: string | null;
    aspect: string;
    objectFit: string;
  }> = [
    { key: "grid", label: "Grid", url: game.steamgriddb_grid_url, aspect: "aspect-[3/4]", objectFit: "object-cover" },
    { key: "icon", label: "Icon", url: game.steamgriddb_icon_url, aspect: "aspect-square", objectFit: "object-cover" },
    { key: "hero", label: "Hero", url: game.steamgriddb_hero_url, aspect: "aspect-[3/1]", objectFit: "object-cover" },
    { key: "logo", label: "Logo", url: game.steamgriddb_logo_url, aspect: "aspect-[2/1]", objectFit: "object-contain" },
  ];

  const handleReset = () => {
    if (!confirm("Clear all curated assets for this game? This deletes them from ImageKit.")) return;
    startClear(async () => {
      const res = await clearCuration(game.id);
      if (res.success) {
        toast.success("Enrichment cleared");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to clear enrichment");
      }
    });
  };

  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-border/50 hover:border-amber-500/30 hover:bg-amber-500/5 hover:text-amber-400 transition-all"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {enriched ? "Re-enrich" : "Enrich Assets"}
    </Button>
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-base font-semibold">Asset Enrichment</CardTitle>
            {enriched ? (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/20"
              >
                Enriched
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground"
              >
                Not enriched
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SteamGridDbCurationDialog
              gameId={game.id}
              gameName={game.name}
              steamAppId={game.steam_app_id}
              existingSteamGridDbId={game.steamgriddb_game_id}
              trigger={triggerButton}
            />
            {enriched && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isClearing}
                className="text-muted-foreground hover:text-destructive"
              >
                {isClearing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Reset</span>
              </Button>
            )}
          </div>
        </div>
        {enriched && game.curated_at && (
          <p className="text-xs text-muted-foreground mt-1">
            Curated {formatDate(game.curated_at)}
            {game.steamgriddb_game_id && (
              <> · SteamGridDB #{game.steamgriddb_game_id}</>
            )}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {slots.map(({ key, label, url, aspect, objectFit }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <div
                className={`group relative rounded-md bg-black/30 overflow-hidden flex items-center justify-center ${aspect}`}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`${label} asset`}
                    className={`h-full w-full ${objectFit}`}
                  />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                )}
                <SlotEditDialog
                  gameId={game.id}
                  gameName={game.name}
                  steamAppId={game.steam_app_id}
                  existingSteamGridDbId={game.steamgriddb_game_id}
                  slot={key}
                  currentUrl={url}
                  trigger={
                    <button
                      type="button"
                      aria-label={`Edit ${label}`}
                      title={url ? `Edit ${label}` : `Add ${label}`}
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-white/90 hover:text-amber-400 hover:border-amber-400/50 hover:bg-black/90 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
