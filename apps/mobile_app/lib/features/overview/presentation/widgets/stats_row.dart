import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';

/// Horizontal stats row — Today / This Week / Month / All Time.
///
/// Spotify uses this pattern for stat cards: minimal boxes, bold value
/// on top, muted label below, no borders — just surface color.
class StatsRow extends StatelessWidget {
  const StatsRow({
    required this.today,
    required this.thisWeek,
    required this.thisMonth,
    required this.allTime,
    super.key,
  });

  final String today;
  final String thisWeek;
  final String thisMonth;
  final String allTime;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StatBox(value: today, label: 'Today'),
        const SizedBox(width: AppTheme.spacing8),
        _StatBox(value: thisWeek, label: 'This Week'),
        const SizedBox(width: AppTheme.spacing8),
        _StatBox(value: thisMonth, label: 'April'),
        const SizedBox(width: AppTheme.spacing8),
        _StatBox(value: allTime, label: 'All Time'),
      ],
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.value, required this.label});

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
            const SizedBox(height: AppTheme.spacing4),
            Text(label, style: AppTypography.labelSmall),
          ],
        ),
      ),
    );
  }
}
