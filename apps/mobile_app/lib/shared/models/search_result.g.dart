// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'search_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SearchResultImpl _$$SearchResultImplFromJson(Map<String, dynamic> json) =>
    _$SearchResultImpl(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      slug: json['slug'] as String?,
      cover: json['cover'] == null
          ? null
          : IgdbCover.fromJson(json['cover'] as Map<String, dynamic>),
      genres: (json['genres'] as List<dynamic>?)
          ?.map((e) => IgdbGenre.fromJson(e as Map<String, dynamic>))
          .toList(),
      firstReleaseDate: (json['first_release_date'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$SearchResultImplToJson(_$SearchResultImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'cover': instance.cover,
      'genres': instance.genres,
      'first_release_date': instance.firstReleaseDate,
    };

_$IgdbCoverImpl _$$IgdbCoverImplFromJson(Map<String, dynamic> json) =>
    _$IgdbCoverImpl(imageId: json['image_id'] as String?);

Map<String, dynamic> _$$IgdbCoverImplToJson(_$IgdbCoverImpl instance) =>
    <String, dynamic>{'image_id': instance.imageId};

_$IgdbGenreImpl _$$IgdbGenreImplFromJson(Map<String, dynamic> json) =>
    _$IgdbGenreImpl(name: json['name'] as String?);

Map<String, dynamic> _$$IgdbGenreImplToJson(_$IgdbGenreImpl instance) =>
    <String, dynamic>{'name': instance.name};
