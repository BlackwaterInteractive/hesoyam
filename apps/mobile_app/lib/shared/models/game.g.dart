// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'game.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GameImpl _$$GameImplFromJson(Map<String, dynamic> json) => _$GameImpl(
  id: json['id'] as String,
  igdbId: (json['igdb_id'] as num?)?.toInt(),
  name: json['name'] as String,
  slug: json['slug'] as String,
  coverUrl: json['cover_url'] as String?,
  genres: (json['genres'] as List<dynamic>?)?.map((e) => e as String).toList(),
  developer: json['developer'] as String?,
  publisher: json['publisher'] as String?,
  releaseYear: (json['release_year'] as num?)?.toInt(),
  artworkUrl: json['artwork_url'] as String?,
  createdAt: DateTime.parse(json['created_at'] as String),
);

Map<String, dynamic> _$$GameImplToJson(_$GameImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'igdb_id': instance.igdbId,
      'name': instance.name,
      'slug': instance.slug,
      'cover_url': instance.coverUrl,
      'genres': instance.genres,
      'developer': instance.developer,
      'publisher': instance.publisher,
      'release_year': instance.releaseYear,
      'artwork_url': instance.artworkUrl,
      'created_at': instance.createdAt.toIso8601String(),
    };
