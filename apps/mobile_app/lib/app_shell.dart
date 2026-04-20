import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';

/// App shell — persistent bottom navigation bar across main tabs.
///
/// Uses GoRouter's ShellRoute to preserve tab state. The bottom nav
/// is styled to match Spotify: opaque dark bar, icon-first with small
/// labels, no visible border — just a subtle color lift from background.
class AppShell extends StatelessWidget {
  const AppShell({required this.child, super.key});

  final Widget child;

  static const _tabs = [
    (path: RoutePaths.overview, label: 'Overview', icon: Icons.home_rounded, activeIcon: Icons.home_rounded),
    (path: RoutePaths.library, label: 'Library', icon: Icons.grid_view_rounded, activeIcon: Icons.grid_view_rounded),
    (path: RoutePaths.search, label: 'Search', icon: Icons.search_rounded, activeIcon: Icons.search_rounded),
    (path: RoutePaths.profile, label: 'Profile', icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded),
  ];

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = _tabs.indexWhere((t) => location.startsWith(t.path));
    return index >= 0 ? index : 0;
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _currentIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.navBarBackground,
          border: Border(
            top: BorderSide(color: AppColors.divider, width: 0.5),
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacing8,
              vertical: AppTheme.spacing8,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(_tabs.length, (i) {
                final tab = _tabs[i];
                final isActive = i == currentIndex;

                return Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      if (i != currentIndex) context.go(tab.path);
                    },
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isActive ? tab.activeIcon : tab.icon,
                          size: 24,
                          color: isActive
                              ? AppColors.textPrimary
                              : AppColors.textTertiary,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          tab.label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: isActive
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: isActive
                                ? AppColors.textPrimary
                                : AppColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}
