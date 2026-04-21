// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'user_game.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

UserGame _$UserGameFromJson(Map<String, dynamic> json) {
  return _UserGame.fromJson(json);
}

/// @nodoc
mixin _$UserGame {
  @JsonKey(name: 'user_id')
  String get userId => throw _privateConstructorUsedError;
  @JsonKey(name: 'game_id')
  String get gameId => throw _privateConstructorUsedError;
  @JsonKey(name: 'total_time_secs')
  int get totalTimeSecs => throw _privateConstructorUsedError;
  @JsonKey(name: 'total_sessions')
  int get totalSessions => throw _privateConstructorUsedError;
  @JsonKey(name: 'avg_session_secs')
  int get avgSessionSecs => throw _privateConstructorUsedError;
  @JsonKey(name: 'first_played')
  DateTime? get firstPlayed => throw _privateConstructorUsedError;
  @JsonKey(name: 'last_played')
  DateTime? get lastPlayed => throw _privateConstructorUsedError;

  /// Serializes this UserGame to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UserGame
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UserGameCopyWith<UserGame> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UserGameCopyWith<$Res> {
  factory $UserGameCopyWith(UserGame value, $Res Function(UserGame) then) =
      _$UserGameCopyWithImpl<$Res, UserGame>;
  @useResult
  $Res call({
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'game_id') String gameId,
    @JsonKey(name: 'total_time_secs') int totalTimeSecs,
    @JsonKey(name: 'total_sessions') int totalSessions,
    @JsonKey(name: 'avg_session_secs') int avgSessionSecs,
    @JsonKey(name: 'first_played') DateTime? firstPlayed,
    @JsonKey(name: 'last_played') DateTime? lastPlayed,
  });
}

/// @nodoc
class _$UserGameCopyWithImpl<$Res, $Val extends UserGame>
    implements $UserGameCopyWith<$Res> {
  _$UserGameCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UserGame
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? userId = null,
    Object? gameId = null,
    Object? totalTimeSecs = null,
    Object? totalSessions = null,
    Object? avgSessionSecs = null,
    Object? firstPlayed = freezed,
    Object? lastPlayed = freezed,
  }) {
    return _then(
      _value.copyWith(
            userId: null == userId
                ? _value.userId
                : userId // ignore: cast_nullable_to_non_nullable
                      as String,
            gameId: null == gameId
                ? _value.gameId
                : gameId // ignore: cast_nullable_to_non_nullable
                      as String,
            totalTimeSecs: null == totalTimeSecs
                ? _value.totalTimeSecs
                : totalTimeSecs // ignore: cast_nullable_to_non_nullable
                      as int,
            totalSessions: null == totalSessions
                ? _value.totalSessions
                : totalSessions // ignore: cast_nullable_to_non_nullable
                      as int,
            avgSessionSecs: null == avgSessionSecs
                ? _value.avgSessionSecs
                : avgSessionSecs // ignore: cast_nullable_to_non_nullable
                      as int,
            firstPlayed: freezed == firstPlayed
                ? _value.firstPlayed
                : firstPlayed // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            lastPlayed: freezed == lastPlayed
                ? _value.lastPlayed
                : lastPlayed // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$UserGameImplCopyWith<$Res>
    implements $UserGameCopyWith<$Res> {
  factory _$$UserGameImplCopyWith(
    _$UserGameImpl value,
    $Res Function(_$UserGameImpl) then,
  ) = __$$UserGameImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'game_id') String gameId,
    @JsonKey(name: 'total_time_secs') int totalTimeSecs,
    @JsonKey(name: 'total_sessions') int totalSessions,
    @JsonKey(name: 'avg_session_secs') int avgSessionSecs,
    @JsonKey(name: 'first_played') DateTime? firstPlayed,
    @JsonKey(name: 'last_played') DateTime? lastPlayed,
  });
}

