import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/config/env.dart';
import '../../../shared/models/search_result.dart';
import '../domain/search_repository.dart';

class SearchRepositoryImpl implements SearchRepository {
  SearchRepositoryImpl(this._supabase, {Dio? dio})
      : _dio = dio ?? Dio(BaseOptions(baseUrl: Env.backendUrl));

  final SupabaseClient _supabase;
  final Dio _dio;

  String? get _jwt => _supabase.auth.currentSession?.accessToken;

  @override
  Future<List<SearchResult>> searchGames(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return const [];

    final jwt = _jwt;
    if (jwt == null) return const [];

    final res = await _dio.get<List<dynamic>>(
      '/games/search',
      queryParameters: {'query': trimmed, 'limit': 10},
      options: Options(headers: {'Authorization': 'Bearer $jwt'}),
    );

    final data = res.data ?? const [];
    return data
        .map((row) => SearchResult.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<String> importGame(int igdbId) async {
    final jwt = _jwt;
    if (jwt == null) {
      throw StateError('Cannot import game: no active Supabase session.');
    }

    final res = await _dio.post<Map<String, dynamic>>(
      '/games/import',
      data: {'igdbId': igdbId},
      options: Options(headers: {'Authorization': 'Bearer $jwt'}),
    );

    // Backend returns { id, name, slug, cover_url, igdb_id } — we only need
    // the UUID here to hand off to LibraryRepository.addToLibrary.
    final id = res.data?['id'];
    if (id is! String) {
      throw StateError('Import response missing `id`: ${res.data}');
    }
    return id;
  }
}
