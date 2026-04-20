import '../../../shared/models/profile.dart';

/// Abstract interface for profile operations.
abstract class ProfileRepository {
  Future<Profile?> getProfile(String userId);
  Future<void> updateProfile(String userId, Map<String, dynamic> data);
  Future<bool> isUsernameAvailable(String username);
}
