import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_typography.dart';

/// Connect Discord — Section 2.2
///
/// Two methods: Discord OAuth or Enter Discord ID.
/// Skip goes to create account (no tracking).
class ConnectDiscordScreen extends StatefulWidget {
  const ConnectDiscordScreen({super.key});

  @override
  State<ConnectDiscordScreen> createState() => _ConnectDiscordScreenState();
}

class _ConnectDiscordScreenState extends State<ConnectDiscordScreen> {
  final _discordIdController = TextEditingController();

  @override
  void dispose() {
    _discordIdController.dispose();
    super.dispose();
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

              // ── Back ──────────────────────────────────────
              GestureDetector(
                onTap: () => context.pop(),
                child: Text(
                  '← Back',
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ),

              const Gap(AppTheme.spacing24),

              Text('Connect Discord', style: AppTypography.headlineLarge),
              const Gap(AppTheme.spacing8),
              Text(
                'Link your Discord account so we can detect your games via Rich Presence.',
                style: AppTypography.bodyMedium,
              ),

              const Gap(AppTheme.spacing32),

              // ── Discord OAuth ─────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 52,
                child: Material(
                  color: AppColors.discord,
                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    onTap: _connectWithOAuth,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.link_rounded, color: Colors.white, size: 20),
                        const Gap(AppTheme.spacing12),
                        Text(
                          'Sign in with Discord',
                          style: AppTypography.labelLarge.copyWith(
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const Gap(AppTheme.spacing24),

              // ── Divider ───────────────────────────────────
              Row(
                children: [
                  const Expanded(child: Divider()),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacing16,
                    ),
                    child: Text('OR', style: AppTypography.bodySmall),
                  ),
                  const Expanded(child: Divider()),
                ],
              ),

              const Gap(AppTheme.spacing24),

              // ── Discord ID input ──────────────────────────
              Text(
                'Enter your Discord ID',
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const Gap(AppTheme.spacing8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _discordIdController,
                      keyboardType: TextInputType.number,
                      style: AppTypography.bodyLarge,
                      decoration: const InputDecoration(
                        hintText: 'e.g. 123456789012345678',
                      ),
                    ),
                  ),
                  const Gap(AppTheme.spacing8),
                  Container(
                    height: 52,
                    width: 52,
                    decoration: BoxDecoration(
                      color: AppColors.accent,
                      borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.arrow_forward_rounded),
                      color: Colors.black,
                      onPressed: _submitDiscordId,
                    ),
                  ),
                ],
              ),

              const Spacer(),

              // ── Skip ──────────────────────────────────────
              Center(
                child: TextButton(
                  onPressed: () => context.go(RoutePaths.createAccount),
                  child: Text(
                    'Skip →',
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.textTertiary,
                    ),
                  ),
                ),
              ),

              const Gap(AppTheme.spacing24),
            ],
          ),
        ),
      ),
    );
  }

  void _connectWithOAuth() {
    // TODO: Implement Discord OAuth linking
  }

  void _submitDiscordId() {
    final id = _discordIdController.text.trim();
    if (id.isNotEmpty) {
      context.push(RoutePaths.verifyDiscord);
    }
  }
}
