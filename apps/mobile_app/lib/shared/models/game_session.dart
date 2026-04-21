import 'package:freezed_annotation/freezed_annotation.dart';

part 'game_session.freezed.dart';
part 'game_session.g.dart';

@freezed
class GameSession with _$GameSession {
  const factory GameSession({
    required String id,
    @JsonKey(name: 'user_id') required String userId,
    @JsonKey(name: 'game_id') String? gameId,
    @JsonKey(name: 'game_name') String? gameName,
    @Default('discord') String source,
    @JsonKey(name: 'started_at') required DateTime startedAt,
    @JsonKey(name: 'ended_at') DateTime? endedAt,
    @JsonKey(name: 'duration_secs') @Default(0) int durationSecs,
    @JsonKey(name: 'active_secs') @Default(0) int activeSecs,
    @JsonKey(name: 'idle_secs') @Default(0) int idleSecs,
  }) = _GameSession;

  factory GameSession.fromJson(Map<String, dynamic> json) =>
      _$GameSessionFromJson(json);
}
