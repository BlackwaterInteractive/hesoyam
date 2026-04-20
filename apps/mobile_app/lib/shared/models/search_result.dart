import 'package:freezed_annotation/freezed_annotation.dart';

part 'search_result.freezed.dart';
part 'search_result.g.dart';

/// IGDB-shaped search result from `GET /games/search`.
///
/// Distinct from `Game` (our DB shape) because IGDB returns an integer `id`
/// and omits fields our DB stores (`created_at`, UUID `id`, etc.). After the
/// user taps "+ Add", call `POST /games/import` with the [id] below to
/// convert this into a `Game` row with a real UUID.
@freezed
class SearchResult with _$SearchResult {
  const SearchResult._();

  const factory SearchResult({
    required int id,
    required String name,
    String? slug,
    IgdbCover? cover,
    List<IgdbGenre>? genres,
    @JsonKey(name: 'first_release_date') int? firstReleaseDate,
  }) = _SearchResult;

  factory SearchResult.fromJson(Map<String, dynamic> json) =>
      _$SearchResultFromJson(json);

  /// Full-size cover URL from IGDB's image CDN, or null if this game
  /// doesn't have a cover in IGDB yet.
  String? get coverUrl => cover?.imageId == null
      ? null
      : 'https://images.igdb.com/igdb/image/upload/t_cover_big/${cover!.imageId}.jpg';

  /// Year derived from IGDB's Unix release timestamp.
  int? get releaseYear => firstReleaseDate == null
      ? null
      : DateTime.fromMillisecondsSinceEpoch(firstReleaseDate! * 1000).year;

  /// Flattened genre names — `genres` is a list of `{ name: "..." }` objects
  /// from IGDB and the UI only needs the names.
  List<String> get genreNames =>
      genres?.map((g) => g.name).whereType<String>().toList() ?? const [];
}

@freezed
class IgdbCover with _$IgdbCover {
  const factory IgdbCover({
    @JsonKey(name: 'image_id') String? imageId,
  }) = _IgdbCover;

  factory IgdbCover.fromJson(Map<String, dynamic> json) =>
      _$IgdbCoverFromJson(json);
}

@freezed
class IgdbGenre with _$IgdbGenre {
  const factory IgdbGenre({
    String? name,
  }) = _IgdbGenre;

  factory IgdbGenre.fromJson(Map<String, dynamic> json) =>
      _$IgdbGenreFromJson(json);
}
