"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import type { Profile } from "@/lib/types";

type UserWithStats = Profile & {
  total_playtime: number;
  session_count: number;
};

interface UsersTableProps {
  users: UserWithStats[];
  totalCount: number;
  currentPage: number;
  search: string;
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

function buildUrl(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== 1) {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return `/users${qs ? `?${qs}` : ""}`;
}

export function UsersTable({
  users,
  totalCount,
  currentPage,
  search,
}: UsersTableProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / 25));

  const pushSearch = useCallback(
    (q: string) => {
      router.push(buildUrl({ q: q || undefined, page: undefined }));
    },
    [router]
  );

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushSearch(value), 300);
  }

  function getPageNumbers(): (number | "ellipsis")[] {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by username, email, or Discord ID..."
          value={searchValue}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {totalCount.toLocaleString()} user{totalCount !== 1 ? "s" : ""}
          {search && (
            <span>
              {" "}
              matching &ldquo;{search}&rdquo;
            </span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="pl-4">User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Discord</TableHead>
              <TableHead className="text-right">Playtime</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const name = user.display_name || user.username;
                return (
                  <TableRow
                    key={user.id}
                    className="border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/users/${user.id}`)}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          {user.avatar_url && (
                            <AvatarImage
                              src={user.avatar_url}
                              alt={name ?? "User"}
                            />
                          )}
                          <AvatarFallback className="text-[11px] bg-muted">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {name ?? "Unknown"}
                          </p>
                          {user.username && user.display_name && (
                            <p className="text-xs text-muted-foreground truncate">
                              @{user.username}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.discord_id ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-500/10 text-green-400 border-green-500/20"
                        >
                          Connected
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground"
                        >
                          Not connected
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium tabular-nums">
                        {formatDuration(user.total_playtime)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {user.session_count.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(user.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.role === "admin" ? "default" : "secondary"}
                        className={
                          user.role === "admin"
                            ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {user.role ?? "user"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={
                  currentPage > 1
                    ? buildUrl({ q: search || undefined, page: currentPage - 1 })
                    : "#"
                }
                aria-disabled={currentPage <= 1}
                className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {getPageNumbers().map((page, i) =>
              page === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    href={buildUrl({ q: search || undefined, page })}
                    isActive={page === currentPage}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href={
                  currentPage < totalPages
                    ? buildUrl({ q: search || undefined, page: currentPage + 1 })
                    : "#"
                }
                aria-disabled={currentPage >= totalPages}
                className={
                  currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
