import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/models/game.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../library/presentation/providers/library_provider.dart';
import 'providers/search_provider.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(searchQueryProvider);
    final resultsAsync = ref.watch(searchResultsProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppTheme.spacing20, AppTheme.spacing12, AppTheme.spacing20, 0,
              ),
              child: Text('Search', style: AppTypography.headlineLarge),
            ),

            Padding(
              padding: const EdgeInsets.all(AppTheme.spacing20),
              child: TextField(
                controller: _searchController,
                style: AppTypography.bodyLarge,
                onChanged: (v) =>
                    ref.read(searchQueryProvider.notifier).state = v,
                decoration: InputDecoration(
                  hintText: 'Search games...',
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    color: AppColors.textTertiary,
                  ),
                  suffixIcon: query.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close_rounded, color: AppColors.textTertiary),
                          onPressed: () {
                            _searchController.clear();
                            ref.read(searchQueryProvider.notifier).state = '';
                          },
                        )
                      : null,
                ),
              ),
            ),

            Expanded(
              child: query.trim().length < 2
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.search_rounded,
                            size: 48,
                            color: AppColors.textTertiary.withValues(alpha: 0.5),
                          ),
                          const Gap(AppTheme.spacing16),
                          Text(
                            'Search for games to add\nto your library',
                            style: AppTypography.bodyMedium.copyWith(
                              color: AppColors.textTertiary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : resultsAsync.when(
                      loading: () => const Center(child: CircularProgressIndicator()),
                      error: (e, _) => Center(child: Text('Search failed: $e')),
                      data: (results) {
                        if (results.isEmpty) {
                          return Center(
                            child: Text(
                              'No games found for "$query"',
                              style: AppTypography.bodyMedium.copyWith(
                                color: AppColors.textTertiary,
                              ),
                            ),
                          );
                        }
                        // PRD §5.3: Check library membership for "In Library" badge
                        final libraryGameIds = ref
                                .watch(userLibraryProvider)
                                .whenOrNull(
                                  data: (entries) =>
                                      entries.map((e) => e.game.id).toSet(),
                                ) ??
                            <String>{};

                        return ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
                          itemCount: results.length,
                          itemBuilder: (context, index) => _SearchResultItem(
                            game: results[index],
                            isInLibrary: libraryGameIds.contains(results[index].id),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchResultItem extends ConsumerStatefulWidget {
  const _SearchResultItem({
    required this.game,
    required this.isInLibrary,
  });

  final Game game;
  final bool isInLibrary;

  @override
  ConsumerState<_SearchResultItem> createState() => _SearchResultItemState();
}

class _SearchResultItemState extends ConsumerState<_SearchResultItem> {
  bool _isAdding = false;

  Future<void> _addToLibrary() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;

    setState(() => _isAdding = true);
    try {
      await ref
          .read(libraryRepositoryProvider)
          .addToLibrary(user.id, widget.game.id);
      ref.invalidate(userLibraryProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${widget.game.name} added to library')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to add: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isAdding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacing12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.divider, width: 0.5)),
      ),
      child: Row(
        children: [
          // Cover
          ClipRRect(
            borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
            child: SizedBox(
              width: 48,
              height: 64,
              child: widget.game.coverUrl != null
                  ? CachedNetworkImage(
                      imageUrl: widget.game.coverUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => _placeholder(),
                      errorWidget: (_, _, _) => _placeholder(),
                    )
                  : _placeholder(),
            ),
          ),
          const Gap(AppTheme.spacing12),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.game.name,
                  style: AppTypography.bodyLarge.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const Gap(AppTheme.spacing2),
                Text(
                  [
                    widget.game.developer,
                    if (widget.game.releaseYear != null)
                      widget.game.releaseYear.toString(),
                  ].whereType<String>().join(' \u00B7 '),
                  style: AppTypography.bodySmall,
                ),
              ],
            ),
          ),

          // PRD §5.3: "In Library" badge or "+ Add" button
          if (widget.isInLibrary)
            Text(
              'In Library',
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.success,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            )
          else
            GestureDetector(
              onTap: _isAdding ? null : _addToLibrary,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacing12,
                  vertical: AppTheme.spacing8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                ),
                child: _isAdding
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.black,
                        ),
                      )
                    : Text(
                        '+ Add',
                        style: AppTypography.bodySmall.copyWith(
                          color: Colors.black,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      color: AppColors.surface2,
      alignment: Alignment.center,
      child: Text(
        widget.game.name.split(' ').map((w) => w[0]).take(2).join(),
        style: AppTypography.bodySmall.copyWith(
          fontSize: 9,
          color: AppColors.textTertiary,
        ),
      ),
    );
  }
}
