import '../../../shared/models/game.dart';
import '../../../shared/models/game_session.dart';
import '../../../shared/models/library_status.dart';
import '../../../shared/models/user_game.dart';

/// Abstract interface for game library operations.
abstract class LibraryRepository {
  Future<List<LibraryEntry>> getUserLibrary(String userId);
  Future<GameDetail> getGameDetail(String userId, String gameId);
  Future<void> addToLibrary(String userId, String gameId, LibraryStatus status);
  Future<void> removeFromLibrary(String userId, String gameId);
  Future<bool> isInLibrary(String userId, String gameId);
}

class LibraryEntry {
  const LibraryEntry({
    required this.userGame,
    required this.game,
    required this.status,
    this.addedAt,
  });
  final UserGame userGame;
  final Game game;
  final LibraryStatus status;

  /// When this row was added to `user_game_library`. Null only if the game
  /// somehow ended up in `user_games` without a matching library row — not
  /// expected given the `trg_auto_add_to_library` trigger.
  final DateTime? addedAt;
}

class GameDetail {
  const GameDetail({
    required this.game,
    this.userGame,
    required this.sessions,
  });
  final Game game;
  final UserGame? userGame;
  final List<GameSession> sessions;
}
