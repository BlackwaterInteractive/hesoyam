import 'dart:async';
import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';

/// Live session card — shows when the user is currently playing.
///
/// Features a pulsing glow border, game name, and a real-time
/// elapsed timer that ticks every second. Spotify-inspired gradient.
class LiveSessionCard extends StatefulWidget {
  const LiveSessionCard({
    required this.gameName,
    required this.startedAt,
    super.key,
  });

  final String gameName;
  final String startedAt;

  @override
  State<LiveSessionCard> createState() => _LiveSessionCardState();
}

class _LiveSessionCardState extends State<LiveSessionCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;
  Timer? _timer;
  String _elapsed = '';

  @override
  void initState() {
    super.initState();

    // Pulsing glow animation
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Elapsed timer
    _updateElapsed();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _updateElapsed());
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _updateElapsed() {
    final start = DateTime.parse(widget.startedAt);
    final diff = DateTime.now().toUtc().difference(start);
    final h = diff.inHours;
    final m = diff.inMinutes % 60;
    final s = diff.inSeconds % 60;

    String pad(int n) => n.toString().padLeft(2, '0');

    setState(() {
      if (diff.inSeconds < 60) {
        _elapsed = '${s}s';
      } else if (h == 0) {
        _elapsed = '${pad(m)}m ${pad(s)}s';
      } else {
        _elapsed = '${pad(h)}h ${pad(m)}m ${pad(s)}s';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusXL),
            border: Border.all(
              color: AppColors.accent.withValues(alpha: _pulseAnimation.value),
              width: 1.5,
            ),
            gradient: const LinearGradient(
              colors: [Color(0xFF1A0F2E), Color(0xFF0F1A2E)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          padding: const EdgeInsets.all(AppTheme.spacing24),
          child: child,
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // LIVE badge
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacing12,
              vertical: AppTheme.spacing4,
            ),
            decoration: BoxDecoration(
              color: AppColors.accentDim,
              borderRadius: BorderRadius.circular(AppTheme.radiusFull),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.accent,
                  ),
                ),
                const Gap(AppTheme.spacing8),
                Text(
                  'LIVE',
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.accent,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),

          const Gap(AppTheme.spacing16),

          // Game name
          Text(
            widget.gameName,
            style: AppTypography.headlineMedium.copyWith(
              fontSize: 22,
            ),
          ),

          const Gap(AppTheme.spacing4),

          // Subtitle
          Text('Playing for', style: AppTypography.bodySmall),

          const Gap(AppTheme.spacing4),

          // Timer
          Text(_elapsed, style: AppTypography.mono),
        ],
      ),
    );
  }
}
