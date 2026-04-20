import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/supabase/supabase_client.dart';
import '../../../../shared/models/game.dart';
import '../../data/search_repository_impl.dart';
import '../../domain/search_repository.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepositoryImpl(ref.watch(supabaseClientProvider));
});

/// Search results — updated when the user types.
final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider = FutureProvider<List<Game>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.trim().length < 2) return [];
  return ref.read(searchRepositoryProvider).searchGames(query);
});
