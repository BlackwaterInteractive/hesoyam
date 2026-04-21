import 'package:supabase_flutter/supabase_flutter.dart';

abstract class AuthRepository {
  Stream<AuthState> get authStateChanges;
  Session? get currentSession;
  User? get currentUser;
  Future<bool> signInWithDiscord();
  Future<bool> signInWithGoogle();
  Future<void> signInWithOtp(String email);
  Future<AuthResponse> verifyOtp(String email, String token);
  Future<void> signOut();
}
