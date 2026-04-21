// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Game _$GameFromJson(Map<String, dynamic> json) {
  return _Game.fromJson(json);
}

/// @nodoc
mixin _$Game {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: 'igdb_id')
  int? get igdbId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get slug => throw _privateConstructorUsedError;
  @JsonKey(name: 'cover_url')
  String? get coverUrl => throw _privateConstructorUsedError;
  List<String>? get genres => throw _privateConstructorUsedError;
  String? get developer => throw _privateConstructorUsedError;
  String? get publisher => throw _privateConstructorUsedError;
  @JsonKey(name: 'release_year')
  int? get releaseYear => throw _privateConstructorUsedError;
  @JsonKey(name: 'artwork_url')
  String? get artworkUrl => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Serializes this Game to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Game
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GameCopyWith<Game> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GameCopyWith<$Res> {
  factory $GameCopyWith(Game value, $Res Function(Game) then) =
      _$GameCopyWithImpl<$Res, Game>;
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'igdb_id') int? igdbId,
    String name,
    String slug,
    @JsonKey(name: 'cover_url') String? coverUrl,
    List<String>? genres,
    String? developer,
    String? publisher,
    @JsonKey(name: 'release_year') int? releaseYear,
    @JsonKey(name: 'artwork_url') String? artworkUrl,
    @JsonKey(name: 'created_at') DateTime createdAt,
  });
}

/// @nodoc
class _$GameCopyWithImpl<$Res, $Val extends Game>
    implements $GameCopyWith<$Res> {
  _$GameCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Game
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? igdbId = freezed,
    Object? name = null,
    Object? slug = null,
    Object? coverUrl = freezed,
    Object? genres = freezed,
    Object? developer = freezed,
    Object? publisher = freezed,
    Object? releaseYear = freezed,
    Object? artworkUrl = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            igdbId: freezed == igdbId
                ? _value.igdbId
                : igdbId // ignore: cast_nullable_to_non_nullable
                      as int?,
            name: null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                      as String,
            slug: null == slug
                ? _value.slug
                : slug // ignore: cast_nullable_to_non_nullable
                      as String,
            coverUrl: freezed == coverUrl
                ? _value.coverUrl
                : coverUrl // ignore: cast_nullable_to_non_nullable
                      as String?,
            genres: freezed == genres
                ? _value.genres
                : genres // ignore: cast_nullable_to_non_nullable
                      as List<String>?,
            developer: freezed == developer
                ? _value.developer
                : developer // ignore: cast_nullable_to_non_nullable
                      as String?,
            publisher: freezed == publisher
                ? _value.publisher
                : publisher // ignore: cast_nullable_to_non_nullable
                      as String?,
            releaseYear: freezed == releaseYear
                ? _value.releaseYear
                : releaseYear // ignore: cast_nullable_to_non_nullable
                      as int?,
            artworkUrl: freezed == artworkUrl
                ? _value.artworkUrl
                : artworkUrl // ignore: cast_nullable_to_non_nullable
                      as String?,
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$GameImplCopyWith<$Res> implements $GameCopyWith<$Res> {
  factory _$$GameImplCopyWith(
    _$GameImpl value,
    $Res Function(_$GameImpl) then,
  ) = __$$GameImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'igdb_id') int? igdbId,
    String name,
    String slug,
    @JsonKey(name: 'cover_url') String? coverUrl,
    List<String>? genres,
    String? developer,
    String? publisher,
    @JsonKey(name: 'release_year') int? releaseYear,
    @JsonKey(name: 'artwork_url') String? artworkUrl,
    @JsonKey(name: 'created_at') DateTime createdAt,
  });
}

