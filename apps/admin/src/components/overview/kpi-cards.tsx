import Link from "next/link";
import {
  Users,
  Activity,
  Radio,
  PlayCircle,
  Gamepad2,
  Link2,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";

export interface PlatformOverview {
  total_users: number;
  dau: number;
  wau: number;
  mau: number;
  active_sessions: number;
  sessions_today: number;
  total_games: number;
  total_sessions: number;
  total_playtime_secs: number;
  signups_today: number;
  signups_this_week: number;
  discord_connected: number;
  in_guild_count: number;
}

interface KpiCardsProps {
  data: PlatformOverview;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent,
  indicator,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
  indicator?: "green";
  href?: string;
}) {
  const Wrapper = href ? Link : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper {...(wrapperProps as any)}>
      <Card
        className={`${
          accent
            ? "border-indigo-500/30 bg-indigo-500/5"
            : "border-border/50"
        }${href ? " cursor-pointer transition-colors hover:bg-muted/30" : ""}`}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {label}
              </span>
            </div>
            {indicator === "green" && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}

export function KpiCards({ data }: KpiCardsProps) {
  const hasActiveSessions = data.active_sessions > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        icon={Users}
        label="Total Users"
        value={data.total_users.toLocaleString()}
        subtitle={`${data.signups_today} today, ${data.signups_this_week} this week`}
      />
      <KpiCard
        icon={Activity}
        label="DAU"
        value={data.dau.toLocaleString()}
        subtitle="Daily active users"
      />
      <KpiCard
        icon={Activity}
        label="WAU"
        value={data.wau.toLocaleString()}
        subtitle="Weekly active users"
      />
      <KpiCard
        icon={Activity}
        label="MAU"
        value={data.mau.toLocaleString()}
        subtitle="Monthly active users"
      />
      <KpiCard
        icon={Radio}
        label="Active Sessions"
        value={data.active_sessions.toLocaleString()}
        accent={hasActiveSessions}
        indicator={hasActiveSessions ? "green" : undefined}
        href="/sessions"
      />
      <KpiCard
        icon={PlayCircle}
        label="Sessions Today"
        value={data.sessions_today.toLocaleString()}
      />
      <KpiCard
        icon={Gamepad2}
        label="Total Games"
        value={data.total_games.toLocaleString()}
      />
      <KpiCard
        icon={Link2}
        label="Discord Connected"
        value={data.discord_connected.toLocaleString()}
        subtitle={`${data.in_guild_count} in guild`}
      />
      <KpiCard
        icon={Clock}
        label="Total Playtime"
        value={formatDuration(data.total_playtime_secs)}
      />
    </div>
  );
}
