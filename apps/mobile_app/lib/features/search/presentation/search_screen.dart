import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/models/library_status.dart';
import '../../../shared/models/search_result.dart';
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
                      error: (e, _) => Center(
                        child: Text(
                          'Search unavailable. Try again in a moment.',
                          style: AppTypography.bodyMedium.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ),
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
                        // "In Library" badge — compare IGDB ids, not UUIDs,
                        // because search results use IGDB's integer id and
                        // the user's library stores rows from our DB keyed
                        // by UUID. `game.igdbId` is the shared handle.
                        final libraryIgdbIds = ref
                                .watch(userLibraryProvider)
                                .whenOrNull(
                                  data: (entries) => entries
                                      .map((e) => e.game.igdbId)
                                      .whereType<int>()
                                      .toSet(),
                                ) ??
                            const <int>{};

                        return ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
                          itemCount: results.length,
                          itemBuilder: (context, index) => _SearchResultItem(
                            result: results[index],
                            isInLibrary: libraryIgdbIds.contains(results[index].id),
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
    required this.result,
    required this.isInLibrary,
  });

  final SearchResult result;
  final bool isInLibrary;

  @override
  ConsumerState<_SearchResultItem> createState() => _SearchResultItemState();
}

class _SearchResultItemState extends ConsumerState<_SearchResultItem> {
  bool _isAdding = false;

  Future<void> _addToLibrary() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;

    final status = await _pickStatus();
    if (status == null) return; // user dismissed the sheet

    setState(() => _isAdding = true);
    try {
      // Two-step: import from IGDB into our games table, then add the
      // returned UUID to this user's library with the chosen status.
      final gameId = await ref
          .read(searchRepositoryProvider)
          .importGame(widget.result.id);
      await ref
          .read(libraryRepositoryProvider)
          .addToLibrary(user.id, gameId, status);
      ref.invalidate(userLibraryProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${widget.result.name} added to ${status.label}',
            ),
          ),
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

  Future<LibraryStatus?> _pickStatus() {
    return showModalBottomSheet<LibraryStatus>(
      context: context,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppTheme.radiusLarge),
        ),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacing16,
            vertical: AppTheme.spacing20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacing8,
                ),
                child: Text(
                  'Add to library',
                  style: AppTypography.headlineSmall,
                ),
              ),
              const Gap(AppTheme.spacing4),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacing8,
                ),
                child: Text(
                  widget.result.name,
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.textTertiary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Gap(AppTheme.spacing16),
              for (final s in LibraryStatus.values)
                _StatusOption(
                  status: s,
                  onTap: () => Navigator.of(ctx).pop(s),
                ),
            ],
          ),
        ),
      ),
    );
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
              child: widget.result.coverUrl != null
                  ? CachedNetworkImage(
                      imageUrl: widget.result.coverUrl!,
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
                  widget.result.name,
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
                    if (widget.result.genreNames.isNotEmpty)
                      widget.result.genreNames.first,
                    if (widget.result.releaseYear != null)
                      widget.result.releaseYear.toString(),
                  ].join(' \u00B7 '),
                  style: AppTypography.bodySmall,
                ),
              ],
            ),
          ),

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
        widget.result.name.split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join(),
        style: AppTypography.bodySmall.copyWith(
          fontSize: 9,
          color: AppColors.textTertiary,
        ),
      ),
    );
  }
}

class _StatusOption extends StatelessWidget {
  const _StatusOption({required this.status, required this.onTap});

  final LibraryStatus status;
  final VoidCallback onTap;

  IconData get _icon => switch (status) {
        LibraryStatus.wantToPlay => Icons.bookmark_add_outlined,
        LibraryStatus.played => Icons.sports_esports_rounded,
        LibraryStatus.completed => Icons.check_circle_outline_rounded,
      };

  String get _subtitle => switch (status) {
        LibraryStatus.wantToPlay => 'Games you plan to play',
        LibraryStatus.played => 'Currently playing or played before',
        LibraryStatus.completed => 'Games you\u2019ve finished',
      };

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacing8,
            vertical: AppTheme.spacing12,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.surface1,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall + 2),
                ),
                alignment: Alignment.center,
                child: Icon(_icon, size: 20, color: AppColors.accent),
              ),
              const Gap(AppTheme.spacing12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      status.label,
                      style: AppTypography.bodyLarge.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const Gap(AppTheme.spacing2),
                    Text(_subtitle, style: AppTypography.bodySmall),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
