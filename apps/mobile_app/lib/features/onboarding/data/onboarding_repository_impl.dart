import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/profile.dart';

class OnboardingRepository {
  OnboardingRepository(this._client);

  final SupabaseClient _client;

  /// Check if the current user has completed profile setup (has username).
  Future<Profile?> getCurrentProfile() async {
    final user = _client.auth.currentUser;
    if (user == null) return null;

    final data = await _client
        .from('profiles')
        .select()
        .eq('id', user.id)
        .maybeSingle();

    return data != null ? Profile.fromJson(data) : null;
  }

  /// Check if a username is available.
  Future<bool> isUsernameAvailable(String username) async {
    final data = await _client
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle();

    return data == null;
  }

  /// Create/update profile with username, display name, avatar.
  Future<void> setupProfile({
    required String username,
    String? displayName,
    String? avatarUrl,
  }) async {
    final userId = _client.auth.currentUser!.id;
    await _client.from('profiles').update({
      'username': username.toLowerCase(),
      if (displayName != null) 'display_name': displayName,
      if (avatarUrl != null) 'avatar_url': avatarUrl,
      // TODO: 'dob': dob — #122 profiles.dob column missing
    }).eq('id', userId);
  }

  /// Link Discord by ID (trusting the ID — no verification API yet).
  /// TODO: #121 — add proper Discord profile lookup endpoint
  Future<void> linkDiscordById(String discordId) async {
    final userId = _client.auth.currentUser!.id;
    await _client.from('profiles').update({
      'discord_id': discordId,
    }).eq('id', userId);
  }

  /// Listen for in_guild changes (user joined the Discord server).
  Stream<bool> watchInGuild() {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return const Stream.empty();

    return _client
        .from('profiles')
        .stream(primaryKey: ['id'])
        .eq('id', userId)
        .map((rows) {
          if (rows.isEmpty) return false;
          return rows.first['in_guild'] == true;
        });
  }
}
