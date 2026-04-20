import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/utils/format.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../library/presentation/providers/library_provider.dart';
import 'providers/profile_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentProfileProvider);
    final libraryAsync = ref.watch(userLibraryProvider);

    return Scaffold(
      body: SafeArea(
        child: profileAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (profile) {
            if (profile == null) {
              return const Center(child: Text('Profile not found'));
            }

            final isDiscordConnected = profile.discordId != null;

            // Aggregate stats from library
            final gameCount = libraryAsync.whenOrNull(
                  data: (entries) => entries.length,
                ) ??
                0;
            final totalSecs = libraryAsync.whenOrNull(
                  data: (entries) =>
                      entries.fold<int>(0, (sum, e) => sum + e.userGame.totalTimeSecs),
                ) ??
                0;
            final totalSessions = libraryAsync.whenOrNull(
                  data: (entries) =>
                      entries.fold<int>(0, (sum, e) => sum + e.userGame.totalSessions),
                ) ??
                0;

            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing20),
              child: Column(
                children: [
                  const Gap(AppTheme.spacing12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Profile', style: AppTypography.headlineLarge),
                  ),

                  const Gap(AppTheme.spacing24),

                  // Avatar
                  Container(
                    width: 88,
                    height: 88,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [AppColors.accent, Color(0xFF7C3AED)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      (profile.username ?? '?')[0].toUpperCase(),
                      style: AppTypography.displayMedium.copyWith(fontSize: 36),
                    ),
                  ),
                  const Gap(AppTheme.spacing12),
                  Text(
                    profile.displayName ?? profile.username ?? 'Unknown',
                    style: AppTypography.headlineMedium,
                  ),
                  const Gap(AppTheme.spacing4),
                  Text(
                    '@${profile.username ?? 'unknown'}',
                    style: AppTypography.bodyMedium,
                  ),
                  const Gap(AppTheme.spacing4),
                  Text(
                    'Member since ${DateFormat('MMM yyyy').format(profile.createdAt)}',
                    style: AppTypography.bodySmall.copyWith(fontSize: 12),
                  ),

                  const Gap(AppTheme.spacing24),

                  // Quick stats
                  Row(
                    children: [
                      _QuickStat(value: '$gameCount', label: 'Games'),
                      const Gap(AppTheme.spacing8),
                      _QuickStat(value: formatDuration(totalSecs), label: 'Playtime'),
                      const Gap(AppTheme.spacing8),
                      _QuickStat(value: '$totalSessions', label: 'Sessions'),
                    ],
                  ),

                  const Gap(AppTheme.spacing24),

                  // Menu items
                  if (!isDiscordConnected)
                    _MenuItem(
                      icon: Icons.gamepad_rounded,
                      iconBgColor: AppColors.discord,
                      label: 'Connect Discord',
                      subtitle: 'Enable automatic gameplay tracking',
                      labelColor: AppColors.accent,
                      highlighted: true,
                      onTap: () {
                        // TODO: navigate to connect discord post-onboarding
                      },
                    ),

                  _MenuItem(
                    icon: Icons.edit_rounded,
                    label: 'Edit Profile',
                    subtitle: 'Username, avatar, display name',
                    onTap: () {
                      // TODO: navigate to edit profile
                    },
                  ),

                  if (isDiscordConnected)
                    _MenuItem(
                      icon: Icons.link_rounded,
                      label: 'Discord',
                      subtitle: 'Connected (${profile.discordId})',
                      subtitleColor: AppColors.success,
                      onTap: () {},
                    ),

                  _MenuItem(
                    icon: Icons.chat_bubble_outline_rounded,
                    label: 'Send Feedback',
                    subtitle: 'Report bugs or suggest features',
                    onTap: () {
                      // TODO: open feedback form
                    },
                  ),

                  _MenuItem(
                    icon: Icons.star_outline_rounded,
                    label: 'Rate RAID',
                    subtitle: 'Help us grow on the App Store',
                    onTap: () {
                      // TODO: open app store
                    },
                  ),

                  const Gap(AppTheme.spacing8),

                  _MenuItem(
                    icon: Icons.logout_rounded,
                    iconBgColor: const Color(0xFF2A1515),
                    label: 'Sign Out',
                    labelColor: AppColors.error,
                    onTap: () => _showSignOutDialog(context, ref),
                  ),

                  const Gap(AppTheme.spacing32),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  void _showSignOutDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusLarge),
        ),
        title: Text('Sign out?', style: AppTypography.headlineSmall),
        content: Text(
          'You\'ll need to sign in again to access your stats.',
          style: AppTypography.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(authRepositoryProvider).signOut();
              if (context.mounted) context.go(RoutePaths.login);
            },
            child: Text(
              'Sign Out',
              style: TextStyle(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickStat extends StatelessWidget {
  const _QuickStat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacing8,
          vertical: AppTheme.spacing12,
        ),
        decoration: BoxDecoration(
          color: AppColors.surface1,
          borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        ),
        child: Column(
          children: [
            Text(value, style: AppTypography.monoSmall),
            const Gap(AppTheme.spacing4),
            Text(label, style: AppTypography.labelSmall),
          ],
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.iconBgColor,
    this.labelColor,
    this.subtitleColor,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final String? subtitle;
  final Color? iconBgColor;
  final Color? labelColor;
  final Color? subtitleColor;
  final bool highlighted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacing8),
      child: Material(
        color: highlighted ? const Color(0xFF1A0F2E) : AppColors.surface1,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppTheme.spacing16),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: iconBgColor ?? AppColors.surface2,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSmall + 2),
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 20, color: AppColors.textPrimary),
                ),
                const Gap(AppTheme.spacing12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: AppTypography.bodyLarge.copyWith(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: labelColor ?? AppColors.textPrimary,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const Gap(AppTheme.spacing2),
                        Text(
                          subtitle!,
                          style: AppTypography.bodySmall.copyWith(
                            color: subtitleColor ?? AppColors.textTertiary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: highlighted ? AppColors.accent : AppColors.textTertiary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
