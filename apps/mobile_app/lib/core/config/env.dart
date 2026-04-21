import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Environment configuration — reads from `.env` files via flutter_dotenv.
///
/// Flavor is set via compile-time flag: `--dart-define=FLAVOR=staging`
///
/// Usage:
///   flutter run --dart-define=FLAVOR=staging     → loads .env.staging
///   flutter run --dart-define=FLAVOR=production   → loads .env.production
///   flutter run                                   → loads .env (defaults to staging)
abstract final class Env {
  static const _flavor = String.fromEnvironment('FLAVOR', defaultValue: 'staging');

  static String get flavor => _flavor;
  static bool get isProduction => _flavor == 'production';
  static bool get isStaging => _flavor == 'staging';

  /// Load the env file matching the current flavor.
  static Future<void> init() async {
    final fileName = switch (_flavor) {
      'production' => '.env.production',
      'staging' => '.env.staging',
      _ => '.env',
    };
    await dotenv.load(fileName: fileName);
  }

  static String get supabaseUrl =>
      dotenv.env['SUPABASE_URL'] ?? _missing('SUPABASE_URL');

  static String get supabaseAnonKey =>
      dotenv.env['SUPABASE_ANON_KEY'] ?? _missing('SUPABASE_ANON_KEY');

  static String get backendUrl =>
      dotenv.env['BACKEND_URL'] ?? 'http://localhost:3000';

  static String get discordInviteUrl =>
      dotenv.env['DISCORD_INVITE_URL'] ?? 'https://discord.gg/raid';

  // ── Deep link config ───────────────────────────────────────────────────
  static const deepLinkScheme = 'come.flywith.me';
  static const deepLinkHost = 'callback';
  static const oauthRedirectUri = '$deepLinkScheme://$deepLinkHost';

  static String _missing(String key) {
    throw StateError('Missing env variable: $key. Check your .env file.');
  }
}
