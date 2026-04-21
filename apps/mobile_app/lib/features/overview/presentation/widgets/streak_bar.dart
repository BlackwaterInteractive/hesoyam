import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';

enum StreakStatus { tracked, missed, upcoming }

class StreakDay {
  const StreakDay({required this.label, required this.status});
  final String label;
  final StreakStatus status;
}

/// Week streak card — shows consecutive weeks with activity
/// and a 7-day bar for the current week.
class StreakBar extends StatelessWidget {
  const StreakBar({
    required this.weekStreak,
    required this.days,
    super.key,
  });

  final int weekStreak;
  final List<StreakDay> days;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacing20),
      decoration: BoxDecoration(
        color: AppColors.surface1,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
      ),
      child: Column(
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'WEEK STREAK',
                    style: AppTypography.labelSmall.copyWith(
                      letterSpacing: 1,
                    ),
                  ),
                  const Gap(AppTheme.spacing4),
                  Text(
                    '$weekStreak Week${weekStreak != 1 ? 's' : ''}',
                    style: AppTypography.headlineMedium,
                  ),
                ],
              ),
              Text(
                '\u{1F525}',
                style: AppTypography.displayMedium.copyWith(fontSize: 28),
              ),
            ],
          ),

          const Gap(AppTheme.spacing16),

          // Day dots
          Row(
            children: days.map((day) {
              return Expanded(
                child: Column(
                  children: [
                    _DayDot(status: day.status),
                    const Gap(AppTheme.spacing4),
                    Text(day.label, style: AppTypography.labelSmall),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _DayDot extends StatelessWidget {
  const _DayDot({required this.status});

  final StreakStatus status;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: switch (status) {
          StreakStatus.tracked => AppColors.accent,
          StreakStatus.missed => AppColors.surface2,
          StreakStatus.upcoming => Colors.transparent,
        },
        border: status == StreakStatus.upcoming
            ? Border.all(
                color: AppColors.surface3,
                width: 1,
                strokeAlign: BorderSide.strokeAlignInside,
              )
            : null,
      ),
      alignment: Alignment.center,
      child: status == StreakStatus.tracked
          ? const Icon(Icons.check_rounded, size: 14, color: Colors.black)
          : null,
    );
  }
}
