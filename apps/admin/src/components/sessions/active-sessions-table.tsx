"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2, Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface Session {
  id: string;
  user_id: string;
  game_id: string | null;
  game_name: string;
  game_cover_url: string | null;
  username: string;
  avatar_url: string | null;
  started_at: string;
  source: "agent" | "discord";
}

function getInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    function update() {
      const diffSecs = Math.max(
        0,
        Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      );
      const h = Math.floor(diffSecs / 3600);
      const m = Math.floor((diffSecs % 3600) / 60);
      const s = diffSecs % 60;

      if (h > 0) {
        setElapsed(`${h}h ${m}m ${s}s`);
      } else if (m > 0) {
        setElapsed(`${m}m ${s}s`);
      } else {
        setElapsed(`${s}s`);
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className="tabular-nums text-emerald-400 font-medium">{elapsed}</span>;
}

export function ActiveSessionsTable({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <Radio className="h-10 w-10 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground">
              No active sessions right now
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="pl-6">User</TableHead>
              <TableHead>Game</TableHead>
              <TableHead>Playing for</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="pr-6 text-right">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow
                key={session.id}
                className="border-border/30 hover:bg-muted/20"
              >
                {/* User */}
                <TableCell className="pl-6">
                  <Link
                    href={`/users/${session.user_id}`}
                    className="flex items-center gap-2.5 group"
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        {session.avatar_url && (
                          <AvatarImage
                            src={session.avatar_url}
                            alt={session.username}
                          />
                        )}
                        <AvatarFallback className="text-[10px] bg-muted">
                          {getInitials(session.username)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                      </span>
                    </div>
                    <span className="text-sm font-medium group-hover:text-indigo-400 transition-colors">
                      {session.username}
                    </span>
                  </Link>
                </TableCell>

                {/* Game */}
                <TableCell>
                  <Link
                    href={session.game_id ? `/games/${session.game_id}` : "#"}
                    className="flex items-center gap-2.5 group"
                  >
                    <div className="h-8 w-6 rounded bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                      {session.game_cover_url ? (
                        <img
                          src={session.game_cover_url}
                          alt={session.game_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Gamepad2 className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </div>
                    <span className="text-sm group-hover:text-indigo-400 transition-colors">
                      {session.game_name}
                    </span>
                  </Link>
                </TableCell>

                {/* Elapsed */}
                <TableCell>
                  <ElapsedTime startedAt={session.started_at} />
                </TableCell>

                {/* Source */}
                <TableCell>
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

                {/* Started */}
                <TableCell className="pr-6 text-right">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {new Date(session.started_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
