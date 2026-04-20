import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/config/env.dart';
import '../domain/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._client);

  final SupabaseClient _client;

  @override
  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  @override
  Session? get currentSession => _client.auth.currentSession;

  @override
  User? get currentUser => _client.auth.currentUser;

  @override
  Future<bool> signInWithDiscord() async {
    final res = await _client.auth.signInWithOAuth(
      OAuthProvider.discord,
      redirectTo: Env.oauthRedirectUri,
      authScreenLaunchMode: LaunchMode.externalApplication,
    );
    return res;
  }

  @override
  Future<bool> signInWithGoogle() async {
    final res = await _client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: Env.oauthRedirectUri,
      authScreenLaunchMode: LaunchMode.externalApplication,
    );
    return res;
  }

  @override
  Future<void> signInWithOtp(String email) async {
    await _client.auth.signInWithOtp(
      email: email,
      shouldCreateUser: true,
    );
  }

  @override
  Future<AuthResponse> verifyOtp(String email, String token) async {
    return _client.auth.verifyOTP(
      email: email,
      token: token,
      type: OtpType.email,
    );
  }

  @override
  Future<void> signOut() async {
    await _client.auth.signOut();
  }
}
