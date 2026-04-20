// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_game.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UserGameImpl _$$UserGameImplFromJson(Map<String, dynamic> json) =>
    _$UserGameImpl(
      userId: json['user_id'] as String,
      gameId: json['game_id'] as String,
      totalTimeSecs: (json['total_time_secs'] as num?)?.toInt() ?? 0,
      totalSessions: (json['total_sessions'] as num?)?.toInt() ?? 0,
      avgSessionSecs: (json['avg_session_secs'] as num?)?.toInt() ?? 0,
      firstPlayed: json['first_played'] == null
          ? null
          : DateTime.parse(json['first_played'] as String),
      lastPlayed: json['last_played'] == null
          ? null
          : DateTime.parse(json['last_played'] as String),
    );

Map<String, dynamic> _$$UserGameImplToJson(_$UserGameImpl instance) =>
    <String, dynamic>{
      'user_id': instance.userId,
      'game_id': instance.gameId,
      'total_time_secs': instance.totalTimeSecs,
      'total_sessions': instance.totalSessions,
      'avg_session_secs': instance.avgSessionSecs,
      'first_played': instance.firstPlayed?.toIso8601String(),
      'last_played': instance.lastPlayed?.toIso8601String(),
    };
