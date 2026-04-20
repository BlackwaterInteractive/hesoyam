import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/utils/format.dart';
import '../../profile/presentation/providers/profile_provider.dart';
import '../domain/library_repository.dart';
import 'providers/library_provider.dart';

class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  int _selectedFilter = 0;
  static const _filters = ['All', 'Recent', 'Most Played'];

  @override
  Widget build(BuildContext context) {
    final libraryAsync = ref.watch(userLibraryProvider);
    final profileAsync = ref.watch(currentProfileProvider);

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
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
                    Text('Library', style: AppTypography.headlineLarge),
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
                        profileAsync.whenOrNull(
                              data: (p) => (p?.username ?? '?')[0].toUpperCase(),
                            ) ??
                            '?',
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

            // Filter chips
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppTheme.spacing20, AppTheme.spacing16, AppTheme.spacing20, AppTheme.spacing12,
                ),
                child: Row(
                  children: List.generate(_filters.length, (i) {
                    final isSelected = i == _selectedFilter;
                    return Padding(
                      padding: const EdgeInsets.only(right: AppTheme.spacing8),
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedFilter = i),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppTheme.spacing16,
                            vertical: AppTheme.spacing8,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.accent : AppColors.surface2,
                            borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                          ),
                          child: Text(
                            _filters[i],
                            style: AppTypography.bodySmall.copyWith(
                              fontWeight: FontWeight.w600,
                              color: isSelected ? Colors.black : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ),

            // Grid
            libraryAsync.when(
              loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => SliverFillRemaining(
                child: Center(child: Text('Error: $e')),
              ),
              data: (entries) {
                if (entries.isEmpty) {
                  return SliverFillRemaining(
                    child: _EmptyLibrary(
                      isDiscordLinked: profileAsync.whenOrNull(
                            data: (p) => p?.discordId != null,
                          ) ??
                          false,
                    ),
                  );
                }

                final sorted = _sortEntries(entries);

                return SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
                  sliver: SliverGrid.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: AppTheme.spacing12,
                      mainAxisSpacing: AppTheme.spacing16,
                      childAspectRatio: 0.58,
                    ),
                    itemCount: sorted.length,
                    itemBuilder: (context, index) {
                      final entry = sorted[index];
                      return GestureDetector(
                        onTap: () => context.push('/game/${entry.game.id}'),
                        child: _GameCard(entry: entry),
                      );
                    },
                  ),
                );
              },
            ),

            const SliverToBoxAdapter(child: Gap(AppTheme.spacing32)),
          ],
        ),
      ),
    );
  }

  List<LibraryEntry> _sortEntries(List<LibraryEntry> entries) {
    final sorted = List<LibraryEntry>.from(entries);
    switch (_selectedFilter) {
      case 1: // Recent
        sorted.sort((a, b) =>
            (b.userGame.lastPlayed ?? DateTime(2000))
                .compareTo(a.userGame.lastPlayed ?? DateTime(2000)));
        break;
      case 2: // Most Played
        sorted.sort((a, b) =>
            b.userGame.totalTimeSecs.compareTo(a.userGame.totalTimeSecs));
        break;
    }
    return sorted;
  }
}

class _GameCard extends StatelessWidget {
  const _GameCard({required this.entry});

  final LibraryEntry entry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
            child: entry.game.coverUrl != null
                ? CachedNetworkImage(
                    imageUrl: entry.game.coverUrl!,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    placeholder: (_, __) => _coverPlaceholder(entry.game.name),
                    errorWidget: (_, __, ___) => _coverPlaceholder(entry.game.name),
                  )
                : _coverPlaceholder(entry.game.name),
          ),
        ),
        const Gap(AppTheme.spacing8),
        Text(
          entry.game.name,
          style: AppTypography.bodyLarge.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const Gap(AppTheme.spacing2),
        Text(
          formatDuration(entry.userGame.totalTimeSecs),
          style: AppTypography.bodySmall.copyWith(
            color: AppColors.textTertiary,
            fontSize: 11,
          ),
        ),
      ],
    );
  }

  Widget _coverPlaceholder(String name) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF2A1A3E), Color(0xFF1A2A3E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        name.split(' ').map((w) => w[0]).take(3).join(),
        style: AppTypography.bodySmall.copyWith(
          color: AppColors.textTertiary,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _EmptyLibrary extends StatelessWidget {
  const _EmptyLibrary({required this.isDiscordLinked});

  final bool isDiscordLinked;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (!isDiscordLinked) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppTheme.spacing24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1A0F2E), Color(0xFF0F1A2E)],
                ),
                borderRadius: BorderRadius.circular(AppTheme.radiusLarge),
                border: Border.all(color: AppColors.accentDim),
              ),
              child: Column(
                children: [
                  Text('Connect Discord', style: AppTypography.headlineSmall),
                  const Gap(AppTheme.spacing8),
                  Text(
                    'Connect Discord to automatically track and add games to your library.',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            const Gap(AppTheme.spacing32),
          ],
          const Icon(Icons.grid_view_rounded, size: 48, color: AppColors.textTertiary),
          const Gap(AppTheme.spacing16),
          Text('Your library is empty', style: AppTypography.headlineSmall),
          const Gap(AppTheme.spacing8),
          Text(
            'Search and add games to start building your collection.',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
            textAlign: TextAlign.center,
          ),
          const Gap(AppTheme.spacing20),
          SizedBox(
            width: 180,
            child: ElevatedButton(
              onPressed: () => context.go('/search'),
              child: const Text('Search Games'),
            ),
          ),
        ],
      ),
    );
  }
}
