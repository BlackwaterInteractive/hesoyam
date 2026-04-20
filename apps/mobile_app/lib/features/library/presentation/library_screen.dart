import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/models/library_status.dart';
import '../../../shared/utils/format.dart';
import '../../profile/presentation/providers/profile_provider.dart';
import '../domain/library_repository.dart';
import 'providers/library_provider.dart';

/// Category filter for the library chips.
/// `null` = "All" (no filter); anything else filters by `LibraryEntry.status`.
typedef _LibraryCategory = LibraryStatus?;

class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  _LibraryCategory _selectedCategory; // null = All

  _LibraryScreenState() : _selectedCategory = null;

  static const _categories = <(String, _LibraryCategory)>[
    ('All', null),
    ('Want to Play', LibraryStatus.wantToPlay),
    ('Played', LibraryStatus.played),
    ('Completed', LibraryStatus.completed),
  ];

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

            // Category chips — scrollable so long labels don't squash on narrow phones.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppTheme.spacing20, AppTheme.spacing16, AppTheme.spacing20, AppTheme.spacing12,
                ),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: List.generate(_categories.length, (i) {
                      final (label, category) = _categories[i];
                      final isSelected = category == _selectedCategory;
                      return Padding(
                        padding: const EdgeInsets.only(right: AppTheme.spacing8),
                        child: GestureDetector(
                          onTap: () =>
                              setState(() => _selectedCategory = category),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppTheme.spacing16,
                              vertical: AppTheme.spacing8,
                            ),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.accent
                                  : AppColors.surface2,
                              borderRadius: BorderRadius.circular(
                                AppTheme.radiusFull,
                              ),
                            ),
                            child: Text(
                              label,
                              style: AppTypography.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? Colors.black
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
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
                final isDiscordLinked = profileAsync.whenOrNull(
                      data: (p) => p?.discordId != null,
                    ) ??
                    false;

                if (entries.isEmpty) {
                  return SliverFillRemaining(
                    child: _EmptyLibrary(
                      isDiscordLinked: isDiscordLinked,
                    ),
                  );
                }

                final filtered = _filterByCategory(entries);

                if (filtered.isEmpty) {
                  return SliverFillRemaining(
                    child: _EmptyCategory(
                      categoryLabel: _categories
                          .firstWhere((c) => c.$2 == _selectedCategory)
                          .$1,
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppTheme.spacing20,
                  ),
                  sliver: SliverGrid.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: AppTheme.spacing8,
                      mainAxisSpacing: AppTheme.spacing16,
                      childAspectRatio: 0.58,
                    ),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final entry = filtered[index];
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

  List<LibraryEntry> _filterByCategory(List<LibraryEntry> entries) {
    final filtered = _selectedCategory == null
        ? List<LibraryEntry>.from(entries)
        : entries.where((e) => e.status == _selectedCategory).toList();

    // Sort policy:
    //   All / Want to Play → most recently added first (what's new in the library)
    //   Played / Completed → most played first (achievement-ish view)
    final sortByAddedAt = _selectedCategory == null ||
        _selectedCategory == LibraryStatus.wantToPlay;

    if (sortByAddedAt) {
      filtered.sort((a, b) {
        final aAt = a.addedAt;
        final bAt = b.addedAt;
        if (aAt == null && bAt == null) return 0;
        if (aAt == null) return 1; // nulls last
        if (bAt == null) return -1;
        return bAt.compareTo(aAt); // DESC
      });
    } else {
      filtered.sort(
        (a, b) => b.userGame.totalTimeSecs.compareTo(a.userGame.totalTimeSecs),
      );
    }
    return filtered;
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
          child: entry.game.coverUrl != null
              ? CachedNetworkImage(
                  imageUrl: entry.game.coverUrl!,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  placeholder: (_, _) => _coverPlaceholder(entry.game.name),
                  errorWidget: (_, _, _) => _coverPlaceholder(entry.game.name),
                )
              : _coverPlaceholder(entry.game.name),
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

class _EmptyCategory extends StatelessWidget {
  const _EmptyCategory({required this.categoryLabel});

  final String categoryLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.filter_list_rounded,
            size: 48,
            color: AppColors.textTertiary,
          ),
          const Gap(AppTheme.spacing16),
          Text(
            'No games in “$categoryLabel”',
            style: AppTypography.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const Gap(AppTheme.spacing8),
          Text(
            'Add games from Search, or change the filter above.',
            style: AppTypography.bodyMedium.copyWith(
              color: AppColors.textTertiary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
