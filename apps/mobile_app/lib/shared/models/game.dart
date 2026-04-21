import 'package:freezed_annotation/freezed_annotation.dart';

part 'game.freezed.dart';
part 'game.g.dart';

@freezed
class Game with _$Game {
  const factory Game({
    required String id,
    @JsonKey(name: 'igdb_id') int? igdbId,
    required String name,
    required String slug,
    @JsonKey(name: 'cover_url') String? coverUrl,
    List<String>? genres,
    String? developer,
    String? publisher,
    @JsonKey(name: 'release_year') int? releaseYear,
    @JsonKey(name: 'artwork_url') String? artworkUrl,
    @JsonKey(name: 'created_at') required DateTime createdAt,
  }) = _Game;

  factory Game.fromJson(Map<String, dynamic> json) => _$GameFromJson(json);
}
