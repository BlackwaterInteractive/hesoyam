import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';

/// Last played card — shown when the user is not currently playing.
class LastPlayedCard extends StatelessWidget {
  const LastPlayedCard({
    required this.gameName,
    required this.duration,
    required this.timeAgo,
    this.coverUrl,
    super.key,
  });

  final String gameName;
  final String duration;
  final String timeAgo;
  final String? coverUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacing24),
      decoration: BoxDecoration(
        color: AppColors.surface1,
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Last played',
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textTertiary,
            ),
          ),
          const Gap(AppTheme.spacing8),
          Text(
            gameName,
            style: AppTypography.headlineMedium,
          ),
          const Gap(AppTheme.spacing4),
          Text(
            '$duration \u00B7 $timeAgo',
            style: AppTypography.bodyMedium,
          ),
        ],
      ),
    );
  }
}
