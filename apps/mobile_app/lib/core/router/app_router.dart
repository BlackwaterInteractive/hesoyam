import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/onboarding/presentation/get_started_screen.dart';
import '../../features/onboarding/presentation/connect_discord_screen.dart';
import '../../features/onboarding/presentation/verify_discord_screen.dart';
import '../../features/onboarding/presentation/join_server_screen.dart';
import '../../features/onboarding/presentation/create_account_screen.dart';
import '../../features/overview/presentation/overview_screen.dart';
import '../../features/library/presentation/library_screen.dart';
import '../../features/library/presentation/game_detail_screen.dart';
import '../../features/search/presentation/search_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../app_shell.dart';

abstract final class RoutePaths {
  static const login = '/login';
  static const otp = '/otp';
  static const getStarted = '/get-started';
  static const connectDiscord = '/connect-discord';
  static const verifyDiscord = '/verify-discord';
  static const joinServer = '/join-server';
  static const createAccount = '/create-account';
  static const overview = '/overview';
  static const library = '/library';
  static const search = '/search';
  static const profile = '/profile';
  static const gameDetail = '/game/:id';
  static const editProfile = '/profile/edit';
}

/// All app routes — used by GoRouter in app.dart.
final appRoutes = <RouteBase>[
  // ── Auth ──────────────────────────────────────────────
  GoRoute(
    path: RoutePaths.login,
    builder: (context, state) => const LoginScreen(),
  ),
  GoRoute(
    path: RoutePaths.otp,
    builder: (context, state) {
      final email = state.extra as String? ?? '';
      return OtpScreen(email: email);
    },
  ),

  // ── Onboarding ────────────────────────────────────────
  GoRoute(
    path: RoutePaths.getStarted,
    builder: (context, state) => const GetStartedScreen(),
  ),
  GoRoute(
    path: RoutePaths.connectDiscord,
    builder: (context, state) => const ConnectDiscordScreen(),
  ),
  GoRoute(
    path: RoutePaths.verifyDiscord,
    builder: (context, state) => const VerifyDiscordScreen(),
  ),
  GoRoute(
    path: RoutePaths.joinServer,
    builder: (context, state) => const JoinServerScreen(),
  ),
  GoRoute(
    path: RoutePaths.createAccount,
    builder: (context, state) => const CreateAccountScreen(),
  ),

  // ── Game Detail (outside shell — no bottom nav) ───────
  GoRoute(
    path: RoutePaths.gameDetail,
    builder: (context, state) {
      final id = state.pathParameters['id'] ?? '';
      return GameDetailScreen(gameId: id);
    },
  ),

  // ── Main App (shell with bottom nav) ──────────────────
  ShellRoute(
    builder: (context, state, child) => AppShell(child: child),
    routes: [
      GoRoute(
        path: RoutePaths.overview,
        pageBuilder: (context, state) => const NoTransitionPage(
          child: OverviewScreen(),
        ),
      ),
      GoRoute(
        path: RoutePaths.library,
        pageBuilder: (context, state) => const NoTransitionPage(
          child: LibraryScreen(),
        ),
      ),
      GoRoute(
        path: RoutePaths.search,
        pageBuilder: (context, state) => const NoTransitionPage(
          child: SearchScreen(),
        ),
      ),
      GoRoute(
        path: RoutePaths.profile,
        pageBuilder: (context, state) => const NoTransitionPage(
          child: ProfileScreen(),
        ),
      ),
    ],
  ),
];
