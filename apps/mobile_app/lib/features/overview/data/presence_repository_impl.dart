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
/// 4. Periodic reconciliation: re-queries DB every 60s to recover from
///    broadcasts missed while the app was backgrounded or disconnected.
///    Broadcasts are at-most-once — without this, missed 'start' events
///    leave the UI stale until the user kills and relaunches the app.
class PresenceRepository {
  PresenceRepository(this._client);

  final SupabaseClient _client;
  RealtimeChannel? _channel;
  Timer? _staleTimer;
  Timer? _reconcileTimer;
  DateTime? _lastHeartbeat;
  String? _subscribedUserId;

  final _controller = StreamController<GamePresence?>.broadcast();

  Stream<GamePresence?> get presenceStream => _controller.stream;

  /// Subscribe to a user's game presence.
  /// Emits initial state from DB, then live updates from Realtime.
  void subscribe(String userId) {
    unsubscribe();
    _subscribedUserId = userId;

    // 1. Check DB for existing active session first
    _checkActiveSession(userId);

    // 2. Subscribe to Realtime broadcast for live updates.
    // The callback receives the full Phoenix envelope — the real payload is nested
    // under `payload['payload']`. Construct GamePresence manually with null-safe
    // defaults because the backend doesn't include `game_id` in the broadcast.
    _channel = _client
        .channel('presence:$userId', opts: const RealtimeChannelConfig(self: false))
        .onBroadcast(event: 'game_presence', callback: (envelope) {
          final body = envelope['payload'] as Map<String, dynamic>?;
          if (body == null) return;
          final event = body['event'] as String?;

          if (event == 'end') {
            _controller.add(null);
            _lastHeartbeat = null;
          } else {
            _lastHeartbeat = DateTime.now();
            _controller.add(GamePresence(
              userId: body['user_id'] as String? ?? userId,
              gameId: body['game_id'] as String? ?? '',
              gameName: body['game_name'] as String? ?? 'Unknown Game',
              gameSlug: body['game_slug'] as String? ?? '',
              coverUrl: body['cover_url'] as String?,
              startedAt: body['started_at'] as String? ?? DateTime.now().toIso8601String(),
              event: event ?? 'start',
            ));
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

    // 4. Periodic reconciliation for missed broadcasts (see class docstring)
    _reconcileTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      _checkActiveSession(userId);
    });
  }

  /// Force a DB re-check. Called on app resume and pull-to-refresh to
  /// correct drift when broadcasts may have been missed.
  Future<void> refresh() async {
    final userId = _subscribedUserId;
    if (userId == null) return;
    await _checkActiveSession(userId);
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
    _reconcileTimer?.cancel();
    if (_channel != null) {
      _client.removeChannel(_channel!);
      _channel = null;
    }
    _lastHeartbeat = null;
    _subscribedUserId = null;
  }

  void dispose() {
    unsubscribe();
    _controller.close();
  }
}
