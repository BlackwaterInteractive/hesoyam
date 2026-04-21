// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_stats.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DashboardStats _$DashboardStatsFromJson(Map<String, dynamic> json) {
  return _DashboardStats.fromJson(json);
}

/// @nodoc
mixin _$DashboardStats {
  PeriodStats get today => throw _privateConstructorUsedError;
  @JsonKey(name: 'this_week')
  PeriodStats get thisWeek => throw _privateConstructorUsedError;
  @JsonKey(name: 'this_month')
  PeriodStats get thisMonth => throw _privateConstructorUsedError;

  /// Serializes this DashboardStats to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardStatsCopyWith<DashboardStats> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardStatsCopyWith<$Res> {
  factory $DashboardStatsCopyWith(
    DashboardStats value,
    $Res Function(DashboardStats) then,
  ) = _$DashboardStatsCopyWithImpl<$Res, DashboardStats>;
  @useResult
  $Res call({
    PeriodStats today,
    @JsonKey(name: 'this_week') PeriodStats thisWeek,
    @JsonKey(name: 'this_month') PeriodStats thisMonth,
  });

  $PeriodStatsCopyWith<$Res> get today;
  $PeriodStatsCopyWith<$Res> get thisWeek;
  $PeriodStatsCopyWith<$Res> get thisMonth;
}

