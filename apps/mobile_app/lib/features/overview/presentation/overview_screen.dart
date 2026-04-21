import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/utils/format.dart';
import '../../profile/presentation/providers/profile_provider.dart';
import 'providers/overview_provider.dart';
import 'widgets/live_session_card.dart';
import 'widgets/last_played_card.dart';
import 'widgets/stats_row.dart';
import 'widgets/streak_bar.dart';
import 'widgets/recent_plays.dart';
import 'widgets/join_server_cta.dart';

class OverviewScreen extends ConsumerWidget {
  const OverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentProfileProvider);

    return Scaffold(
      body: SafeArea(
        child: profileAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (profile) {
            final isDiscordLinked = profile?.discordId != null;
            final isInGuild = profile?.inGuild ?? false;

            // PRD §5.1 State C: Redirects to Library tab
            if (!isDiscordLinked) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (context.mounted) context.go(RoutePaths.library);
              });
              return const SizedBox.shrink();
            }

            return CustomScrollView(
              slivers: [
                // Header
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppTheme.spacing20, AppTheme.spacing12, AppTheme.spacing20, 0,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Overview', style: AppTypography.headlineLarge),
                        Container(
                          width: 36,
                          height: 36,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              colors: [AppColors.accent, Color(0xFF7C3AED)],
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            (profile?.username ?? '?')[0].toUpperCase(),
                            style: AppTypography.labelLarge.copyWith(
                              fontSize: 14,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                if (isDiscordLinked && isInGuild)
                  _FullTrackingContent()
                else if (isDiscordLinked && !isInGuild)
                  _NoServerContent()
                else
                  _NoDiscordContent(),

                const SliverToBoxAdapter(child: Gap(AppTheme.spacing32)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _FullTrackingContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final presenceAsync = ref.watch(gamePresenceProvider);
    final statsAsync = ref.watch(dashboardStatsProvider);
    final allTimeAsync = ref.watch(allTimeSecsProvider);
    final streakAsync = ref.watch(weekStreakProvider);
    final recentAsync = ref.watch(recentPlaysProvider);

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
      sliver: SliverList.list(
        children: [
          const Gap(AppTheme.spacing16),

          // Live session or last played
          presenceAsync.when(
            data: (presence) {
              if (presence != null) {
                return LiveSessionCard(
                  gameName: presence.gameName,
                  startedAt: presence.startedAt,
                );
              }
              // Not playing — show last played from recent
              return recentAsync.when(
                data: (plays) {
                  if (plays.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(AppTheme.spacing24),
                      decoration: BoxDecoration(
                        color: AppColors.surface1,
                        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                      ),
                      child: Text(
                        'Start playing a game to see your stats here.',
                        style: AppTypography.bodyMedium,
                      ),
                    );
                  }
                  final last = plays.first;
                  return LastPlayedCard(
                    gameName: last.game.name,
                    duration: formatDuration(last.session.durationSecs),
                    timeAgo: formatRelativeDate(last.session.startedAt),
                  );
                },
                loading: () => _shimmerCard(),
                error: (_, __) => const SizedBox.shrink(),
              );
            },
            loading: () => _shimmerCard(),
            error: (_, __) => const SizedBox.shrink(),
          ),

          const Gap(AppTheme.spacing16),

          // Stats row
          statsAsync.when(
            data: (stats) {
              if (stats == null) return const SizedBox.shrink();
              return allTimeAsync.when(
                data: (allTime) => StatsRow(
                  today: formatDuration(stats.today.totalSecs),
                  thisWeek: formatDuration(stats.thisWeek.totalSecs),
                  thisMonth: formatDuration(stats.thisMonth.totalSecs),
                  allTime: formatDuration(allTime),
                ),
                loading: () => _shimmerCard(height: 70),
                error: (_, __) => const SizedBox.shrink(),
              );
            },
            loading: () => _shimmerCard(height: 70),
            error: (_, __) => const SizedBox.shrink(),
          ),

          const Gap(AppTheme.spacing16),

          // Streak
          streakAsync.when(
            data: (days) {
              // Calculate week streak count
              // TODO: proper streak calculation from historical data
              final trackedDays = days.where((d) => d.hasActivity).length;
              return StreakBar(
                weekStreak: trackedDays > 0 ? 1 : 0,
                days: days.map((d) {
                  final now = DateTime.now();
                  final isUpcoming = d.date.isAfter(DateTime(now.year, now.month, now.day));
                  return StreakDay(
                    label: d.label,
                    status: isUpcoming
                        ? StreakStatus.upcoming
                        : d.hasActivity
                            ? StreakStatus.tracked
                            : StreakStatus.missed,
                  );
                }).toList(),
              );
            },
            loading: () => _shimmerCard(height: 120),
            error: (_, __) => const SizedBox.shrink(),
          ),

          const Gap(AppTheme.spacing24),

          // Recent plays
          Text('Recent Plays', style: AppTypography.headlineSmall),
          const Gap(AppTheme.spacing12),

          recentAsync.when(
            data: (plays) {
              if (plays.isEmpty) {
                return Text(
                  'No sessions yet.',
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                );
              }
              return RecentPlays(
                sessions: plays.map((p) => RecentSession(
                  gameName: p.game.name,
                  duration: formatDuration(p.session.durationSecs),
                  date: formatRelativeDate(p.session.startedAt),
                  time: formatTime(p.session.startedAt),
                  coverUrl: p.game.coverUrl,
                )).toList(),
              );
            },
            loading: () => _shimmerCard(height: 200),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

class _NoServerContent extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
      sliver: SliverList.list(
        children: [
          const Gap(AppTheme.spacing16),
          const JoinServerCta(),
          const Gap(AppTheme.spacing24),
          // TODO: #124 — popular games RPC
          // TODO: #125 — community stats RPC
          Text(
            'Popular on RAID right now',
            style: AppTypography.bodySmall.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const Gap(AppTheme.spacing12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppTheme.spacing24),
            decoration: BoxDecoration(
              color: AppColors.surface1,
              borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
            ),
            child: Text(
              'Community stats coming soon',
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

class _NoDiscordContent extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
      sliver: SliverList.list(
        children: [
          const Gap(AppTheme.spacing48),
          Center(
            child: Column(
              children: [
                const Icon(Icons.gamepad_outlined, size: 48, color: AppColors.textTertiary),
                const Gap(AppTheme.spacing16),
                Text(
                  'Connect Discord to start tracking',
                  style: AppTypography.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const Gap(AppTheme.spacing8),
                Text(
                  'Link your Discord account to automatically track your gameplay.',
                  style: AppTypography.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const Gap(AppTheme.spacing24),
                SizedBox(
                  width: 220,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      // TODO: navigate to connect discord
                    },
                    icon: const Icon(Icons.link_rounded, size: 18),
                    label: const Text('Connect Discord'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.discord,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Widget _shimmerCard({double height = 100}) {
  return Container(
    height: height,
    decoration: BoxDecoration(
      color: AppColors.surface1,
      borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
    ),
  );
}
