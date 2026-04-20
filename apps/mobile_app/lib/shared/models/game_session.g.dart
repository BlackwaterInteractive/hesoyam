// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'game_session.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GameSessionImpl _$$GameSessionImplFromJson(Map<String, dynamic> json) =>
    _$GameSessionImpl(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      gameId: json['game_id'] as String?,
      gameName: json['game_name'] as String?,
      source: json['source'] as String? ?? 'discord',
      startedAt: DateTime.parse(json['started_at'] as String),
      endedAt: json['ended_at'] == null
          ? null
          : DateTime.parse(json['ended_at'] as String),
      durationSecs: (json['duration_secs'] as num?)?.toInt() ?? 0,
      activeSecs: (json['active_secs'] as num?)?.toInt() ?? 0,
      idleSecs: (json['idle_secs'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$GameSessionImplToJson(_$GameSessionImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'user_id': instance.userId,
      'game_id': instance.gameId,
      'game_name': instance.gameName,
      'source': instance.source,
      'started_at': instance.startedAt.toIso8601String(),
      'ended_at': instance.endedAt?.toIso8601String(),
      'duration_secs': instance.durationSecs,
      'active_secs': instance.activeSecs,
      'idle_secs': instance.idleSecs,
    };
