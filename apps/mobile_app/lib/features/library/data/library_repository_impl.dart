import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/game.dart';
import '../../../shared/models/game_session.dart';
import '../../../shared/models/library_status.dart';
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

    // Build a { gameId -> (status, addedAt) } map from user_game_library so
    // we can attach the user's chosen status AND the added-at timestamp to
    // every entry. Auto-tracked rows get a library row too via the
    // `trg_auto_add_to_library` trigger on game_sessions INSERT.
    final libraryMetaByGameId = <String, ({LibraryStatus status, DateTime? addedAt})>{};
    for (final row in manualData) {
      final gameData = row['games'] as Map<String, dynamic>?;
      if (gameData == null) continue;
      final gameId = gameData['id'] as String?;
      final rawStatus = row['status'] as String?;
      if (gameId == null || rawStatus == null) continue;
      final rawAddedAt = row['added_at'] as String?;
      libraryMetaByGameId[gameId] = (
        status: LibraryStatus.fromValue(rawStatus),
        addedAt: rawAddedAt != null ? DateTime.tryParse(rawAddedAt) : null,
      );
    }

    // Tracked games (have play stats). Status + addedAt come from user_game_library.
    final entries = trackedData.map((row) {
      final gameData = row['games'] as Map<String, dynamic>;
      final userGameMap = Map<String, dynamic>.from(row)..remove('games');
      final game = Game.fromJson(gameData);
      final meta = libraryMetaByGameId[game.id];
      return LibraryEntry(
        userGame: UserGame.fromJson(userGameMap),
        game: game,
        status: meta?.status ?? LibraryStatus.played,
        addedAt: meta?.addedAt,
      );
    }).toList();

    // Manually added games (no play stats) — skip if already in tracked.
    final trackedGameIds = entries.map((e) => e.game.id).toSet();
    for (final row in manualData) {
      final gameData = row['games'] as Map<String, dynamic>?;
      if (gameData == null) continue;
      final game = Game.fromJson(gameData);
      if (trackedGameIds.contains(game.id)) continue;

      final rawStatus = row['status'] as String?;
      final rawAddedAt = row['added_at'] as String?;
      entries.add(LibraryEntry(
        userGame: UserGame(
          userId: userId,
          gameId: game.id,
        ),
        game: game,
        status: rawStatus != null
            ? LibraryStatus.fromValue(rawStatus)
            : LibraryStatus.wantToPlay,
        addedAt: rawAddedAt != null ? DateTime.tryParse(rawAddedAt) : null,
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
  Future<void> addToLibrary(
    String userId,
    String gameId,
    LibraryStatus status,
  ) async {
    await _client.from('user_game_library').insert({
      'user_id': userId,
      'game_id': gameId,
      'status': status.value,
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
