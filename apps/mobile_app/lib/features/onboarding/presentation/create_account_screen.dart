import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import 'providers/onboarding_provider.dart';

class CreateAccountScreen extends ConsumerStatefulWidget {
  const CreateAccountScreen({super.key});

  @override
  ConsumerState<CreateAccountScreen> createState() => _CreateAccountScreenState();
}

class _CreateAccountScreenState extends ConsumerState<CreateAccountScreen> {
  final _usernameController = TextEditingController();
  final _displayNameController = TextEditingController();
  bool _isUsernameAvailable = false;
  bool _isCheckingUsername = false;
  bool _isSaving = false;
  Timer? _debounce;

  @override
  void dispose() {
    _usernameController.dispose();
    _displayNameController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(AppTheme.spacing32),

              Text('Create your account', style: AppTypography.headlineLarge),
              const Gap(AppTheme.spacing8),
              Text('Set up your RAID profile.', style: AppTypography.bodyMedium),

              const Gap(AppTheme.spacing32),

              // Avatar
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [AppColors.accent, Color(0xFF7C3AED)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        _usernameController.text.isNotEmpty
                            ? _usernameController.text[0].toUpperCase()
                            : '?',
                        style: AppTypography.displayMedium.copyWith(fontSize: 36),
                      ),
                    ),
                    const Gap(AppTheme.spacing8),
                    GestureDetector(
                      onTap: () {
                        // TODO: #123 — avatar upload (verify storage bucket)
                      },
                      child: Text(
                        'Change photo',
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.accent,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const Gap(AppTheme.spacing24),

              // Username
              Text(
                'Username',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
              const Gap(AppTheme.spacing8),
              TextField(
                controller: _usernameController,
                style: AppTypography.bodyLarge,
                onChanged: _onUsernameChanged,
                decoration: const InputDecoration(hintText: 'Pick a username'),
              ),
              if (_usernameController.text.isNotEmpty) ...[
                const Gap(AppTheme.spacing4),
                Text(
                  _isCheckingUsername
                      ? 'Checking...'
                      : _isUsernameAvailable
                          ? '\u2713 Available'
                          : '\u2717 Already taken',
                  style: AppTypography.bodySmall.copyWith(
                    fontSize: 11,
                    color: _isCheckingUsername
                        ? AppColors.textTertiary
                        : _isUsernameAvailable
                            ? AppColors.success
                            : AppColors.error,
                  ),
                ),
              ],

              const Gap(AppTheme.spacing20),

              // Display Name
              Text(
                'Display Name',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
              const Gap(AppTheme.spacing8),
              TextField(
                controller: _displayNameController,
                style: AppTypography.bodyLarge,
                decoration: const InputDecoration(hintText: 'How should we call you?'),
              ),

              const Gap(AppTheme.spacing20),

              // DOB
              Text(
                'Date of Birth (optional)',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
              const Gap(AppTheme.spacing8),
              GestureDetector(
                onTap: () {
                  // TODO: #122 — DOB (profiles.dob column missing)
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppTheme.spacing16,
                    vertical: AppTheme.spacing16,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface1,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
                  ),
                  child: Text(
                    'DD / MM / YYYY',
                    style: AppTypography.bodyLarge.copyWith(color: AppColors.textTertiary),
                  ),
                ),
              ),

              const Gap(AppTheme.spacing32),

              ElevatedButton(
                onPressed: _canSubmit ? _createAccount : null,
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text("Let's Go"),
              ),

              const Gap(AppTheme.spacing32),
            ],
          ),
        ),
      ),
    );
  }

  bool get _canSubmit =>
      _usernameController.text.isNotEmpty &&
      _isUsernameAvailable &&
      !_isCheckingUsername &&
      !_isSaving;

  void _onUsernameChanged(String value) {
    _debounce?.cancel();
    setState(() {
      _isCheckingUsername = value.isNotEmpty;
      _isUsernameAvailable = false;
    });

    if (value.isEmpty) return;

    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (!mounted || _usernameController.text != value) return;

      final repo = ref.read(onboardingRepositoryProvider);
      final available = await repo.isUsernameAvailable(value);

      if (mounted && _usernameController.text == value) {
        setState(() {
          _isCheckingUsername = false;
          _isUsernameAvailable = available;
        });
      }
    });
  }

  Future<void> _createAccount() async {
    setState(() => _isSaving = true);
    try {
      final repo = ref.read(onboardingRepositoryProvider);
      await repo.setupProfile(
        username: _usernameController.text.trim(),
        displayName: _displayNameController.text.trim().isNotEmpty
            ? _displayNameController.text.trim()
            : null,
      );
      if (!mounted) return;

      // PRD §4 skip behavior:
      // - Discord linked → Overview (State A or B)
      // - No Discord (skipped) → Library (State C)
      final profile = await repo.getCurrentProfile();
      if (!mounted) return;
      final hasDiscord = profile?.discordId != null;
      context.go(hasDiscord ? RoutePaths.overview : RoutePaths.library);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create profile: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }
}
