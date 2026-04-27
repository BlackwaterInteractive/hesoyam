"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Gamepad2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Image as ImageIcon,
  Square,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { Game } from "@/lib/types";

type GameWithStats = Game & {
  session_count: number;
  player_count: number;
};

type SortMode = "recent" | "plays_desc";

interface GamesTableProps {
  games: GameWithStats[];
  totalCount: number;
  currentPage: number;
  search: string;
  filter: string;
  sort: SortMode;
}

const FILTER_OPTIONS = [
  { value: "all", label: "All Games" },
  { value: "needs_enrichment", label: "Needs Enrichment" },
  { value: "missing_cover", label: "Missing Cover" },
  { value: "missing_genres", label: "Missing Genres" },
  { value: "ignored", label: "Ignored" },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "plays_desc", label: "By Plays (desc)" },
];

function buildUrl(
  params: Record<string, string | number | undefined>
) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== "" &&
      !(key === "page" && value === 1) &&
      !(key === "filter" && value === "all") &&
      !(key === "sort" && value === "recent")
    ) {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return `/games${qs ? `?${qs}` : ""}`;
}

export function GamesTable({
  games,
  totalCount,
  currentPage,
  search,
  filter,
  sort,
}: GamesTableProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / 25));

  const pushParams = useCallback(
    (q?: string, f?: string, s?: SortMode) => {
      router.push(
        buildUrl({
          q: (q ?? searchValue) || undefined,
          filter: (f ?? filter) || undefined,
          sort: s ?? sort,
          page: undefined,
        })
      );
    },
    [router, searchValue, filter, sort]
  );

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams(value, undefined), 300);
  }

  function handleFilterChange(value: string | null, _event: unknown) {
    router.push(
      buildUrl({
        q: searchValue || undefined,
        filter: value || undefined,
        sort,
        page: undefined,
      })
    );
  }

  function handleSortChange(value: string | null, _event: unknown) {
    router.push(
      buildUrl({
        q: searchValue || undefined,
        filter: filter || undefined,
        sort: (value as SortMode) || undefined,
        page: undefined,
      })
    );
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
      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search games..."
            value={searchValue}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Gamepad2 className="h-4 w-4" />
        <span>
          {totalCount.toLocaleString()} game{totalCount !== 1 ? "s" : ""}
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
              <TableHead className="pl-4">Game</TableHead>
              <TableHead>IGDB ID</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Players</TableHead>
              <TableHead>App ID</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  Assets
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-help"
                      aria-label="What do these badges mean?"
                    >
                      <HelpCircle className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-sm whitespace-normal py-2.5 text-left"
                    >
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-medium opacity-80">
                          Asset state for the row&rsquo;s tile
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          <li className="flex items-start gap-2">
                            <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
                            <span>
                              <span className="font-semibold">Enriched</span> &mdash; curated assets via SteamGridDB.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <ImageIcon className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>
                              <span className="font-semibold">IGDB</span> &mdash; using IGDB&rsquo;s stock cover, not curated yet.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Square className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>
                              <span className="font-semibold">Placeholder</span> &mdash; no cover, falls back to a generic tile.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-destructive" />
                            <span>
                              <span className="font-semibold">No Metadata</span> &mdash; no genres, so the placeholder tile won&rsquo;t be themed. Stacks on top of the others.
                            </span>
                          </li>
                        </ul>
                        <p className="text-[11px] opacity-70">
                          The first three are mutually exclusive.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  No games found.
                </TableCell>
              </TableRow>
            ) : (
              games.map((game) => {
                const isIgnored = game.ignored;
                const genres = game.genres ?? [];
                const hasCover = !!game.cover_url;
                const hasGenres = genres.length > 0;
                const adminRemapped = game.admin_remapped_at != null;

                return (
                  <TableRow
                    key={game.id}
                    className={`border-border/30 cursor-pointer transition-colors ${
                      isIgnored
                        ? "opacity-50 hover:bg-muted/20"
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => router.push(`/games/${game.id}`)}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        {/* Cover thumbnail */}
                        <div className="h-10 w-10 rounded bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                          {game.cover_url ? (
                            <img
                              src={game.cover_url}
                              alt={game.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Gamepad2 className="h-5 w-5 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={`text-sm font-medium truncate ${
                                isIgnored ? "line-through" : ""
                              }`}
                            >
                              {game.name}
                            </p>
                            {adminRemapped && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0 gap-0.5"
                                title={`Admin remapped on ${new Date(game.admin_remapped_at!).toLocaleString()}`}
                              >
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Admin Remapped
                              </Badge>
                            )}
                          </div>
                          {game.developer && (
                            <p className="text-xs text-muted-foreground truncate">
                              {game.developer}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {game.igdb_id != null ? (
                        <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono tabular-nums">
                          {game.igdb_id}
                        </code>
                      ) : (
                        <span className="text-muted-foreground/40">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {game.session_count.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {game.player_count.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {game.discord_application_id ? (
                        <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono">
                          {game.discord_application_id}
                        </code>
                      ) : (
                        <span className="text-muted-foreground/40">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {game.assets_enriched ? (
                          <Badge
                            variant="secondary"
                            className="text-[11px] bg-amber-500/10 text-amber-400 border-amber-500/20"
                          >
                            <Sparkles className="h-3 w-3 mr-0.5" />
                            Enriched
                          </Badge>
                        ) : hasCover ? (
                          <Badge
                            variant="secondary"
                            className="text-[11px] bg-muted text-muted-foreground"
                          >
                            <ImageIcon className="h-3 w-3 mr-0.5" />
                            IGDB
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[11px] bg-muted text-muted-foreground"
                          >
                            <Square className="h-3 w-3 mr-0.5" />
                            Placeholder
                          </Badge>
                        )}
                        {!hasGenres && (
                          <Badge
                            variant="destructive"
                            className="text-[11px]"
                          >
                            <AlertCircle className="h-3 w-3 mr-0.5" />
                            No Metadata
                          </Badge>
                        )}
                      </div>
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
                    ? buildUrl({
                        q: search || undefined,
                        filter: filter || undefined,
                        sort,
                        page: currentPage - 1,
                      })
                    : "#"
                }
                aria-disabled={currentPage <= 1}
                className={
                  currentPage <= 1 ? "pointer-events-none opacity-50" : ""
                }
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
                    href={buildUrl({
                      q: search || undefined,
                      filter: filter || undefined,
                      sort,
                      page,
                    })}
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
                    ? buildUrl({
                        q: search || undefined,
                        filter: filter || undefined,
                        sort,
                        page: currentPage + 1,
                      })
                    : "#"
                }
                aria-disabled={currentPage >= totalPages}
                className={
                  currentPage >= totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
