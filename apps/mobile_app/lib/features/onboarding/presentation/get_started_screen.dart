import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';

/// Get Started — Section 2.1
///
/// Informational overview of the 3 steps to enable tracking.
/// "Connect & Get Started" pushes to connect discord flow.
/// "Skip" goes straight to create account (library-only mode).
class GetStartedScreen extends StatelessWidget {
  const GetStartedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(AppTheme.spacing48),

              Text(
                'Start tracking\nyour gameplay',
                style: AppTypography.displayMedium,
              ),
              const Gap(AppTheme.spacing12),
              Text(
                'Automatically track every game you play in 3 simple steps.',
                style: AppTypography.bodyMedium,
              ),

              const Gap(AppTheme.spacing40),

              // ── Steps timeline ────────────────────────────
              _StepItem(
                number: '1',
                title: 'Connect your Discord',
                subtitle: 'Link your Discord account so we can detect your games.',
                isActive: true,
              ),
              _ConnectorLine(),
              _StepItem(
                number: '2',
                title: 'Join our Discord server',
                subtitle: 'Our bot needs to see your activity to track sessions.',
                isActive: false,
              ),
              _ConnectorLine(),
              _StepItem(
                number: '3',
                title: 'Start playing',
                subtitle: 'Launch any game and we\'ll track it automatically.',
                isActive: false,
              ),

              const Spacer(),

              // ── CTAs ──────────────────────────────────────
              ElevatedButton(
                onPressed: () => context.push(RoutePaths.connectDiscord),
                child: const Text('Connect & Get Started'),
              ),
              const Gap(AppTheme.spacing8),
              Center(
                child: TextButton(
                  onPressed: () => context.go(RoutePaths.createAccount),
                  child: Text(
                    'Skip — I\'ll just use the library',
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.textTertiary,
                    ),
                  ),
                ),
              ),
              const Gap(AppTheme.spacing4),
              Center(
                child: Text(
                  'You can set up tracking anytime from your profile.',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textDisabled,
                    fontSize: 11,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),

              const Gap(AppTheme.spacing24),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepItem extends StatelessWidget {
  const _StepItem({
    required this.number,
    required this.title,
    required this.subtitle,
    required this.isActive,
  });

  final String number;
  final String title;
  final String subtitle;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive ? AppColors.accent : AppColors.surface2,
          ),
          alignment: Alignment.center,
          child: Text(
            number,
            style: AppTypography.labelLarge.copyWith(
              color: isActive ? Colors.black : AppColors.textTertiary,
              fontSize: 18,
            ),
          ),
        ),
        const Gap(AppTheme.spacing16),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: AppTheme.spacing4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.headlineSmall.copyWith(
                    fontSize: 17,
                    color: isActive
                        ? AppColors.textPrimary
                        : AppColors.textTertiary,
                  ),
                ),
                const Gap(AppTheme.spacing4),
                Text(
                  subtitle,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textTertiary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ConnectorLine extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 19),
      child: Container(
        width: 2,
        height: 24,
        color: AppColors.surface2,
      ),
    );
  }
}
