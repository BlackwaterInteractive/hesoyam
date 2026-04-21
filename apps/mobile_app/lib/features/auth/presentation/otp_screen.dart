import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import 'providers/auth_provider.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({required this.email, super.key});

  final String email;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _controllers = List.generate(6, (_) => TextEditingController());
  final _focusNodes = List.generate(6, (_) => FocusNode());
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _otp => _controllers.map((c) => c.text).join();

  Future<void> _verify() async {
    if (_otp.length < 6) {
      setState(() => _error = 'Enter the full 6-digit code');
      return;
    }

    setState(() { _isLoading = true; _error = null; });
    try {
      await ref.read(authRepositoryProvider).verifyOtp(widget.email, _otp);
      if (mounted) context.go(RoutePaths.getStarted);
    } catch (e) {
      if (mounted) setState(() => _error = 'Invalid or expired code');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resend() async {
    try {
      await ref.read(authRepositoryProvider).signInWithOtp(widget.email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Code resent')),
        );
      }
    } catch (_) {}
  }

  void _onChanged(int index, String value) {
    if (value.isNotEmpty && index < 5) {
      _focusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
    // Auto-submit when all 6 digits entered
    if (_otp.length == 6) _verify();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(AppTheme.spacing16),

              GestureDetector(
                onTap: () => context.pop(),
                child: Text(
                  '\u2190 Back',
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                ),
              ),

              const Gap(AppTheme.spacing32),

              Text('Verify your email', style: AppTypography.headlineLarge),
              const Gap(AppTheme.spacing8),
              Text(
                'We sent a code to ${widget.email}',
                style: AppTypography.bodyMedium,
              ),

              const Gap(AppTheme.spacing32),

              if (_error != null) ...[
                Text(
                  _error!,
                  style: AppTypography.bodySmall.copyWith(color: AppColors.error),
                ),
                const Gap(AppTheme.spacing12),
              ],

              // OTP boxes
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(6, (i) {
                  return Container(
                    width: 48,
                    height: 56,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    child: TextField(
                      controller: _controllers[i],
                      focusNode: _focusNodes[i],
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      maxLength: 1,
                      enabled: !_isLoading,
                      style: AppTypography.headlineMedium.copyWith(
                        color: AppColors.accent,
                      ),
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(
                        counterText: '',
                        contentPadding: EdgeInsets.symmetric(vertical: 14),
                      ),
                      onChanged: (v) => _onChanged(i, v),
                    ),
                  );
                }),
              ),

              const Gap(AppTheme.spacing32),

              ElevatedButton(
                onPressed: _isLoading ? null : _verify,
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Verify'),
              ),

              const Gap(AppTheme.spacing12),

              Center(
                child: TextButton(
                  onPressed: _isLoading ? null : _resend,
                  child: const Text('Resend code'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
