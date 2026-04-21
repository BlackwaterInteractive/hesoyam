// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_stats.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardStatsImpl _$$DashboardStatsImplFromJson(Map<String, dynamic> json) =>
    _$DashboardStatsImpl(
      today: PeriodStats.fromJson(json['today'] as Map<String, dynamic>),
      thisWeek: PeriodStats.fromJson(json['this_week'] as Map<String, dynamic>),
      thisMonth: PeriodStats.fromJson(
        json['this_month'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$$DashboardStatsImplToJson(
  _$DashboardStatsImpl instance,
) => <String, dynamic>{
  'today': instance.today,
  'this_week': instance.thisWeek,
  'this_month': instance.thisMonth,
};

_$PeriodStatsImpl _$$PeriodStatsImplFromJson(Map<String, dynamic> json) =>
    _$PeriodStatsImpl(
      totalSecs: (json['total_secs'] as num?)?.toInt() ?? 0,
      gameCount: (json['game_count'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$PeriodStatsImplToJson(_$PeriodStatsImpl instance) =>
    <String, dynamic>{
      'total_secs': instance.totalSecs,
      'game_count': instance.gameCount,
    };

_$GamePresenceImpl _$$GamePresenceImplFromJson(Map<String, dynamic> json) =>
    _$GamePresenceImpl(
      userId: json['user_id'] as String,
      gameId: json['game_id'] as String,
      gameName: json['game_name'] as String,
      gameSlug: json['game_slug'] as String,
      coverUrl: json['cover_url'] as String?,
      startedAt: json['started_at'] as String,
      event: json['event'] as String,
    );

Map<String, dynamic> _$$GamePresenceImplToJson(_$GamePresenceImpl instance) =>
    <String, dynamic>{
      'user_id': instance.userId,
      'game_id': instance.gameId,
      'game_name': instance.gameName,
      'game_slug': instance.gameSlug,
      'cover_url': instance.coverUrl,
      'started_at': instance.startedAt,
      'event': instance.event,
    };
