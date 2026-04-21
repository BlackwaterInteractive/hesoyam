import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_stats.freezed.dart';
part 'dashboard_stats.g.dart';

@freezed
class DashboardStats with _$DashboardStats {
  const factory DashboardStats({
    required PeriodStats today,
    @JsonKey(name: 'this_week') required PeriodStats thisWeek,
    @JsonKey(name: 'this_month') required PeriodStats thisMonth,
  }) = _DashboardStats;

  factory DashboardStats.fromJson(Map<String, dynamic> json) =>
      _$DashboardStatsFromJson(json);
}

@freezed
class PeriodStats with _$PeriodStats {
  const factory PeriodStats({
    @JsonKey(name: 'total_secs') @Default(0) int totalSecs,
    @JsonKey(name: 'game_count') @Default(0) int gameCount,
  }) = _PeriodStats;

  factory PeriodStats.fromJson(Map<String, dynamic> json) =>
      _$PeriodStatsFromJson(json);
}

@freezed
class GamePresence with _$GamePresence {
  const factory GamePresence({
    @JsonKey(name: 'user_id') required String userId,
    @JsonKey(name: 'game_id') required String gameId,
    @JsonKey(name: 'game_name') required String gameName,
    @JsonKey(name: 'game_slug') required String gameSlug,
    @JsonKey(name: 'cover_url') String? coverUrl,
    @JsonKey(name: 'started_at') required String startedAt,
    required String event,
  }) = _GamePresence;

  factory GamePresence.fromJson(Map<String, dynamic> json) =>
      _$GamePresenceFromJson(json);
}
