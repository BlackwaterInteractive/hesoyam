import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/config/env.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';
import 'providers/onboarding_provider.dart';

class JoinServerScreen extends ConsumerStatefulWidget {
  const JoinServerScreen({super.key});

  @override
  ConsumerState<JoinServerScreen> createState() => _JoinServerScreenState();
}

class _JoinServerScreenState extends ConsumerState<JoinServerScreen> {
  StreamSubscription<bool>? _guildSub;
  bool _waiting = false;

  @override
  void initState() {
    super.initState();
    // Listen for in_guild becoming true
    final repo = ref.read(onboardingRepositoryProvider);
    _guildSub = repo.watchInGuild().listen((inGuild) {
      if (inGuild && mounted) {
        context.go(RoutePaths.createAccount);
      }
    });
  }

  @override
  void dispose() {
    _guildSub?.cancel();
    super.dispose();
  }

  Future<void> _joinServer() async {
    setState(() => _waiting = true);
    final uri = Uri.parse(Env.discordInviteUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
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
              const Gap(AppTheme.spacing48),

              Text('Join our Discord', style: AppTypography.headlineLarge),
              const Gap(AppTheme.spacing8),
              Text(
                'Join the RAID server so our bot can detect your gameplay and start tracking.',
                style: AppTypography.bodyMedium,
              ),

              const Gap(AppTheme.spacing32),

              // Server card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppTheme.spacing32),
                decoration: BoxDecoration(
                  color: AppColors.surface1,
                  borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: AppColors.discord,
                        borderRadius: BorderRadius.circular(AppTheme.radiusLarge),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.gamepad_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                    ),
                    const Gap(AppTheme.spacing16),
                    Text('RAID Gaming', style: AppTypography.headlineMedium),
                    const Gap(AppTheme.spacing20),
                    SizedBox(
                      width: 180,
                      child: ElevatedButton.icon(
                        onPressed: _joinServer,
                        icon: const Icon(Icons.open_in_new_rounded, size: 18),
                        label: const Text('Join Server'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.discord,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(180, 44),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const Gap(AppTheme.spacing24),

              if (_waiting)
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.textTertiary,
                        ),
                      ),
                      const Gap(AppTheme.spacing8),
                      Text(
                        'Waiting for you to join...',
                        style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
                      ),
                    ],
                  ),
                ),

              const Spacer(),

              Center(
                child: TextButton(
                  onPressed: () => context.go(RoutePaths.createAccount),
                  child: Text(
                    'Skip \u2192',
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                  ),
                ),
              ),
              const Gap(AppTheme.spacing4),
              Center(
                child: Text(
                  'Without joining, we can\'t detect your games.\nYou can join anytime later.',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textDisabled,
                    fontSize: 11,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const Gap(AppTheme.spacing24),
            ],
          ),
        ),
      ),
    );
  }
}
