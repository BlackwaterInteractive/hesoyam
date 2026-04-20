import 'package:flutter/material.dart';

/// RAID color system — Spotify-inspired dark palette with #D7C0F4 accent.
///
/// Spotify uses a strict layered surface system:
/// - Pure black background (#000000 on mobile)
/// - Elevated surfaces at +4, +8, +16 brightness increments
/// - Single vibrant accent for interactive elements
/// - High-contrast white text with 60% / 40% opacity variants
abstract final class AppColors {
  // ── Brand ──────────────────────────────────────────────────────────────
  static const accent = Color(0xFFD7C0F4);
  static const accentDim = Color(0x33D7C0F4); // 20% opacity
  static const accentMuted = Color(0x66D7C0F4); // 40% opacity

  // ── Surfaces (Spotify layered system) ──────────────────────────────────
  static const background = Color(0xFF000000); // Pure black — mobile native
  static const surface0 = Color(0xFF121212); // Base card
  static const surface1 = Color(0xFF1A1A1A); // Elevated card
  static const surface2 = Color(0xFF242424); // Modal / sheet
  static const surface3 = Color(0xFF2A2A2A); // Hover / pressed

  // ── Text ───────────────────────────────────────────────────────────────
  static const textPrimary = Color(0xFFFFFFFF);
  static const textSecondary = Color(0x99FFFFFF); // 60%
  static const textTertiary = Color(0x66FFFFFF); // 40%
  static const textDisabled = Color(0x33FFFFFF); // 20%

  // ── Semantic ───────────────────────────────────────────────────────────
  static const success = Color(0xFF1DB954); // Spotify green
  static const error = Color(0xFFE84545);
  static const warning = Color(0xFFF59E0B);
  static const info = Color(0xFF3B82F6);

  // ── Provider colors ────────────────────────────────────────────────────
  static const discord = Color(0xFF5865F2);
  static const google = Color(0xFFFFFFFF);

  // ── Misc ───────────────────────────────────────────────────────────────
  static const divider = Color(0xFF1A1A1A);
  static const shimmerBase = Color(0xFF1A1A1A);
  static const shimmerHighlight = Color(0xFF2A2A2A);
  static const navBarBackground = Color(0xFF0A0A0A);
  static const liveDot = accent;
}
