import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Gamepad2,
  Hash,
  Mail,
  Shield,
  Eye,
  Calendar,
  BarChart3,
  Trophy,
  History,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { formatDuration, formatDate, formatRelativeTime } from "@/lib/format";
import type { Profile } from "@/lib/types";

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

// --- UserProfileCard ---

interface UserProfileCardProps {
  profile: Profile;
}

export function UserProfileCard({ profile }: UserProfileCardProps) {
  const name = profile.display_name || profile.username || "Unknown";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <Avatar className="h-20 w-20 shrink-0">
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={name} />
              )}
              <AvatarFallback className="text-2xl bg-muted">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
                  <Badge
                    variant={profile.role === "admin" ? "default" : "secondary"}
                    className={
                      profile.role === "admin"
                        ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {profile.role}
                  </Badge>
                </div>
                {profile.username && profile.display_name && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    @{profile.username}
                  </p>
                )}
              </div>

              {profile.bio && (
                <p className="text-sm text-muted-foreground max-w-lg">
                  {profile.bio}
                </p>
              )}

              <Separator className="bg-border/50" />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-4 w-4 shrink-0" />
                  {profile.discord_id ? (
                    <span className="flex items-center gap-2">
                      <span className="truncate">{profile.discord_id}</span>
                      <Badge
                        variant="secondary"
                        className="bg-green-500/10 text-green-400 border-green-500/20"
                      >
                        Connected
                      </Badge>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>Discord</span>
                      <Badge
                        variant="secondary"
                        className="bg-muted text-muted-foreground"
                      >
                        Not connected
                      </Badge>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="h-4 w-4 shrink-0" />
                  <span>Privacy: </span>
                  <Badge
                    variant="outline"
                    className={
                      profile.privacy === "public"
                        ? "border-green-500/30 text-green-400"
                        : profile.privacy === "friends_only"
                          ? "border-yellow-500/30 text-yellow-400"
                          : "border-red-500/30 text-red-400"
                    }
                  >
                    {profile.privacy}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Joined {formatRelativeTime(profile.created_at)}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Updated {formatRelativeTime(profile.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- UserStatsCards ---

interface UserStats {
  totalPlaytime: number;
  totalSessions: number;
  gamesPlayed: number;
  avgSessionLength: number;
}

interface UserStatsCardsProps {
  stats: UserStats;
}

export function UserStatsCards({ stats }: UserStatsCardsProps) {
  const cards = [
    {
      icon: Clock,
      label: "Total Playtime",
      value: formatDuration(stats.totalPlaytime),
    },
    {
      icon: BarChart3,
      label: "Total Sessions",
      value: stats.totalSessions.toLocaleString(),
    },
    {
      icon: Gamepad2,
      label: "Games Played",
      value: stats.gamesPlayed.toLocaleString(),
    },
    {
      icon: Clock,
      label: "Avg Session",
      value: formatDuration(stats.avgSessionLength),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
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
  );
}

// --- UserTopGames ---

interface TopGame {
  game_name: string;
  cover_url: string | null;
  total_time_secs: number;
  total_sessions: number;
}

interface UserTopGamesProps {
  games: TopGame[];
}

export function UserTopGames({ games }: UserTopGamesProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Top Games</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {games.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 pb-6">
            No games played yet.
          </p>
        ) : (
          <div className="divide-y divide-border/30">
            {games.map((game, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-6 py-3 hover:bg-muted/20 transition-colors"
              >
                {/* Rank */}
                <span className="text-xs font-medium text-muted-foreground w-5 text-right tabular-nums">
                  {i + 1}
                </span>

                {/* Cover thumbnail */}
                <div className="h-8 w-8 rounded bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                  {game.cover_url ? (
                    <img
                      src={game.cover_url}
                      alt={game.game_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Game info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {game.game_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {game.total_sessions} session
                    {game.total_sessions !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Playtime */}
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  {formatDuration(game.total_time_secs)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- UserRecentSessions ---

interface RecentSession {
  id: string;
  game_name: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number;
  source: "agent" | "discord";
}

interface UserRecentSessionsProps {
  sessions: RecentSession[];
}

export function UserRecentSessions({ sessions }: UserRecentSessionsProps) {
  return (
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
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 pb-6">
            No sessions recorded yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="pl-6">Game</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="pr-6">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="border-border/30 hover:bg-muted/20"
                >
                  <TableCell className="pl-6">
                    <span className="text-sm font-medium">
                      {session.game_name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(session.started_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {session.ended_at
                        ? formatDate(session.ended_at)
                        : "In progress"}
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
  );
}