/// @nodoc
class __$$GameImplCopyWithImpl<$Res>
    extends _$GameCopyWithImpl<$Res, _$GameImpl>
    implements _$$GameImplCopyWith<$Res> {
  __$$GameImplCopyWithImpl(_$GameImpl _value, $Res Function(_$GameImpl) _then)
    : super(_value, _then);

  /// Create a copy of Game
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? igdbId = freezed,
    Object? name = null,
    Object? slug = null,
    Object? coverUrl = freezed,
    Object? genres = freezed,
    Object? developer = freezed,
    Object? publisher = freezed,
    Object? releaseYear = freezed,
    Object? artworkUrl = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _$GameImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        igdbId: freezed == igdbId
            ? _value.igdbId
            : igdbId // ignore: cast_nullable_to_non_nullable
                  as int?,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        slug: null == slug
            ? _value.slug
            : slug // ignore: cast_nullable_to_non_nullable
                  as String,
        coverUrl: freezed == coverUrl
            ? _value.coverUrl
            : coverUrl // ignore: cast_nullable_to_non_nullable
                  as String?,
        genres: freezed == genres
            ? _value._genres
            : genres // ignore: cast_nullable_to_non_nullable
                  as List<String>?,
        developer: freezed == developer
            ? _value.developer
            : developer // ignore: cast_nullable_to_non_nullable
                  as String?,
        publisher: freezed == publisher
            ? _value.publisher
            : publisher // ignore: cast_nullable_to_non_nullable
                  as String?,
        releaseYear: freezed == releaseYear
            ? _value.releaseYear
            : releaseYear // ignore: cast_nullable_to_non_nullable
                  as int?,
        artworkUrl: freezed == artworkUrl
            ? _value.artworkUrl
            : artworkUrl // ignore: cast_nullable_to_non_nullable
                  as String?,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GameImpl implements _Game {
  const _$GameImpl({
    required this.id,
    @JsonKey(name: 'igdb_id') this.igdbId,
    required this.name,
    required this.slug,
    @JsonKey(name: 'cover_url') this.coverUrl,
    final List<String>? genres,
    this.developer,
    this.publisher,
    @JsonKey(name: 'release_year') this.releaseYear,
    @JsonKey(name: 'artwork_url') this.artworkUrl,
    @JsonKey(name: 'created_at') required this.createdAt,
  }) : _genres = genres;

  factory _$GameImpl.fromJson(Map<String, dynamic> json) =>
      _$$GameImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey(name: 'igdb_id')
  final int? igdbId;
  @override
  final String name;
  @override
  final String slug;
  @override
  @JsonKey(name: 'cover_url')
  final String? coverUrl;
  final List<String>? _genres;
  @override
  List<String>? get genres {
    final value = _genres;
    if (value == null) return null;
    if (_genres is EqualUnmodifiableListView) return _genres;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  final String? developer;
  @override
  final String? publisher;
  @override
  @JsonKey(name: 'release_year')
  final int? releaseYear;
  @override
  @JsonKey(name: 'artwork_url')
  final String? artworkUrl;
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  @override
  String toString() {
    return 'Game(id: $id, igdbId: $igdbId, name: $name, slug: $slug, coverUrl: $coverUrl, genres: $genres, developer: $developer, publisher: $publisher, releaseYear: $releaseYear, artworkUrl: $artworkUrl, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GameImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.igdbId, igdbId) || other.igdbId == igdbId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.coverUrl, coverUrl) ||
                other.coverUrl == coverUrl) &&
            const DeepCollectionEquality().equals(other._genres, _genres) &&
            (identical(other.developer, developer) ||
                other.developer == developer) &&
            (identical(other.publisher, publisher) ||
                other.publisher == publisher) &&
            (identical(other.releaseYear, releaseYear) ||
                other.releaseYear == releaseYear) &&
            (identical(other.artworkUrl, artworkUrl) ||
                other.artworkUrl == artworkUrl) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    igdbId,
    name,
    slug,
    coverUrl,
    const DeepCollectionEquality().hash(_genres),
    developer,
    publisher,
    releaseYear,
    artworkUrl,
    createdAt,
  );

  /// Create a copy of Game
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GameImplCopyWith<_$GameImpl> get copyWith =>
      __$$GameImplCopyWithImpl<_$GameImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GameImplToJson(this);
  }
}

abstract class _Game implements Game {
  const factory _Game({
    required final String id,
    @JsonKey(name: 'igdb_id') final int? igdbId,
    required final String name,
    required final String slug,
    @JsonKey(name: 'cover_url') final String? coverUrl,
    final List<String>? genres,
    final String? developer,
    final String? publisher,
    @JsonKey(name: 'release_year') final int? releaseYear,
    @JsonKey(name: 'artwork_url') final String? artworkUrl,
    @JsonKey(name: 'created_at') required final DateTime createdAt,
  }) = _$GameImpl;

  factory _Game.fromJson(Map<String, dynamic> json) = _$GameImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: 'igdb_id')
  int? get igdbId;
  @override
  String get name;
  @override
  String get slug;
  @override
  @JsonKey(name: 'cover_url')
  String? get coverUrl;
  @override
  List<String>? get genres;
  @override
  String? get developer;
  @override
  String? get publisher;
  @override
  @JsonKey(name: 'release_year')
  int? get releaseYear;
  @override
  @JsonKey(name: 'artwork_url')
  String? get artworkUrl;
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Create a copy of Game
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GameImplCopyWith<_$GameImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