/// @nodoc
class _$DashboardStatsCopyWithImpl<$Res, $Val extends DashboardStats>
    implements $DashboardStatsCopyWith<$Res> {
  _$DashboardStatsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? today = null,
    Object? thisWeek = null,
    Object? thisMonth = null,
  }) {
    return _then(
      _value.copyWith(
            today: null == today
                ? _value.today
                : today // ignore: cast_nullable_to_non_nullable
                      as PeriodStats,
            thisWeek: null == thisWeek
                ? _value.thisWeek
                : thisWeek // ignore: cast_nullable_to_non_nullable
                      as PeriodStats,
            thisMonth: null == thisMonth
                ? _value.thisMonth
                : thisMonth // ignore: cast_nullable_to_non_nullable
                      as PeriodStats,
          )
          as $Val,
    );
  }

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PeriodStatsCopyWith<$Res> get today {
    return $PeriodStatsCopyWith<$Res>(_value.today, (value) {
      return _then(_value.copyWith(today: value) as $Val);
    });
  }

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PeriodStatsCopyWith<$Res> get thisWeek {
    return $PeriodStatsCopyWith<$Res>(_value.thisWeek, (value) {
      return _then(_value.copyWith(thisWeek: value) as $Val);
    });
  }

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PeriodStatsCopyWith<$Res> get thisMonth {
    return $PeriodStatsCopyWith<$Res>(_value.thisMonth, (value) {
      return _then(_value.copyWith(thisMonth: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardStatsImplCopyWith<$Res>
    implements $DashboardStatsCopyWith<$Res> {
  factory _$$DashboardStatsImplCopyWith(
    _$DashboardStatsImpl value,
    $Res Function(_$DashboardStatsImpl) then,
  ) = __$$DashboardStatsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    PeriodStats today,
    @JsonKey(name: 'this_week') PeriodStats thisWeek,
    @JsonKey(name: 'this_month') PeriodStats thisMonth,
  });

  @override
  $PeriodStatsCopyWith<$Res> get today;
  @override
  $PeriodStatsCopyWith<$Res> get thisWeek;
  @override
  $PeriodStatsCopyWith<$Res> get thisMonth;
}

/// @nodoc
class __$$DashboardStatsImplCopyWithImpl<$Res>
    extends _$DashboardStatsCopyWithImpl<$Res, _$DashboardStatsImpl>
    implements _$$DashboardStatsImplCopyWith<$Res> {
  __$$DashboardStatsImplCopyWithImpl(
    _$DashboardStatsImpl _value,
    $Res Function(_$DashboardStatsImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? today = null,
    Object? thisWeek = null,
    Object? thisMonth = null,
  }) {
    return _then(
      _$DashboardStatsImpl(
        today: null == today
            ? _value.today
            : today // ignore: cast_nullable_to_non_nullable
                  as PeriodStats,
        thisWeek: null == thisWeek
            ? _value.thisWeek
            : thisWeek // ignore: cast_nullable_to_non_nullable
                  as PeriodStats,
        thisMonth: null == thisMonth
            ? _value.thisMonth
            : thisMonth // ignore: cast_nullable_to_non_nullable
                  as PeriodStats,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardStatsImpl implements _DashboardStats {
  const _$DashboardStatsImpl({
    required this.today,
    @JsonKey(name: 'this_week') required this.thisWeek,
    @JsonKey(name: 'this_month') required this.thisMonth,
  });

  factory _$DashboardStatsImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardStatsImplFromJson(json);

  @override
  final PeriodStats today;
  @override
  @JsonKey(name: 'this_week')
  final PeriodStats thisWeek;
  @override
  @JsonKey(name: 'this_month')
  final PeriodStats thisMonth;

  @override
  String toString() {
    return 'DashboardStats(today: $today, thisWeek: $thisWeek, thisMonth: $thisMonth)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardStatsImpl &&
            (identical(other.today, today) || other.today == today) &&
            (identical(other.thisWeek, thisWeek) ||
                other.thisWeek == thisWeek) &&
            (identical(other.thisMonth, thisMonth) ||
                other.thisMonth == thisMonth));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, today, thisWeek, thisMonth);

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardStatsImplCopyWith<_$DashboardStatsImpl> get copyWith =>
      __$$DashboardStatsImplCopyWithImpl<_$DashboardStatsImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardStatsImplToJson(this);
  }
}

abstract class _DashboardStats implements DashboardStats {
  const factory _DashboardStats({
    required final PeriodStats today,
    @JsonKey(name: 'this_week') required final PeriodStats thisWeek,
    @JsonKey(name: 'this_month') required final PeriodStats thisMonth,
  }) = _$DashboardStatsImpl;

  factory _DashboardStats.fromJson(Map<String, dynamic> json) =
      _$DashboardStatsImpl.fromJson;

  @override
  PeriodStats get today;
  @override
  @JsonKey(name: 'this_week')
  PeriodStats get thisWeek;
  @override
  @JsonKey(name: 'this_month')
  PeriodStats get thisMonth;

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardStatsImplCopyWith<_$DashboardStatsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PeriodStats _$PeriodStatsFromJson(Map<String, dynamic> json) {
  return _PeriodStats.fromJson(json);
}

/// @nodoc
mixin _$PeriodStats {
  @JsonKey(name: 'total_secs')
  int get totalSecs => throw _privateConstructorUsedError;
  @JsonKey(name: 'game_count')
  int get gameCount => throw _privateConstructorUsedError;

  /// Serializes this PeriodStats to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PeriodStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PeriodStatsCopyWith<PeriodStats> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PeriodStatsCopyWith<$Res> {
  factory $PeriodStatsCopyWith(
    PeriodStats value,
    $Res Function(PeriodStats) then,
  ) = _$PeriodStatsCopyWithImpl<$Res, PeriodStats>;
  @useResult
  $Res call({
    @JsonKey(name: 'total_secs') int totalSecs,
    @JsonKey(name: 'game_count') int gameCount,
  });
}

/// @nodoc
class _$PeriodStatsCopyWithImpl<$Res, $Val extends PeriodStats>
    implements $PeriodStatsCopyWith<$Res> {
  _$PeriodStatsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PeriodStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? totalSecs = null, Object? gameCount = null}) {
    return _then(
      _value.copyWith(
            totalSecs: null == totalSecs
                ? _value.totalSecs
                : totalSecs // ignore: cast_nullable_to_non_nullable
                      as int,
            gameCount: null == gameCount
                ? _value.gameCount
                : gameCount // ignore: cast_nullable_to_non_nullable
                      as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$PeriodStatsImplCopyWith<$Res>
    implements $PeriodStatsCopyWith<$Res> {
  factory _$$PeriodStatsImplCopyWith(
    _$PeriodStatsImpl value,
    $Res Function(_$PeriodStatsImpl) then,
  ) = __$$PeriodStatsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    @JsonKey(name: 'total_secs') int totalSecs,
    @JsonKey(name: 'game_count') int gameCount,
  });
}

/// @nodoc
class __$$PeriodStatsImplCopyWithImpl<$Res>
    extends _$PeriodStatsCopyWithImpl<$Res, _$PeriodStatsImpl>
    implements _$$PeriodStatsImplCopyWith<$Res> {
  __$$PeriodStatsImplCopyWithImpl(
    _$PeriodStatsImpl _value,
    $Res Function(_$PeriodStatsImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of PeriodStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? totalSecs = null, Object? gameCount = null}) {
    return _then(
      _$PeriodStatsImpl(
        totalSecs: null == totalSecs
            ? _value.totalSecs
            : totalSecs // ignore: cast_nullable_to_non_nullable
                  as int,
        gameCount: null == gameCount
            ? _value.gameCount
            : gameCount // ignore: cast_nullable_to_non_nullable
                  as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$PeriodStatsImpl implements _PeriodStats {
  const _$PeriodStatsImpl({
    @JsonKey(name: 'total_secs') this.totalSecs = 0,
    @JsonKey(name: 'game_count') this.gameCount = 0,
  });

  factory _$PeriodStatsImpl.fromJson(Map<String, dynamic> json) =>
      _$$PeriodStatsImplFromJson(json);

  @override
  @JsonKey(name: 'total_secs')
  final int totalSecs;
  @override
  @JsonKey(name: 'game_count')
  final int gameCount;

  @override
  String toString() {
    return 'PeriodStats(totalSecs: $totalSecs, gameCount: $gameCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PeriodStatsImpl &&
            (identical(other.totalSecs, totalSecs) ||
                other.totalSecs == totalSecs) &&
            (identical(other.gameCount, gameCount) ||
                other.gameCount == gameCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, totalSecs, gameCount);

  /// Create a copy of PeriodStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PeriodStatsImplCopyWith<_$PeriodStatsImpl> get copyWith =>
      __$$PeriodStatsImplCopyWithImpl<_$PeriodStatsImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PeriodStatsImplToJson(this);
  }
}

abstract class _PeriodStats implements PeriodStats {
  const factory _PeriodStats({
    @JsonKey(name: 'total_secs') final int totalSecs,
    @JsonKey(name: 'game_count') final int gameCount,
  }) = _$PeriodStatsImpl;

  factory _PeriodStats.fromJson(Map<String, dynamic> json) =
      _$PeriodStatsImpl.fromJson;

  @override
  @JsonKey(name: 'total_secs')
  int get totalSecs;
  @override
  @JsonKey(name: 'game_count')
  int get gameCount;

  /// Create a copy of PeriodStats
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PeriodStatsImplCopyWith<_$PeriodStatsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

GamePresence _$GamePresenceFromJson(Map<String, dynamic> json) {
  return _GamePresence.fromJson(json);
}

/// @nodoc
mixin _$GamePresence {
  @JsonKey(name: 'user_id')
  String get userId => throw _privateConstructorUsedError;
  @JsonKey(name: 'game_id')
  String get gameId => throw _privateConstructorUsedError;
  @JsonKey(name: 'game_name')
  String get gameName => throw _privateConstructorUsedError;
  @JsonKey(name: 'game_slug')
  String get gameSlug => throw _privateConstructorUsedError;
  @JsonKey(name: 'cover_url')
  String? get coverUrl => throw _privateConstructorUsedError;
  @JsonKey(name: 'started_at')
  String get startedAt => throw _privateConstructorUsedError;
  String get event => throw _privateConstructorUsedError;

  /// Serializes this GamePresence to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GamePresence
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GamePresenceCopyWith<GamePresence> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GamePresenceCopyWith<$Res> {
  factory $GamePresenceCopyWith(
    GamePresence value,
    $Res Function(GamePresence) then,
  ) = _$GamePresenceCopyWithImpl<$Res, GamePresence>;
  @useResult
  $Res call({
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'game_id') String gameId,
    @JsonKey(name: 'game_name') String gameName,
    @JsonKey(name: 'game_slug') String gameSlug,
    @JsonKey(name: 'cover_url') String? coverUrl,
    @JsonKey(name: 'started_at') String startedAt,
    String event,
  });
}

/// @nodoc
class _$GamePresenceCopyWithImpl<$Res, $Val extends GamePresence>
    implements $GamePresenceCopyWith<$Res> {
  _$GamePresenceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GamePresence
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? userId = null,
    Object? gameId = null,
    Object? gameName = null,
    Object? gameSlug = null,
    Object? coverUrl = freezed,
    Object? startedAt = null,
    Object? event = null,
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
            gameName: null == gameName
                ? _value.gameName
                : gameName // ignore: cast_nullable_to_non_nullable
                      as String,
            gameSlug: null == gameSlug
                ? _value.gameSlug
                : gameSlug // ignore: cast_nullable_to_non_nullable
                      as String,
            coverUrl: freezed == coverUrl
                ? _value.coverUrl
                : coverUrl // ignore: cast_nullable_to_non_nullable
                      as String?,
            startedAt: null == startedAt
                ? _value.startedAt
                : startedAt // ignore: cast_nullable_to_non_nullable
                      as String,
            event: null == event
                ? _value.event
                : event // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$GamePresenceImplCopyWith<$Res>
    implements $GamePresenceCopyWith<$Res> {
  factory _$$GamePresenceImplCopyWith(
    _$GamePresenceImpl value,
    $Res Function(_$GamePresenceImpl) then,
  ) = __$$GamePresenceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    @JsonKey(name: 'user_id') String userId,
    @JsonKey(name: 'game_id') String gameId,
    @JsonKey(name: 'game_name') String gameName,
    @JsonKey(name: 'game_slug') String gameSlug,
    @JsonKey(name: 'cover_url') String? coverUrl,
    @JsonKey(name: 'started_at') String startedAt,
    String event,
  });
}

/// @nodoc
class __$$GamePresenceImplCopyWithImpl<$Res>
    extends _$GamePresenceCopyWithImpl<$Res, _$GamePresenceImpl>
    implements _$$GamePresenceImplCopyWith<$Res> {
  __$$GamePresenceImplCopyWithImpl(
    _$GamePresenceImpl _value,
    $Res Function(_$GamePresenceImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of GamePresence
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? userId = null,
    Object? gameId = null,
    Object? gameName = null,
    Object? gameSlug = null,
    Object? coverUrl = freezed,
    Object? startedAt = null,
    Object? event = null,
  }) {
    return _then(
      _$GamePresenceImpl(
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        gameId: null == gameId
            ? _value.gameId
            : gameId // ignore: cast_nullable_to_non_nullable
                  as String,
        gameName: null == gameName
            ? _value.gameName
            : gameName // ignore: cast_nullable_to_non_nullable
                  as String,
        gameSlug: null == gameSlug
            ? _value.gameSlug
            : gameSlug // ignore: cast_nullable_to_non_nullable
                  as String,
        coverUrl: freezed == coverUrl
            ? _value.coverUrl
            : coverUrl // ignore: cast_nullable_to_non_nullable
                  as String?,
        startedAt: null == startedAt
            ? _value.startedAt
            : startedAt // ignore: cast_nullable_to_non_nullable
                  as String,
        event: null == event
            ? _value.event
            : event // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GamePresenceImpl implements _GamePresence {
  const _$GamePresenceImpl({
    @JsonKey(name: 'user_id') required this.userId,
    @JsonKey(name: 'game_id') required this.gameId,
    @JsonKey(name: 'game_name') required this.gameName,
    @JsonKey(name: 'game_slug') required this.gameSlug,
    @JsonKey(name: 'cover_url') this.coverUrl,
    @JsonKey(name: 'started_at') required this.startedAt,
    required this.event,
  });

  factory _$GamePresenceImpl.fromJson(Map<String, dynamic> json) =>
      _$$GamePresenceImplFromJson(json);

  @override
  @JsonKey(name: 'user_id')
  final String userId;
  @override
  @JsonKey(name: 'game_id')
  final String gameId;
  @override
  @JsonKey(name: 'game_name')
  final String gameName;
  @override
  @JsonKey(name: 'game_slug')
  final String gameSlug;
  @override
  @JsonKey(name: 'cover_url')
  final String? coverUrl;
  @override
  @JsonKey(name: 'started_at')
  final String startedAt;
  @override
  final String event;

  @override
  String toString() {
    return 'GamePresence(userId: $userId, gameId: $gameId, gameName: $gameName, gameSlug: $gameSlug, coverUrl: $coverUrl, startedAt: $startedAt, event: $event)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GamePresenceImpl &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.gameId, gameId) || other.gameId == gameId) &&
            (identical(other.gameName, gameName) ||
                other.gameName == gameName) &&
            (identical(other.gameSlug, gameSlug) ||
                other.gameSlug == gameSlug) &&
            (identical(other.coverUrl, coverUrl) ||
                other.coverUrl == coverUrl) &&
            (identical(other.startedAt, startedAt) ||
                other.startedAt == startedAt) &&
            (identical(other.event, event) || other.event == event));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    userId,
    gameId,
    gameName,
    gameSlug,
    coverUrl,
    startedAt,
    event,
  );

  /// Create a copy of GamePresence
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GamePresenceImplCopyWith<_$GamePresenceImpl> get copyWith =>
      __$$GamePresenceImplCopyWithImpl<_$GamePresenceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GamePresenceImplToJson(this);
  }
}

abstract class _GamePresence implements GamePresence {
  const factory _GamePresence({
    @JsonKey(name: 'user_id') required final String userId,
    @JsonKey(name: 'game_id') required final String gameId,
    @JsonKey(name: 'game_name') required final String gameName,
    @JsonKey(name: 'game_slug') required final String gameSlug,
    @JsonKey(name: 'cover_url') final String? coverUrl,
    @JsonKey(name: 'started_at') required final String startedAt,
    required final String event,
  }) = _$GamePresenceImpl;

  factory _GamePresence.fromJson(Map<String, dynamic> json) =
      _$GamePresenceImpl.fromJson;

  @override
  @JsonKey(name: 'user_id')
  String get userId;
  @override
  @JsonKey(name: 'game_id')
  String get gameId;
  @override
  @JsonKey(name: 'game_name')
  String get gameName;
  @override
  @JsonKey(name: 'game_slug')
  String get gameSlug;
  @override
  @JsonKey(name: 'cover_url')
  String? get coverUrl;
  @override
  @JsonKey(name: 'started_at')
  String get startedAt;
  @override
  String get event;

  /// Create a copy of GamePresence
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GamePresenceImplCopyWith<_$GamePresenceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
