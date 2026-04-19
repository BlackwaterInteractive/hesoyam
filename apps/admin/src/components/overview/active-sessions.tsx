import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Radio, ArrowRight } from "lucide-react";

interface Session {
  id: string;
  user_id: string;
  game_name: string;
  started_at: string;
  username?: string;
  avatar_url?: string;
  game_cover_url?: string;
}

interface ActiveSessionsProps {
  sessions: Session[];
}

function getElapsedLabel(startedAt: string): string {
  const startMs = new Date(startedAt).getTime();
  const nowMs = Date.now();
  const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));

  if (diffSecs < 60) return "Playing for <1m";

  const hours = Math.floor(diffSecs / 3600);
  const minutes = Math.floor((diffSecs % 3600) / 60);

  if (hours > 0) {
    return `Playing for ${hours}h ${minutes}m`;
  }
  return `Playing for ${minutes}m`;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ActiveSessions({ sessions }: ActiveSessionsProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">
            Active Sessions
          </CardTitle>
          <Link
            href="/sessions"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-indigo-400 transition-colors"
          >
            {sessions.length > 0 && <span className="tabular-nums">{sessions.length} live</span>}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Radio className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No active sessions right now
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    {session.avatar_url && (
                      <AvatarImage
                        src={session.avatar_url}
                        alt={session.username ?? "User"}
                      />
                    )}
                    <AvatarFallback className="text-[10px] bg-muted">
                      {getInitials(session.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {session.username ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.game_name}
                  </p>
                </div>

                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {getElapsedLabel(session.started_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
