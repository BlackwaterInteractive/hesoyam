import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_game.freezed.dart';
part 'user_game.g.dart';

@freezed
class UserGame with _$UserGame {
  const factory UserGame({
    @JsonKey(name: 'user_id') required String userId,
    @JsonKey(name: 'game_id') required String gameId,
    @JsonKey(name: 'total_time_secs') @Default(0) int totalTimeSecs,
    @JsonKey(name: 'total_sessions') @Default(0) int totalSessions,
    @JsonKey(name: 'avg_session_secs') @Default(0) int avgSessionSecs,
    @JsonKey(name: 'first_played') DateTime? firstPlayed,
    @JsonKey(name: 'last_played') DateTime? lastPlayed,
  }) = _UserGame;

  factory UserGame.fromJson(Map<String, dynamic> json) =>
      _$UserGameFromJson(json);
}
