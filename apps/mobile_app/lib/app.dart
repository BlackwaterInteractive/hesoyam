import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_typography.dart';

/// Determines the initial route based on auth + profile state.
///
/// Determines the initial route based on auth + profile state.
///
/// - No session → login
/// - Session but no username → onboarding
/// - Session + username + Discord → overview (State A or B)
/// - Session + username + no Discord → library (State C)
final initialRouteProvider = FutureProvider<String>((ref) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) return RoutePaths.login;

  final profile = await Supabase.instance.client
      .from('profiles')
      .select('username, discord_id, in_guild')
      .eq('id', session.user.id)
      .maybeSingle();

  final hasUsername = profile?['username'] != null;
  final hasDiscord = profile?['discord_id'] != null;

  if (!hasUsername) {
    // Incomplete onboarding
    if (hasDiscord) return RoutePaths.joinServer;
    return RoutePaths.getStarted;
  }

  // PRD §6: Default tab based on user state
  // State A/B (Discord linked) → Overview
  // State C (no Discord) → Library
  if (hasDiscord) return RoutePaths.overview;
  return RoutePaths.library;
});

class RaidApp extends ConsumerWidget {
  const RaidApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final initialRouteAsync = ref.watch(initialRouteProvider);

    return initialRouteAsync.when(
      loading: () => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        home: const _SplashScreen(),
      ),
      error: (_, __) => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        home: const _SplashScreen(),
      ),
      data: (initialRoute) {
        final router = GoRouter(
          initialLocation: initialRoute,
          redirect: (context, state) {
            final session = Supabase.instance.client.auth.currentSession;
            final isAuth = session != null;
            final path = state.matchedLocation;
            final isPublic = _publicRoutes.contains(path);
            final isOnboarding = _onboardingRoutes.contains(path);

            if (!isAuth && !isPublic && !isOnboarding) return RoutePaths.login;
            return null;
          },
          routes: appRoutes,
        );

        return MaterialApp.router(
          title: 'RAID',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.dark,
          routerConfig: router,
        );
      },
    );
  }
}

const _publicRoutes = {RoutePaths.login, RoutePaths.otp};
const _onboardingRoutes = {
  RoutePaths.getStarted,
  RoutePaths.connectDiscord,
  RoutePaths.verifyDiscord,
  RoutePaths.joinServer,
  RoutePaths.createAccount,
};

/// Splash screen shown while checking auth state.
class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Text(
          'RAID',
          style: AppTypography.displayLarge.copyWith(
            fontSize: 48,
            letterSpacing: 8,
            color: AppColors.accent,
          ),
        ),
      ),
    );
  }
}
