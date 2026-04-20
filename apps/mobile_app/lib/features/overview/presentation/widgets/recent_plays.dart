import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';

class RecentSession {
  const RecentSession({
    required this.gameName,
    required this.duration,
    required this.date,
    required this.time,
    this.coverUrl,
  });

  final String gameName;
  final String duration;
  final String date;
  final String time;
  final String? coverUrl;
}

/// Recent plays list — last 4-5 completed sessions.
class RecentPlays extends StatelessWidget {
  const RecentPlays({required this.sessions, super.key});

  final List<RecentSession> sessions;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: sessions.map((session) {
        return Padding(
          padding: const EdgeInsets.only(bottom: AppTheme.spacing4),
          child: _SessionItem(session: session),
        );
      }).toList(),
    );
  }
}

class _SessionItem extends StatelessWidget {
  const _SessionItem({required this.session});

  final RecentSession session;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacing4,
        vertical: AppTheme.spacing12,
      ),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: AppColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          // Cover art placeholder
          Container(
            width: 48,
            height: 64,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
              gradient: const LinearGradient(
                colors: [Color(0xFF2A1A3E), Color(0xFF1A2A3E)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              session.gameName.substring(0, 2).toUpperCase(),
              style: AppTypography.bodySmall.copyWith(
                fontSize: 9,
                color: AppColors.textTertiary,
              ),
            ),
          ),

          const Gap(AppTheme.spacing12),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.gameName,
                  style: AppTypography.bodyLarge.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const Gap(AppTheme.spacing2),
                Text(
                  '${session.date} \u00B7 ${session.time}',
                  style: AppTypography.bodySmall,
                ),
              ],
            ),
          ),

          // Duration
          Text(
            session.duration,
            style: AppTypography.bodyLarge.copyWith(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: AppColors.accent,
            ),
          ),
        ],
      ),
    );
  }
}
