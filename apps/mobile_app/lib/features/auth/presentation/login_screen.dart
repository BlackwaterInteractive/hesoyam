import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import 'providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  StreamSubscription<AuthState>? _authSub;

  @override
  void initState() {
    super.initState();
    // Listen for OAuth callback (user returns from browser)
    _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      if (data.event == AuthChangeEvent.signedIn && mounted) {
        _navigateAfterAuth(data.session?.user);
      }
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _authSub?.cancel();
    super.dispose();
  }

  Future<void> _navigateAfterAuth(User? user) async {
    if (user == null) return;

    // Check profile state to decide routing:
    // - Existing user with username → dashboard (skip onboarding entirely)
    // - New user via Discord → join server (discord already linked)
    // - New user via Google/Email → get started (connect discord)
    final profile = await Supabase.instance.client
        .from('profiles')
        .select('username, discord_id, in_guild')
        .eq('id', user.id)
        .maybeSingle();

    if (!mounted) return;

    final hasUsername = profile?['username'] != null;
    final hasDiscord = profile?['discord_id'] != null;

    if (hasUsername) {
      // Existing user — skip onboarding, go to dashboard
      context.go(RoutePaths.overview);
    } else if (hasDiscord) {
      // New user but Discord already linked (Discord OAuth login)
      context.go(RoutePaths.joinServer);
    } else {
      // New user via Google/Email — show full onboarding
      context.go(RoutePaths.getStarted);
    }
  }

  Future<void> _signInWithDiscord() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      await ref.read(authRepositoryProvider).signInWithDiscord();
      // Browser opens — auth state listener handles the callback
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to open Discord login');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      await ref.read(authRepositoryProvider).signInWithGoogle();
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to open Google login');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _signInWithEmail() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Enter your email address');
      return;
    }
    setState(() { _isLoading = true; _error = null; });
    try {
      await ref.read(authRepositoryProvider).signInWithOtp(email);
      if (mounted) {
        context.push(RoutePaths.otp, extra: email);
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to send OTP');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing24),
          child: Column(
            children: [
              const Spacer(flex: 2),

              Text(
                'RAID',
                style: AppTypography.displayLarge.copyWith(
                  fontSize: 48,
                  letterSpacing: 8,
                  color: AppColors.accent,
                ),
              ),
              const Gap(AppTheme.spacing8),
              Text('Track your gaming life', style: AppTypography.bodyMedium),

              const Spacer(flex: 3),

              // Error message
              if (_error != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppTheme.spacing12),
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  ),
                  child: Text(
                    _error!,
                    style: AppTypography.bodySmall.copyWith(color: AppColors.error),
                    textAlign: TextAlign.center,
                  ),
                ),
                const Gap(AppTheme.spacing12),
              ],

              _AuthButton(
                label: 'Continue with Discord',
                icon: Icons.gamepad_rounded,
                backgroundColor: AppColors.discord,
                foregroundColor: Colors.white,
                isLoading: _isLoading,
                onTap: _isLoading ? null : _signInWithDiscord,
              ),
              const Gap(AppTheme.spacing12),

              _AuthButton(
                label: 'Continue with Google',
                icon: Icons.g_mobiledata_rounded,
                backgroundColor: AppColors.google,
                foregroundColor: Colors.black,
                isLoading: _isLoading,
                onTap: _isLoading ? null : _signInWithGoogle,
              ),

              const Gap(AppTheme.spacing24),

              Row(
                children: [
                  const Expanded(child: Divider()),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing16),
                    child: Text('OR', style: AppTypography.bodySmall),
                  ),
                  const Expanded(child: Divider()),
                ],
              ),

              const Gap(AppTheme.spacing24),

              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                style: AppTypography.bodyLarge,
                enabled: !_isLoading,
                onSubmitted: (_) => _signInWithEmail(),
                decoration: const InputDecoration(hintText: 'Enter your email'),
              ),
              const Gap(AppTheme.spacing12),

              _AuthButton(
                label: 'Continue with Email',
                icon: Icons.mail_outline_rounded,
                backgroundColor: AppColors.surface1,
                foregroundColor: AppColors.textPrimary,
                borderColor: AppColors.textTertiary,
                isLoading: _isLoading,
                onTap: _isLoading ? null : _signInWithEmail,
              ),

              const Spacer(),

              Padding(
                padding: const EdgeInsets.only(bottom: AppTheme.spacing16),
                child: Text(
                  'By continuing, you agree to our Terms & Privacy Policy',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textDisabled,
                    fontSize: 11,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AuthButton extends StatelessWidget {
  const _AuthButton({
    required this.label,
    required this.icon,
    required this.backgroundColor,
    required this.foregroundColor,
    this.borderColor,
    this.isLoading = false,
    this.onTap,
  });

  final String label;
  final IconData icon;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color? borderColor;
  final bool isLoading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusFull),
          onTap: onTap,
          child: Container(
            decoration: borderColor != null
                ? BoxDecoration(
                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    border: Border.all(color: borderColor!, width: 1),
                  )
                : null,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isLoading)
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: foregroundColor,
                    ),
                  )
                else
                  Icon(icon, color: foregroundColor, size: 22),
                const Gap(AppTheme.spacing12),
                Text(
                  label,
                  style: AppTypography.labelLarge.copyWith(color: foregroundColor),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
