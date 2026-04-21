import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';

/// Verify Discord ID — Section 2.3
///
/// Shows the Discord profile fetched by the entered ID.
/// "Yes, that's me" → Join Server. "No, try again" → back.
class VerifyDiscordScreen extends StatelessWidget {
  const VerifyDiscordScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(AppTheme.spacing16),

              GestureDetector(
                onTap: () => context.pop(),
                child: Text(
                  '← Back',
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ),

              const Gap(AppTheme.spacing24),

              Text('Is this you?', style: AppTypography.headlineLarge),

              const Gap(AppTheme.spacing32),

              // ── Discord profile card ──────────────────────
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppTheme.spacing32),
                decoration: BoxDecoration(
                  color: AppColors.surface1,
                  borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                ),
                child: Column(
                  children: [
                    // Avatar placeholder
                    Container(
                      width: 80,
                      height: 80,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [AppColors.discord, AppColors.accent],
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'B',
                        style: AppTypography.displayMedium.copyWith(
                          fontSize: 32,
                        ),
                      ),
                    ),
                    const Gap(AppTheme.spacing16),
                    Text('Batman', style: AppTypography.headlineMedium),
                    const Gap(AppTheme.spacing4),
                    Text(
                      'batman#0001',
                      style: AppTypography.bodyMedium,
                    ),
                  ],
                ),
              ),

              const Gap(AppTheme.spacing24),

              ElevatedButton(
                onPressed: () => context.go(RoutePaths.joinServer),
                child: const Text('Yes, that\'s me'),
              ),
              const Gap(AppTheme.spacing12),
              OutlinedButton(
                onPressed: () => context.pop(),
                child: const Text('No, try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
