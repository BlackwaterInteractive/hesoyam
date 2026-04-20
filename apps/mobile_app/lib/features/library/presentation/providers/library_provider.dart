import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/supabase/supabase_client.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/library_repository_impl.dart';
import '../../domain/library_repository.dart';

final libraryRepositoryProvider = Provider<LibraryRepository>((ref) {
  return LibraryRepositoryImpl(ref.watch(supabaseClientProvider));
});

/// User's game library — all tracked + manually added games.
final userLibraryProvider = FutureProvider<List<LibraryEntry>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return [];
  return ref.read(libraryRepositoryProvider).getUserLibrary(user.id);
});

/// Game detail for a specific game.
final gameDetailProvider =
    FutureProvider.family<GameDetail?, String>((ref, gameId) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  return ref.read(libraryRepositoryProvider).getGameDetail(user.id, gameId);
});
