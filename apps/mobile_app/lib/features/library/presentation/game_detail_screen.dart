import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/utils/format.dart';
import 'providers/library_provider.dart';

/// Game Detail — pushed from Library, Search, or Overview.
///
/// Hero artwork, metadata, stats, and session history.
class GameDetailScreen extends ConsumerWidget {
  const GameDetailScreen({required this.gameId, super.key});

  final String gameId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(gameDetailProvider(gameId));

    return Scaffold(
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppTheme.spacing24),
            child: Text(
              'Failed to load game: $e',
              style: AppTypography.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ),
        ),
        data: (detail) {
          if (detail == null) {
            return const Center(child: Text('Game not found'));
          }

          final game = detail.game;
          final userGame = detail.userGame;
          final sessions = detail.sessions;

          final hasFirstOrLast =
              userGame?.firstPlayed != null || userGame?.lastPlayed != null;

          return CustomScrollView(
            slivers: [
              // Hero image
              SliverAppBar(
                expandedHeight: 220,
                pinned: true,
                backgroundColor: AppColors.background,
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                flexibleSpace: FlexibleSpaceBar(
                  background: _HeroArtwork(
                    url: game.artworkUrl ?? game.coverUrl,
                    name: game.name,
                  ),
                ),
              ),

              SliverPadding(
                padding: const EdgeInsets.all(AppTheme.spacing20),
                sliver: SliverList.list(
                  children: [
                    // Title
                    Text(game.name, style: AppTypography.displayMedium),
                    const Gap(AppTheme.spacing4),
                    Text(
                      [
                        game.developer,
                        if (game.releaseYear != null)
                          game.releaseYear.toString(),
                      ].whereType<String>().join(' \u00B7 '),
                      style: AppTypography.bodyMedium,
                    ),

                    if (game.genres != null && game.genres!.isNotEmpty) ...[
                      const Gap(AppTheme.spacing12),
                      Wrap(
                        spacing: AppTheme.spacing8,
                        runSpacing: AppTheme.spacing8,
                        children: game.genres!.map((genre) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppTheme.spacing12,
                              vertical: AppTheme.spacing4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surface2,
                              borderRadius: BorderRadius.circular(
                                AppTheme.radiusFull,
                              ),
                            ),
                            child: Text(
                              genre,
                              style: AppTypography.bodySmall.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],

                    const Gap(AppTheme.spacing20),

                    // Stats row 1
                    Row(
                      children: [
                        _StatCard(
                          value: formatDuration(userGame?.totalTimeSecs ?? 0),
                          label: 'Total',
                        ),
                        const Gap(AppTheme.spacing8),
                        _StatCard(
                          value: '${userGame?.totalSessions ?? 0}',
                          label: 'Sessions',
                        ),
                        const Gap(AppTheme.spacing8),
                        _StatCard(
                          value: formatDuration(userGame?.avgSessionSecs ?? 0),
                          label: 'Avg Session',
                        ),
                      ],
                    ),

                    if (hasFirstOrLast) ...[
                      const Gap(AppTheme.spacing8),
                      Row(
                        children: [
                          _StatCard(
                            value: userGame?.firstPlayed != null
                                ? DateFormat('MMM d, yyyy')
                                    .format(userGame!.firstPlayed!)
                                : '\u2014',
                            label: 'First Played',
                            small: true,
                          ),
                          const Gap(AppTheme.spacing8),
                          _StatCard(
                            value: userGame?.lastPlayed != null
                                ? formatRelativeDate(userGame!.lastPlayed!)
                                : '\u2014',
                            label: 'Last Played',
                            small: true,
                          ),
                        ],
                      ),
                    ],

                    const Gap(AppTheme.spacing24),

                    // Session history
                    Text('Session History', style: AppTypography.headlineSmall),
                    const Gap(AppTheme.spacing12),

                    if (sessions.isEmpty)
                      Text(
                        'No sessions yet.',
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.textTertiary,
                        ),
                      )
                    else
                      ...sessions.map(
                        (s) => Container(
                          padding: const EdgeInsets.symmetric(
                            vertical: AppTheme.spacing12,
                          ),
                          decoration: const BoxDecoration(
                            border: Border(
                              bottom: BorderSide(
                                color: AppColors.divider,
                                width: 0.5,
                              ),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${formatRelativeDate(s.startedAt)} \u00B7 ${formatTime(s.startedAt)}',
                                style: AppTypography.bodyMedium.copyWith(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                formatDuration(s.durationSecs),
                                style: AppTypography.bodyLarge.copyWith(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                  color: AppColors.accent,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                    const Gap(AppTheme.spacing32),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _HeroArtwork extends StatelessWidget {
  const _HeroArtwork({required this.url, required this.name});

  final String? url;
  final String name;

  @override
  Widget build(BuildContext context) {
    if (url != null) {
      return CachedNetworkImage(
        imageUrl: url!,
        fit: BoxFit.cover,
        placeholder: (_, _) => _placeholder(),
        errorWidget: (_, _, _) => _placeholder(),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF2A1A3E), Color(0xFF1A2A3E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        name,
        style: AppTypography.bodyMedium.copyWith(
          color: AppColors.textTertiary,
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.value,
    required this.label,
    this.small = false,
  });

  final String value;
  final String label;
  final bool small;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacing8,
          vertical: AppTheme.spacing12,
        ),
        decoration: BoxDecoration(
          color: AppColors.surface1,
          borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: small
                  ? AppTypography.bodyLarge.copyWith(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    )
                  : AppTypography.monoSmall,
              textAlign: TextAlign.center,
            ),
            const Gap(AppTheme.spacing4),
            Text(label, style: AppTypography.labelSmall),
          ],
        ),
      ),
    );
  }
}
