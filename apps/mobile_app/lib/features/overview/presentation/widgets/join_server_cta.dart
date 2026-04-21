import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';

/// Join server CTA — shown in Overview when Discord is linked
/// but user hasn't joined the RAID server.
class JoinServerCta extends StatelessWidget {
  const JoinServerCta({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppTheme.spacing24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.radiusLarge),
        gradient: const LinearGradient(
          colors: [Color(0xFF1A0F2E), Color(0xFF0F1A2E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(
          color: AppColors.accentDim,
          width: 1,
        ),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.gamepad_rounded,
            size: 40,
            color: AppColors.accent,
          ),
          const Gap(AppTheme.spacing16),
          Text(
            'Join our Discord to\nstart tracking',
            style: AppTypography.headlineSmall.copyWith(fontSize: 18),
            textAlign: TextAlign.center,
          ),
          const Gap(AppTheme.spacing8),
          Text(
            'We need you in our Discord server to detect your games via Rich Presence.',
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textTertiary,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const Gap(AppTheme.spacing20),
          SizedBox(
            width: 180,
            child: ElevatedButton(
              onPressed: () {
                // TODO: Open Discord invite
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.discord,
                foregroundColor: Colors.white,
                minimumSize: const Size(180, 44),
              ),
              child: const Text('Join RAID Discord'),
            ),
          ),
        ],
      ),
    );
  }
}
