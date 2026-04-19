import Link from "next/link";
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
import { formatRelativeTime } from "@/lib/format";
import { UserPlus } from "lucide-react";

interface Signup {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  discord_id: string | null;
  created_at: string;
  role: string | null;
}

interface RecentSignupsProps {
  signups: Signup[];
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function RecentSignups({ signups }: RecentSignupsProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">
            Recent Signups
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {signups.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 pb-6">
            No signups yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="pl-6">User</TableHead>
                <TableHead>Discord</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="pr-6 text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signups.map((signup) => {
                const name = signup.display_name || signup.username;
                return (
                  <TableRow
                    key={signup.id}
                    className="border-border/30 hover:bg-muted/30"
                  >
                    <TableCell className="pl-6">
                      <Link
                        href={`/users/${signup.id}`}
                        className="flex items-center gap-2.5 group"
                      >
                        <Avatar className="h-7 w-7">
                          {signup.avatar_url && (
                            <AvatarImage
                              src={signup.avatar_url}
                              alt={name ?? "User"}
                            />
                          )}
                          <AvatarFallback className="text-[10px] bg-muted">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-indigo-400 transition-colors">
                            {name ?? "Unknown"}
                          </p>
                          {signup.username && signup.display_name && (
                            <p className="text-xs text-muted-foreground truncate">
                              @{signup.username}
                            </p>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {signup.discord_id
                          ? `ID: ${signup.discord_id}`
                          : "Not connected"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          signup.role === "admin" ? "default" : "secondary"
                        }
                        className={
                          signup.role === "admin"
                            ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {signup.role ?? "user"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(signup.created_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
