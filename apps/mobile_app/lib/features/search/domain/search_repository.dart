import '../../../shared/models/search_result.dart';

/// Abstract interface for game search + catalog import operations.
abstract class SearchRepository {
  /// Search IGDB via the backend `GET /games/search` endpoint.
  /// Returns IGDB-shaped results — these rows are NOT yet in our DB.
  Future<List<SearchResult>> searchGames(String query);

  /// Import an IGDB game into the RAID catalog via `POST /games/import`
  /// and return its DB UUID. Idempotent — repeated imports of the same
  /// [igdbId] return the same UUID. Pass this UUID to
  /// `LibraryRepository.addToLibrary` to add the game to a user's library.
  Future<String> importGame(int igdbId);
}
