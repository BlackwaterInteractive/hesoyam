// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game_session.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

GameSession _$GameSessionFromJson(Map<String, dynamic> json) {
  return _GameSession.fromJson(json);
}

/// @nodoc
mixin _$GameSession {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: 'user_id')
  String get userId => throw _privateConstructorUsedError;
  @JsonKey(name: 'game_id')
  String? get gameId => throw _privateConstructorUsedError;
  @JsonKey(name: 'game_name')
  String? get gameName => throw _privateConstructorUsedError;
  String get source => throw _privateConstructorUsedError;
  @JsonKey(name: 'started_at')
  DateTime get startedAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'ended_at')
  DateTime? get endedAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'duration_secs')
  int get durationSecs => throw _privateConstructorUsedError;
  @JsonKey(name: 'active_secs')
  int get activeSecs => throw _privateConstructorUsedError;
  @JsonKey(name: 'idle_secs')
  int get idleSecs => throw _privateConstructorUsedError;

  /// Serializes this GameSession to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GameSession
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GameSessionCopyWith<GameSession> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GameSessionCopyWith<$Res> {
  factory $GameSessionCopyWith(
    GameSession value,
    $Res Function(GameSession) then,
  ) = _$GameSessionCopyWithImpl<$Res, GameSession>;
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'game_id') String? gameId,
    @JsonKey(name: 'game_name') String? gameName,
    String source,
    @JsonKey(name: 'started_at') DateTime startedAt,
    @JsonKey(name: 'ended_at') DateTime? endedAt,
    @JsonKey(name: 'duration_secs') int durationSecs,
    @JsonKey(name: 'active_secs') int activeSecs,
    @JsonKey(name: 'idle_secs') int idleSecs,
  });
}

/// @nodoc
class _$GameSessionCopyWithImpl<$Res, $Val extends GameSession>
    implements $GameSessionCopyWith<$Res> {
  _$GameSessionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GameSession
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? gameId = freezed,
    Object? gameName = freezed,
    Object? source = null,
    Object? startedAt = null,
    Object? endedAt = freezed,
    Object? durationSecs = null,
    Object? activeSecs = null,
    Object? idleSecs = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            userId: null == userId
                ? _value.userId
                : userId // ignore: cast_nullable_to_non_nullable
                      as String,
            gameId: freezed == gameId
                ? _value.gameId
                : gameId // ignore: cast_nullable_to_non_nullable
                      as String?,
            gameName: freezed == gameName
                ? _value.gameName
                : gameName // ignore: cast_nullable_to_non_nullable
                      as String?,
            source: null == source
                ? _value.source
                : source // ignore: cast_nullable_to_non_nullable
                      as String,
            startedAt: null == startedAt
                ? _value.startedAt
                : startedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
            endedAt: freezed == endedAt
                ? _value.endedAt
                : endedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            durationSecs: null == durationSecs
                ? _value.durationSecs
                : durationSecs // ignore: cast_nullable_to_non_nullable
                      as int,
            activeSecs: null == activeSecs
                ? _value.activeSecs
                : activeSecs // ignore: cast_nullable_to_non_nullable
                      as int,
            idleSecs: null == idleSecs
                ? _value.idleSecs
                : idleSecs // ignore: cast_nullable_to_non_nullable
                      as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$GameSessionImplCopyWith<$Res>
    implements $GameSessionCopyWith<$Res> {
  factory _$$GameSessionImplCopyWith(
    _$GameSessionImpl value,
    $Res Function(_$GameSessionImpl) then,
  ) = __$$GameSessionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'game_id') String? gameId,
    @JsonKey(name: 'game_name') String? gameName,
    String source,
    @JsonKey(name: 'started_at') DateTime startedAt,
    @JsonKey(name: 'ended_at') DateTime? endedAt,
    @JsonKey(name: 'duration_secs') int durationSecs,
    @JsonKey(name: 'active_secs') int activeSecs,
    @JsonKey(name: 'idle_secs') int idleSecs,
  });
}

