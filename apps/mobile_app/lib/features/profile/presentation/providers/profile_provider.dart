import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/supabase/supabase_client.dart';
import '../../../../shared/models/profile.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/profile_repository_impl.dart';
import '../../domain/profile_repository.dart';

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepositoryImpl(ref.watch(supabaseClientProvider));
});

/// Current user's profile — fetched once and cached.
final currentProfileProvider = FutureProvider<Profile?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  return ref.read(profileRepositoryProvider).getProfile(user.id);
});
