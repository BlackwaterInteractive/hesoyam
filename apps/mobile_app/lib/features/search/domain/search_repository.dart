import '../../../shared/models/game.dart';

/// Abstract interface for game search operations.
abstract class SearchRepository {
  Future<List<Game>> searchGames(String query);
}
