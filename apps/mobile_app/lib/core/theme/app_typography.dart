import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// RAID typography — mirrors Spotify's type scale.
///
/// Spotify uses Circular Std (proprietary). We use Inter as the closest
/// open-source match: geometric, neutral, excellent screen legibility.
///
/// Scale: compact and bold — Spotify favours fewer sizes with heavy weight
/// contrast rather than many subtle increments.
abstract final class AppTypography {
  static String? _fontFamily;
  static String get fontFamily => _fontFamily ??= GoogleFonts.inter().fontFamily!;

  // ── Display ────────────────────────────────────────────────────────────
  /// Hero numbers (live timer, big stats)
  static final displayLarge = GoogleFonts.inter(
    fontSize: 40,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: -1.5,
    height: 1.1,
  );

  /// Section hero (game name on detail)
  static final displayMedium = GoogleFonts.inter(
    fontSize: 28,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
    height: 1.2,
  );

  // ── Headings ───────────────────────────────────────────────────────────
  /// Page titles ("Overview", "Library")
  static final headlineLarge = GoogleFonts.inter(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
  );

  /// Card titles (game names in lists)
  static final headlineMedium = GoogleFonts.inter(
    fontSize: 20,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  /// Section headers ("Recent Plays", "Week Streak")
  static final headlineSmall = GoogleFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  // ── Body ───────────────────────────────────────────────────────────────
  /// Primary body text
  static final bodyLarge = GoogleFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.w500,
    color: AppColors.textPrimary,
    height: 1.5,
  );

  /// Secondary body text
  static final bodyMedium = GoogleFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
    height: 1.4,
  );

  /// Tertiary text (timestamps, metadata)
  static final bodySmall = GoogleFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textTertiary,
  );

  // ── Labels ─────────────────────────────────────────────────────────────
  /// Button text, chips, badges
  static final labelLarge = GoogleFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: 0.3,
  );

  /// Stat labels ("Today", "This Week"), nav labels
  static final labelSmall = GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    color: AppColors.textTertiary,
    letterSpacing: 0.5,
  );

  // ── Mono (timers, numbers) ─────────────────────────────────────────────
  /// Live session timer
  static final mono = GoogleFonts.jetBrainsMono(
    fontSize: 36,
    fontWeight: FontWeight.w800,
    color: AppColors.accent,
    letterSpacing: -1,
  );

  /// Stat values
  static final monoSmall = GoogleFonts.jetBrainsMono(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );
}
