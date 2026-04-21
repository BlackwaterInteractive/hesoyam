import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/profile.dart';
import '../domain/profile_repository.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  ProfileRepositoryImpl(this._client);

  final SupabaseClient _client;

  @override
  Future<Profile?> getProfile(String userId) async {
    final data = await _client
        .from('profiles')
        .select()
        .eq('id', userId)
        .maybeSingle();

    return data != null ? Profile.fromJson(data) : null;
  }

  @override
  Future<void> updateProfile(String userId, Map<String, dynamic> data) async {
    await _client.from('profiles').update(data).eq('id', userId);
  }

  @override
  Future<bool> isUsernameAvailable(String username) async {
    final data = await _client
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

    return data == null;
  }
}
