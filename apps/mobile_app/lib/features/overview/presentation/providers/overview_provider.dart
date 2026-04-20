import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/supabase/supabase_client.dart';
import '../../../../shared/models/dashboard_stats.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/overview_repository_impl.dart';
import '../../data/presence_repository_impl.dart';
import '../../domain/overview_repository.dart';

final overviewRepositoryProvider = Provider<OverviewRepository>((ref) {
  return OverviewRepositoryImpl(ref.watch(supabaseClientProvider));
});

final presenceRepositoryProvider = Provider<PresenceRepository>((ref) {
  final repo = PresenceRepository(ref.watch(supabaseClientProvider));
  ref.onDispose(repo.dispose);
  return repo;
});

/// Dashboard stats (today, this week, this month).
final dashboardStatsProvider = FutureProvider<DashboardStats?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  return ref.read(overviewRepositoryProvider).getDashboardStats(user.id);
});

/// All-time total playtime in seconds.
final allTimeSecsProvider = FutureProvider<int>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return 0;
  return ref.read(overviewRepositoryProvider).getAllTimeSecs(user.id);
});

/// Current week's day-by-day activity.
final weekStreakProvider = FutureProvider<List<WeekDay>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return [];
  return ref.read(overviewRepositoryProvider).getWeekStreak(user.id);
});

/// Recent completed plays.
final recentPlaysProvider = FutureProvider<List<RecentPlay>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return [];
  return ref.read(overviewRepositoryProvider).getRecentPlays(user.id);
});

/// Live game presence stream.
final gamePresenceProvider = StreamProvider<GamePresence?>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return const Stream.empty();

  final repo = ref.watch(presenceRepositoryProvider);
  repo.subscribe(user.id);

  return repo.presenceStream;
});
