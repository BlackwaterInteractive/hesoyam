import '../../../shared/models/dashboard_stats.dart';
import '../../../shared/models/game_session.dart';
import '../../../shared/models/game.dart';

/// Abstract interface for overview/dashboard data.
abstract class OverviewRepository {
  Future<DashboardStats> getDashboardStats(String userId);
  Future<int> getAllTimeSecs(String userId);
  Future<List<WeekDay>> getWeekStreak(String userId);
  Future<List<RecentPlay>> getRecentPlays(String userId, {int limit = 5});
  Future<GameSession?> getActiveSession(String userId);
}

class WeekDay {
  const WeekDay({required this.date, required this.label, required this.secs});
  final DateTime date;
  final String label;
  final int secs;

  bool get hasActivity => secs > 0;
}

class RecentPlay {
  const RecentPlay({required this.session, required this.game});
  final GameSession session;
  final Game game;
}
