import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/dashboard_stats.dart';
import '../../../shared/models/game.dart';
import '../../../shared/models/game_session.dart';
import '../domain/overview_repository.dart';

class OverviewRepositoryImpl implements OverviewRepository {
  OverviewRepositoryImpl(this._client);

  final SupabaseClient _client;

  @override
  Future<DashboardStats> getDashboardStats(String userId) async {
    final data = await _client.rpc(
      'get_dashboard_overview',
      params: {'p_user_id': userId},
    );

    return DashboardStats.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<int> getAllTimeSecs(String userId) async {
    final data = await _client
        .from('game_sessions')
        .select('duration_secs')
        .eq('user_id', userId)
        .not('ended_at', 'is', null);

    return (data as List).fold<int>(
      0,
      (sum, row) => sum + (row['duration_secs'] as int),
    );
  }

  @override
  Future<List<WeekDay>> getWeekStreak(String userId) async {
    // Get the start of the current week (Sunday)
    final now = DateTime.now();
    final weekStart = now.subtract(Duration(days: now.weekday % 7));
    final sunday = DateTime(weekStart.year, weekStart.month, weekStart.day);

    final data = await _client
        .from('game_sessions')
        .select('started_at, duration_secs')
        .eq('user_id', userId)
        .gte('started_at', sunday.toIso8601String())
        .not('ended_at', 'is', null);

    // Group by day
    final dayMap = <String, int>{};
    for (final row in data as List) {
      final dateKey = (row['started_at'] as String).substring(0, 10);
      dayMap[dateKey] = (dayMap[dateKey] ?? 0) + (row['duration_secs'] as int);
    }

    final dayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return List.generate(7, (i) {
      final day = sunday.add(Duration(days: i));
      final key = DateFormat('yyyy-MM-dd').format(day);
      return WeekDay(
        date: day,
        label: dayLabels[i],
        secs: dayMap[key] ?? 0,
      );
    });
  }

  @override
  Future<List<RecentPlay>> getRecentPlays(
    String userId, {
    int limit = 5,
  }) async {
    final data = await _client
        .from('game_sessions')
        .select('*, games(*)')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .order('started_at', ascending: false)
        .limit(limit);

    return (data as List).map((row) {
      final gameData = row['games'] as Map<String, dynamic>?;
      final sessionMap = Map<String, dynamic>.from(row)..remove('games');

      return RecentPlay(
        session: GameSession.fromJson(sessionMap),
        game: gameData != null
            ? Game.fromJson(gameData)
            : Game(
                id: row['game_id'] ?? '',
                name: row['game_name'] ?? 'Unknown Game',
                slug: 'unknown',
                createdAt: DateTime.now(),
              ),
      );
    }).toList();
  }

  @override
  Future<GameSession?> getActiveSession(String userId) async {
    final data = await _client
        .from('game_sessions')
        .select()
        .eq('user_id', userId)
        .isFilter('ended_at', null)
        .order('started_at', ascending: false)
        .limit(1)
        .maybeSingle();

    return data != null ? GameSession.fromJson(data) : null;
  }
}
