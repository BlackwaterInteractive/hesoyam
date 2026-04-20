import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/supabase/supabase_client.dart';
import '../../../../shared/models/search_result.dart';
import '../../data/search_repository_impl.dart';
import '../../domain/search_repository.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepositoryImpl(ref.watch(supabaseClientProvider));
});

/// Search query — the Search tab's text input pushes into this.
final searchQueryProvider = StateProvider<String>((ref) => '');

/// IGDB-shaped search results. Populated when the query is ≥2 chars.
final searchResultsProvider = FutureProvider<List<SearchResult>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.trim().length < 2) return const [];
  return ref.read(searchRepositoryProvider).searchGames(query);
});