/// @nodoc
class __$$GameSessionImplCopyWithImpl<$Res>
    extends _$GameSessionCopyWithImpl<$Res, _$GameSessionImpl>
    implements _$$GameSessionImplCopyWith<$Res> {
  __$$GameSessionImplCopyWithImpl(
    _$GameSessionImpl _value,
    $Res Function(_$GameSessionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of GameSession
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? gameId = freezed,
    Object? gameName = freezed,
    Object? source = null,
    Object? startedAt = null,
    Object? endedAt = freezed,
    Object? durationSecs = null,
    Object? activeSecs = null,
    Object? idleSecs = null,
  }) {
    return _then(
      _$GameSessionImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        gameId: freezed == gameId
            ? _value.gameId
            : gameId // ignore: cast_nullable_to_non_nullable
                  as String?,
        gameName: freezed == gameName
            ? _value.gameName
            : gameName // ignore: cast_nullable_to_non_nullable
                  as String?,
        source: null == source
            ? _value.source
            : source // ignore: cast_nullable_to_non_nullable
                  as String,
        startedAt: null == startedAt
            ? _value.startedAt
            : startedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        endedAt: freezed == endedAt
            ? _value.endedAt
            : endedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        durationSecs: null == durationSecs
            ? _value.durationSecs
            : durationSecs // ignore: cast_nullable_to_non_nullable
                  as int,
        activeSecs: null == activeSecs
            ? _value.activeSecs
            : activeSecs // ignore: cast_nullable_to_non_nullable
                  as int,
        idleSecs: null == idleSecs
            ? _value.idleSecs
            : idleSecs // ignore: cast_nullable_to_non_nullable
                  as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GameSessionImpl implements _GameSession {
  const _$GameSessionImpl({
    required this.id,
    @JsonKey(name: 'user_id') required this.userId,
    @JsonKey(name: 'game_id') this.gameId,
    @JsonKey(name: 'game_name') this.gameName,
    this.source = 'discord',
    @JsonKey(name: 'started_at') required this.startedAt,
    @JsonKey(name: 'ended_at') this.endedAt,
    @JsonKey(name: 'duration_secs') this.durationSecs = 0,
    @JsonKey(name: 'active_secs') this.activeSecs = 0,
    @JsonKey(name: 'idle_secs') this.idleSecs = 0,
  });

  factory _$GameSessionImpl.fromJson(Map<String, dynamic> json) =>
      _$$GameSessionImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey(name: 'user_id')
  final String userId;
  @override
  @JsonKey(name: 'game_id')
  final String? gameId;
  @override
  @JsonKey(name: 'game_name')
  final String? gameName;
  @override
  @JsonKey()
  final String source;
  @override
  @JsonKey(name: 'started_at')
  final DateTime startedAt;
  @override
  @JsonKey(name: 'ended_at')
  final DateTime? endedAt;
  @override
  @JsonKey(name: 'duration_secs')
  final int durationSecs;
  @override
  @JsonKey(name: 'active_secs')
  final int activeSecs;
  @override
  @JsonKey(name: 'idle_secs')
  final int idleSecs;

  @override
  String toString() {
    return 'GameSession(id: $id, userId: $userId, gameId: $gameId, gameName: $gameName, source: $source, startedAt: $startedAt, endedAt: $endedAt, durationSecs: $durationSecs, activeSecs: $activeSecs, idleSecs: $idleSecs)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GameSessionImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.gameId, gameId) || other.gameId == gameId) &&
            (identical(other.gameName, gameName) ||
                other.gameName == gameName) &&
            (identical(other.source, source) || other.source == source) &&
            (identical(other.startedAt, startedAt) ||
                other.startedAt == startedAt) &&
            (identical(other.endedAt, endedAt) || other.endedAt == endedAt) &&
            (identical(other.durationSecs, durationSecs) ||
                other.durationSecs == durationSecs) &&
            (identical(other.activeSecs, activeSecs) ||
                other.activeSecs == activeSecs) &&
            (identical(other.idleSecs, idleSecs) ||
                other.idleSecs == idleSecs));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    userId,
    gameId,
    gameName,
    source,
    startedAt,
    endedAt,
    durationSecs,
    activeSecs,
    idleSecs,
  );

  /// Create a copy of GameSession
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GameSessionImplCopyWith<_$GameSessionImpl> get copyWith =>
      __$$GameSessionImplCopyWithImpl<_$GameSessionImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GameSessionImplToJson(this);
  }
}

abstract class _GameSession implements GameSession {
  const factory _GameSession({
    required final String id,
    @JsonKey(name: 'user_id') required final String userId,
    @JsonKey(name: 'game_id') final String? gameId,
    @JsonKey(name: 'game_name') final String? gameName,
    final String source,
    @JsonKey(name: 'started_at') required final DateTime startedAt,
    @JsonKey(name: 'ended_at') final DateTime? endedAt,
    @JsonKey(name: 'duration_secs') final int durationSecs,
    @JsonKey(name: 'active_secs') final int activeSecs,
    @JsonKey(name: 'idle_secs') final int idleSecs,
  }) = _$GameSessionImpl;

  factory _GameSession.fromJson(Map<String, dynamic> json) =
      _$GameSessionImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: 'user_id')
  String get userId;
  @override
  @JsonKey(name: 'game_id')
  String? get gameId;
  @override
  @JsonKey(name: 'game_name')
  String? get gameName;
  @override
  String get source;
  @override
  @JsonKey(name: 'started_at')
  DateTime get startedAt;
  @override
  @JsonKey(name: 'ended_at')
  DateTime? get endedAt;
  @override
  @JsonKey(name: 'duration_secs')
  int get durationSecs;
  @override
  @JsonKey(name: 'active_secs')
  int get activeSecs;
  @override
  @JsonKey(name: 'idle_secs')
  int get idleSecs;

  /// Create a copy of GameSession
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GameSessionImplCopyWith<_$GameSessionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
