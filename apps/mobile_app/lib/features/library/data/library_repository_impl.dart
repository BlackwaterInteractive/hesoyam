import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/game.dart';
import '../../../shared/models/game_session.dart';
import '../../../shared/models/user_game.dart';
import '../domain/library_repository.dart';

class LibraryRepositoryImpl implements LibraryRepository {
  LibraryRepositoryImpl(this._client);

  final SupabaseClient _client;

  @override
  Future<List<LibraryEntry>> getUserLibrary(String userId) async {
    // PRD §5.2: Library shows auto-tracked (user_games) + manually added (user_game_library)
    final results = await Future.wait([
      _client
          .from('user_games')
          .select('*, games(*)')
          .eq('user_id', userId)
          .order('total_time_secs', ascending: false),
      _client
          .from('user_game_library')
          .select('*, games(*)')
          .eq('user_id', userId)
          .order('added_at', ascending: false),
    ]);

    final trackedData = results[0] as List;
    final manualData = results[1] as List;

    // Tracked games (have play stats)
    final entries = trackedData.map((row) {
      final gameData = row['games'] as Map<String, dynamic>;
      final userGameMap = Map<String, dynamic>.from(row)..remove('games');
      return LibraryEntry(
        userGame: UserGame.fromJson(userGameMap),
        game: Game.fromJson(gameData),
      );
    }).toList();

    // Manually added games (no play stats) — skip if already in tracked
    final trackedGameIds = entries.map((e) => e.game.id).toSet();
    for (final row in manualData) {
      final gameData = row['games'] as Map<String, dynamic>?;
      if (gameData == null) continue;
      final game = Game.fromJson(gameData);
      if (trackedGameIds.contains(game.id)) continue;

      entries.add(LibraryEntry(
        userGame: UserGame(
          userId: userId,
          gameId: game.id,
        ),
        game: game,
      ));
    }

    return entries;
  }

  @override
  Future<GameDetail> getGameDetail(String userId, String gameId) async {
    // Fetch game, user_game, and sessions in parallel
    final results = await Future.wait([
      _client.from('games').select().eq('id', gameId).single(),
      _client
          .from('user_games')
          .select()
          .eq('user_id', userId)
          .eq('game_id', gameId)
          .maybeSingle(),
      _client
          .from('game_sessions')
          .select()
          .eq('user_id', userId)
          .eq('game_id', gameId)
          .not('ended_at', 'is', null)
          .order('started_at', ascending: false)
          .limit(20),
    ]);

    final gameData = results[0] as Map<String, dynamic>;
    final userGameData = results[1] as Map<String, dynamic>?;
    final sessionsData = results[2] as List;

    return GameDetail(
      game: Game.fromJson(gameData),
      userGame:
          userGameData != null ? UserGame.fromJson(userGameData) : null,
      sessions: sessionsData
          .map((s) => GameSession.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }

  @override
  Future<void> addToLibrary(String userId, String gameId) async {
    await _client.from('user_game_library').insert({
      'user_id': userId,
      'game_id': gameId,
      'status': 'want_to_play',
    });
  }

  @override
  Future<void> removeFromLibrary(String userId, String gameId) async {
    await _client
        .from('user_game_library')
        .delete()
        .eq('user_id', userId)
        .eq('game_id', gameId);
  }

  @override
  Future<bool> isInLibrary(String userId, String gameId) async {
    final data = await _client
        .from('user_game_library')
        .select('id')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .maybeSingle();

    return data != null;
  }
}
