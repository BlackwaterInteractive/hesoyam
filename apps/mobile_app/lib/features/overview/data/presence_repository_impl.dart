import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/dashboard_stats.dart';

/// Manages live game presence via Supabase Realtime + DB fallback.
///
/// On subscribe:
/// 1. Checks DB for an active session (ended_at IS NULL) — handles the case
///    where the user opens the app while already playing.
/// 2. Listens to Realtime broadcast for live updates (start/heartbeat/end).
/// 3. Staleness: clears presence if no heartbeat for 45s, but re-checks DB
///    before declaring "not playing" (per PRD §5.1).
class PresenceRepository {
  PresenceRepository(this._client);

  final SupabaseClient _client;
  RealtimeChannel? _channel;
  Timer? _staleTimer;
  DateTime? _lastHeartbeat;

  final _controller = StreamController<GamePresence?>.broadcast();

  Stream<GamePresence?> get presenceStream => _controller.stream;

  /// Subscribe to a user's game presence.
  /// Emits initial state from DB, then live updates from Realtime.
  void subscribe(String userId) {
    unsubscribe();

    // 1. Check DB for existing active session first
    _checkActiveSession(userId);

    // 2. Subscribe to Realtime broadcast for live updates
    _channel = _client
        .channel('presence:$userId', opts: const RealtimeChannelConfig(self: false))
        .onBroadcast(event: 'game_presence', callback: (payload) {
          final event = payload['event'] as String?;

          if (event == 'end') {
            _controller.add(null);
            _lastHeartbeat = null;
          } else {
            _lastHeartbeat = DateTime.now();
            _controller.add(GamePresence.fromJson(payload));
          }
        })
        .subscribe();

    // 3. Staleness check — if no heartbeat for 45s, verify with DB
    _staleTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_lastHeartbeat != null &&
          DateTime.now().difference(_lastHeartbeat!).inSeconds > 45) {
        _lastHeartbeat = null;
        // Re-check DB before clearing — PRD §5.1 staleness behavior
        _checkActiveSession(userId);
      }
    });
  }

  /// Check DB for an active session and emit presence or null.
  Future<void> _checkActiveSession(String userId) async {
    try {
      final data = await _client
          .from('game_sessions')
          .select('*, games(name, slug, cover_url)')
          .eq('user_id', userId)
          .isFilter('ended_at', null)
          .order('started_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (data != null) {
        final game = data['games'] as Map<String, dynamic>?;
        _controller.add(GamePresence(
          userId: userId,
          gameId: data['game_id'] as String? ?? '',
          gameName: game?['name'] as String? ?? data['game_name'] as String? ?? 'Unknown Game',
          gameSlug: game?['slug'] as String? ?? '',
          coverUrl: game?['cover_url'] as String?,
          startedAt: data['started_at'] as String,
          event: 'start',
        ));
      } else {
        _controller.add(null);
      }
    } catch (_) {
      // DB check failed — emit null so UI doesn't hang on loading
      _controller.add(null);
    }
  }

  void unsubscribe() {
    _staleTimer?.cancel();
    if (_channel != null) {
      _client.removeChannel(_channel!);
      _channel = null;
    }
    _lastHeartbeat = null;
  }

  void dispose() {
    unsubscribe();
    _controller.close();
  }
}
