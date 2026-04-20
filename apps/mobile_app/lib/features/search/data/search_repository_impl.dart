import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/game.dart';
import '../domain/search_repository.dart';

class SearchRepositoryImpl implements SearchRepository {
  SearchRepositoryImpl(this._client);

  final SupabaseClient _client;

  @override
  Future<List<Game>> searchGames(String query) async {
    if (query.trim().isEmpty) return [];

    final data = await _client.rpc(
      'search_games_fuzzy',
      params: {'search_term': query},
    );

    return (data as List)
        .map((row) => Game.fromJson(row as Map<String, dynamic>))
        .toList();
  }
}
