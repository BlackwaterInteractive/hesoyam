// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'search_result.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

SearchResult _$SearchResultFromJson(Map<String, dynamic> json) {
  return _SearchResult.fromJson(json);
}

/// @nodoc
mixin _$SearchResult {
  int get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get slug => throw _privateConstructorUsedError;
  IgdbCover? get cover => throw _privateConstructorUsedError;
  List<IgdbGenre>? get genres => throw _privateConstructorUsedError;
  @JsonKey(name: 'first_release_date')
  int? get firstReleaseDate => throw _privateConstructorUsedError;

  /// Serializes this SearchResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SearchResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SearchResultCopyWith<SearchResult> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SearchResultCopyWith<$Res> {
  factory $SearchResultCopyWith(
    SearchResult value,
    $Res Function(SearchResult) then,
  ) = _$SearchResultCopyWithImpl<$Res, SearchResult>;
  @useResult
  $Res call({
    int id,
    String name,
    String? slug,
    IgdbCover? cover,
    List<IgdbGenre>? genres,
    @JsonKey(name: 'first_release_date') int? firstReleaseDate,
  });

  $IgdbCoverCopyWith<$Res>? get cover;
}

/// @nodoc
class _$SearchResultCopyWithImpl<$Res, $Val extends SearchResult>
    implements $SearchResultCopyWith<$Res> {
  _$SearchResultCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SearchResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? slug = freezed,
    Object? cover = freezed,
    Object? genres = freezed,
    Object? firstReleaseDate = freezed,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as int,
            name: null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                      as String,
            slug: freezed == slug
                ? _value.slug
                : slug // ignore: cast_nullable_to_non_nullable
                      as String?,
            cover: freezed == cover
                ? _value.cover
                : cover // ignore: cast_nullable_to_non_nullable
                      as IgdbCover?,
            genres: freezed == genres
                ? _value.genres
                : genres // ignore: cast_nullable_to_non_nullable
                      as List<IgdbGenre>?,
            firstReleaseDate: freezed == firstReleaseDate
                ? _value.firstReleaseDate
                : firstReleaseDate // ignore: cast_nullable_to_non_nullable
                      as int?,
          )
          as $Val,
    );
  }

  /// Create a copy of SearchResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $IgdbCoverCopyWith<$Res>? get cover {
    if (_value.cover == null) {
      return null;
    }

    return $IgdbCoverCopyWith<$Res>(_value.cover!, (value) {
      return _then(_value.copyWith(cover: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SearchResultImplCopyWith<$Res>
    implements $SearchResultCopyWith<$Res> {
  factory _$$SearchResultImplCopyWith(
    _$SearchResultImpl value,
    $Res Function(_$SearchResultImpl) then,
  ) = __$$SearchResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    int id,
    String name,
    String? slug,
    IgdbCover? cover,
    List<IgdbGenre>? genres,
    @JsonKey(name: 'first_release_date') int? firstReleaseDate,
  });

  @override
  $IgdbCoverCopyWith<$Res>? get cover;
}

/// @nodoc
class __$$SearchResultImplCopyWithImpl<$Res>
    extends _$SearchResultCopyWithImpl<$Res, _$SearchResultImpl>
    implements _$$SearchResultImplCopyWith<$Res> {
  __$$SearchResultImplCopyWithImpl(
    _$SearchResultImpl _value,
    $Res Function(_$SearchResultImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SearchResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? slug = freezed,
    Object? cover = freezed,
    Object? genres = freezed,
    Object? firstReleaseDate = freezed,
  }) {
    return _then(
      _$SearchResultImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as int,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        slug: freezed == slug
            ? _value.slug
            : slug // ignore: cast_nullable_to_non_nullable
                  as String?,
        cover: freezed == cover
            ? _value.cover
            : cover // ignore: cast_nullable_to_non_nullable
                  as IgdbCover?,
        genres: freezed == genres
            ? _value._genres
            : genres // ignore: cast_nullable_to_non_nullable
                  as List<IgdbGenre>?,
        firstReleaseDate: freezed == firstReleaseDate
            ? _value.firstReleaseDate
            : firstReleaseDate // ignore: cast_nullable_to_non_nullable
                  as int?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$SearchResultImpl extends _SearchResult {
  const _$SearchResultImpl({
    required this.id,
    required this.name,
    this.slug,
    this.cover,
    final List<IgdbGenre>? genres,
    @JsonKey(name: 'first_release_date') this.firstReleaseDate,
  }) : _genres = genres,
       super._();

  factory _$SearchResultImpl.fromJson(Map<String, dynamic> json) =>
      _$$SearchResultImplFromJson(json);

  @override
  final int id;
  @override
  final String name;
  @override
  final String? slug;
  @override
  final IgdbCover? cover;
  final List<IgdbGenre>? _genres;
  @override
  List<IgdbGenre>? get genres {
    final value = _genres;
    if (value == null) return null;
    if (_genres is EqualUnmodifiableListView) return _genres;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  @JsonKey(name: 'first_release_date')
  final int? firstReleaseDate;

  @override
  String toString() {
    return 'SearchResult(id: $id, name: $name, slug: $slug, cover: $cover, genres: $genres, firstReleaseDate: $firstReleaseDate)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SearchResultImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.cover, cover) || other.cover == cover) &&
            const DeepCollectionEquality().equals(other._genres, _genres) &&
            (identical(other.firstReleaseDate, firstReleaseDate) ||
                other.firstReleaseDate == firstReleaseDate));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    name,
    slug,
    cover,
    const DeepCollectionEquality().hash(_genres),
    firstReleaseDate,
  );

  /// Create a copy of SearchResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SearchResultImplCopyWith<_$SearchResultImpl> get copyWith =>
      __$$SearchResultImplCopyWithImpl<_$SearchResultImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SearchResultImplToJson(this);
  }
}

abstract class _SearchResult extends SearchResult {
  const factory _SearchResult({
    required final int id,
    required final String name,
    final String? slug,
    final IgdbCover? cover,
    final List<IgdbGenre>? genres,
    @JsonKey(name: 'first_release_date') final int? firstReleaseDate,
  }) = _$SearchResultImpl;
  const _SearchResult._() : super._();

  factory _SearchResult.fromJson(Map<String, dynamic> json) =
      _$SearchResultImpl.fromJson;

  @override
  int get id;
  @override
  String get name;
  @override
  String? get slug;
  @override
  IgdbCover? get cover;
  @override
  List<IgdbGenre>? get genres;
  @override
  @JsonKey(name: 'first_release_date')
  int? get firstReleaseDate;

  /// Create a copy of SearchResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SearchResultImplCopyWith<_$SearchResultImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

IgdbCover _$IgdbCoverFromJson(Map<String, dynamic> json) {
  return _IgdbCover.fromJson(json);
}

/// @nodoc
mixin _$IgdbCover {
  @JsonKey(name: 'image_id')
  String? get imageId => throw _privateConstructorUsedError;

  /// Serializes this IgdbCover to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of IgdbCover
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $IgdbCoverCopyWith<IgdbCover> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $IgdbCoverCopyWith<$Res> {
  factory $IgdbCoverCopyWith(IgdbCover value, $Res Function(IgdbCover) then) =
      _$IgdbCoverCopyWithImpl<$Res, IgdbCover>;
  @useResult
  $Res call({@JsonKey(name: 'image_id') String? imageId});
}

/// @nodoc
class _$IgdbCoverCopyWithImpl<$Res, $Val extends IgdbCover>
    implements $IgdbCoverCopyWith<$Res> {
  _$IgdbCoverCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of IgdbCover
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? imageId = freezed}) {
    return _then(
      _value.copyWith(
            imageId: freezed == imageId
                ? _value.imageId
                : imageId // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$IgdbCoverImplCopyWith<$Res>
    implements $IgdbCoverCopyWith<$Res> {
  factory _$$IgdbCoverImplCopyWith(
    _$IgdbCoverImpl value,
    $Res Function(_$IgdbCoverImpl) then,
  ) = __$$IgdbCoverImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({@JsonKey(name: 'image_id') String? imageId});
}

/// @nodoc
class __$$IgdbCoverImplCopyWithImpl<$Res>
    extends _$IgdbCoverCopyWithImpl<$Res, _$IgdbCoverImpl>
    implements _$$IgdbCoverImplCopyWith<$Res> {
  __$$IgdbCoverImplCopyWithImpl(
    _$IgdbCoverImpl _value,
    $Res Function(_$IgdbCoverImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of IgdbCover
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? imageId = freezed}) {
    return _then(
      _$IgdbCoverImpl(
        imageId: freezed == imageId
            ? _value.imageId
            : imageId // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$IgdbCoverImpl implements _IgdbCover {
  const _$IgdbCoverImpl({@JsonKey(name: 'image_id') this.imageId});

  factory _$IgdbCoverImpl.fromJson(Map<String, dynamic> json) =>
      _$$IgdbCoverImplFromJson(json);

  @override
  @JsonKey(name: 'image_id')
  final String? imageId;

  @override
  String toString() {
    return 'IgdbCover(imageId: $imageId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$IgdbCoverImpl &&
            (identical(other.imageId, imageId) || other.imageId == imageId));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, imageId);

  /// Create a copy of IgdbCover
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$IgdbCoverImplCopyWith<_$IgdbCoverImpl> get copyWith =>
      __$$IgdbCoverImplCopyWithImpl<_$IgdbCoverImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$IgdbCoverImplToJson(this);
  }
}

abstract class _IgdbCover implements IgdbCover {
  const factory _IgdbCover({@JsonKey(name: 'image_id') final String? imageId}) =
      _$IgdbCoverImpl;

  factory _IgdbCover.fromJson(Map<String, dynamic> json) =
      _$IgdbCoverImpl.fromJson;

  @override
  @JsonKey(name: 'image_id')
  String? get imageId;

  /// Create a copy of IgdbCover
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$IgdbCoverImplCopyWith<_$IgdbCoverImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

IgdbGenre _$IgdbGenreFromJson(Map<String, dynamic> json) {
  return _IgdbGenre.fromJson(json);
}

/// @nodoc
mixin _$IgdbGenre {
  String? get name => throw _privateConstructorUsedError;

  /// Serializes this IgdbGenre to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of IgdbGenre
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $IgdbGenreCopyWith<IgdbGenre> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $IgdbGenreCopyWith<$Res> {
  factory $IgdbGenreCopyWith(IgdbGenre value, $Res Function(IgdbGenre) then) =
      _$IgdbGenreCopyWithImpl<$Res, IgdbGenre>;
  @useResult
  $Res call({String? name});
}

/// @nodoc
class _$IgdbGenreCopyWithImpl<$Res, $Val extends IgdbGenre>
    implements $IgdbGenreCopyWith<$Res> {
  _$IgdbGenreCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of IgdbGenre
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? name = freezed}) {
    return _then(
      _value.copyWith(
            name: freezed == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$IgdbGenreImplCopyWith<$Res>
    implements $IgdbGenreCopyWith<$Res> {
  factory _$$IgdbGenreImplCopyWith(
    _$IgdbGenreImpl value,
    $Res Function(_$IgdbGenreImpl) then,
  ) = __$$IgdbGenreImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String? name});
}

/// @nodoc
class __$$IgdbGenreImplCopyWithImpl<$Res>
    extends _$IgdbGenreCopyWithImpl<$Res, _$IgdbGenreImpl>
    implements _$$IgdbGenreImplCopyWith<$Res> {
  __$$IgdbGenreImplCopyWithImpl(
    _$IgdbGenreImpl _value,
    $Res Function(_$IgdbGenreImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of IgdbGenre
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? name = freezed}) {
    return _then(
      _$IgdbGenreImpl(
        name: freezed == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$IgdbGenreImpl implements _IgdbGenre {
  const _$IgdbGenreImpl({this.name});

  factory _$IgdbGenreImpl.fromJson(Map<String, dynamic> json) =>
      _$$IgdbGenreImplFromJson(json);

  @override
  final String? name;

  @override
  String toString() {
    return 'IgdbGenre(name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$IgdbGenreImpl &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, name);

  /// Create a copy of IgdbGenre
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$IgdbGenreImplCopyWith<_$IgdbGenreImpl> get copyWith =>
      __$$IgdbGenreImplCopyWithImpl<_$IgdbGenreImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$IgdbGenreImplToJson(this);
  }
}

abstract class _IgdbGenre implements IgdbGenre {
  const factory _IgdbGenre({final String? name}) = _$IgdbGenreImpl;

  factory _IgdbGenre.fromJson(Map<String, dynamic> json) =
      _$IgdbGenreImpl.fromJson;

  @override
  String? get name;

  /// Create a copy of IgdbGenre
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$IgdbGenreImplCopyWith<_$IgdbGenreImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
