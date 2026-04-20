import '../../../shared/models/game.dart';
import '../../../shared/models/game_session.dart';
import '../../../shared/models/user_game.dart';

/// Abstract interface for game library operations.
abstract class LibraryRepository {
  Future<List<LibraryEntry>> getUserLibrary(String userId);
  Future<GameDetail> getGameDetail(String userId, String gameId);
  Future<void> addToLibrary(String userId, String gameId);
  Future<void> removeFromLibrary(String userId, String gameId);
  Future<bool> isInLibrary(String userId, String gameId);
}

class LibraryEntry {
  const LibraryEntry({required this.userGame, required this.game});
  final UserGame userGame;
  final Game game;
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