/// @nodoc
class __$$UserGameImplCopyWithImpl<$Res>
    extends _$UserGameCopyWithImpl<$Res, _$UserGameImpl>
    implements _$$UserGameImplCopyWith<$Res> {
  __$$UserGameImplCopyWithImpl(
    _$UserGameImpl _value,
    $Res Function(_$UserGameImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of UserGame
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? userId = null,
    Object? gameId = null,
    Object? totalTimeSecs = null,
    Object? totalSessions = null,
    Object? avgSessionSecs = null,
    Object? firstPlayed = freezed,
    Object? lastPlayed = freezed,
  }) {
    return _then(
      _$UserGameImpl(
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        gameId: null == gameId
            ? _value.gameId
            : gameId // ignore: cast_nullable_to_non_nullable
                  as String,
        totalTimeSecs: null == totalTimeSecs
            ? _value.totalTimeSecs
            : totalTimeSecs // ignore: cast_nullable_to_non_nullable
                  as int,
        totalSessions: null == totalSessions
            ? _value.totalSessions
            : totalSessions // ignore: cast_nullable_to_non_nullable
                  as int,
        avgSessionSecs: null == avgSessionSecs
            ? _value.avgSessionSecs
            : avgSessionSecs // ignore: cast_nullable_to_non_nullable
                  as int,
        firstPlayed: freezed == firstPlayed
            ? _value.firstPlayed
            : firstPlayed // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        lastPlayed: freezed == lastPlayed
            ? _value.lastPlayed
            : lastPlayed // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$UserGameImpl implements _UserGame {
  const _$UserGameImpl({
    @JsonKey(name: 'user_id') required this.userId,
    @JsonKey(name: 'game_id') required this.gameId,
    @JsonKey(name: 'total_time_secs') this.totalTimeSecs = 0,
    @JsonKey(name: 'total_sessions') this.totalSessions = 0,
    @JsonKey(name: 'avg_session_secs') this.avgSessionSecs = 0,
    @JsonKey(name: 'first_played') this.firstPlayed,
    @JsonKey(name: 'last_played') this.lastPlayed,
  });

  factory _$UserGameImpl.fromJson(Map<String, dynamic> json) =>
      _$$UserGameImplFromJson(json);

  @override
  @JsonKey(name: 'user_id')
  final String userId;
  @override
  @JsonKey(name: 'game_id')
  final String gameId;
  @override
  @JsonKey(name: 'total_time_secs')
  final int totalTimeSecs;
  @override
  @JsonKey(name: 'total_sessions')
  final int totalSessions;
  @override
  @JsonKey(name: 'avg_session_secs')
  final int avgSessionSecs;
  @override
  @JsonKey(name: 'first_played')
  final DateTime? firstPlayed;
  @override
  @JsonKey(name: 'last_played')
  final DateTime? lastPlayed;

  @override
  String toString() {
    return 'UserGame(userId: $userId, gameId: $gameId, totalTimeSecs: $totalTimeSecs, totalSessions: $totalSessions, avgSessionSecs: $avgSessionSecs, firstPlayed: $firstPlayed, lastPlayed: $lastPlayed)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UserGameImpl &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.gameId, gameId) || other.gameId == gameId) &&
            (identical(other.totalTimeSecs, totalTimeSecs) ||
                other.totalTimeSecs == totalTimeSecs) &&
            (identical(other.totalSessions, totalSessions) ||
                other.totalSessions == totalSessions) &&
            (identical(other.avgSessionSecs, avgSessionSecs) ||
                other.avgSessionSecs == avgSessionSecs) &&
            (identical(other.firstPlayed, firstPlayed) ||
                other.firstPlayed == firstPlayed) &&
            (identical(other.lastPlayed, lastPlayed) ||
                other.lastPlayed == lastPlayed));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    userId,
    gameId,
    totalTimeSecs,
    totalSessions,
    avgSessionSecs,
    firstPlayed,
    lastPlayed,
  );

  /// Create a copy of UserGame
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UserGameImplCopyWith<_$UserGameImpl> get copyWith =>
      __$$UserGameImplCopyWithImpl<_$UserGameImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UserGameImplToJson(this);
  }
}

abstract class _UserGame implements UserGame {
  const factory _UserGame({
    @JsonKey(name: 'user_id') required final String userId,
    @JsonKey(name: 'game_id') required final String gameId,
    @JsonKey(name: 'total_time_secs') final int totalTimeSecs,
    @JsonKey(name: 'total_sessions') final int totalSessions,
    @JsonKey(name: 'avg_session_secs') final int avgSessionSecs,
    @JsonKey(name: 'first_played') final DateTime? firstPlayed,
    @JsonKey(name: 'last_played') final DateTime? lastPlayed,
  }) = _$UserGameImpl;

  factory _UserGame.fromJson(Map<String, dynamic> json) =
      _$UserGameImpl.fromJson;

  @override
  @JsonKey(name: 'user_id')
  String get userId;
  @override
  @JsonKey(name: 'game_id')
  String get gameId;
  @override
  @JsonKey(name: 'total_time_secs')
  int get totalTimeSecs;
  @override
  @JsonKey(name: 'total_sessions')
  int get totalSessions;
  @override
  @JsonKey(name: 'avg_session_secs')
  int get avgSessionSecs;
  @override
  @JsonKey(name: 'first_played')
  DateTime? get firstPlayed;
  @override
  @JsonKey(name: 'last_played')
  DateTime? get lastPlayed;

  /// Create a copy of UserGame
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UserGameImplCopyWith<_$UserGameImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
