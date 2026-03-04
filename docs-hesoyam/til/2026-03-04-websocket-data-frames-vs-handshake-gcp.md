# TIL: WebSocket Handshake ≠ WebSocket Working (GCP e2-micro)

**Date**: 2026-03-04
**Context**: Discord bot on GCP e2-micro VM couldn't complete Supabase Realtime channel subscriptions

## The Problem

`channel.subscribe()` always timed out on the GCP VM, but worked locally. The bot only *sends* presence broadcasts — it never listens for incoming messages.

## What We Found

1. **WebSocket handshake succeeded** — the HTTP 101 Upgrade completed fine
2. **Data frames were silently dropped** — the Phoenix channel `phx_join` message (sent as a WebSocket data frame after the handshake) never got a response
3. **HTTP worked perfectly** — all other Supabase calls (REST, edge functions) had no issues

## Why It Happens

The WebSocket protocol has two distinct phases:

- **Handshake**: An HTTP request upgraded to WebSocket via `101 Switching Protocols`. This uses standard HTTP, so firewalls/proxies pass it through.
- **Data frames**: Once upgraded, the connection sends binary/text frames over a persistent TCP connection. GCP's shared networking on e2-micro instances can silently drop or fail to route these frames.

Supabase Realtime uses Phoenix channels, which require a `phx_join` data frame to complete subscription. If data frames are dropped, the join never completes → `TIMED_OUT`.

## The Fix

Since the bot only *sends* broadcasts (never subscribes/listens), WebSocket is unnecessary. Switched from:

```typescript
// Old: Required WebSocket subscription before sending
const channel = supabase.channel(`presence:${userId}`);
await channel.subscribe(); // ← hangs on GCP
await channel.send({ type: 'broadcast', event: 'game_presence', payload });
```

To:

```typescript
// New: Stateless HTTP POST, no subscription needed
const channel = supabase.channel(`presence:${userId}`);
await channel.httpSend('game_presence', payload);
```

`httpSend()` sends via `POST /realtime/v1/api/broadcast` — completely bypasses the WebSocket path.

## Diagnostic Approach

1. Added verbose logging to `channel.subscribe()` — saw it always timed out
2. Confirmed the WebSocket handshake (101) succeeded via curl
3. Noticed all HTTP-based Supabase calls worked fine
4. Concluded: handshake OK, data frames broken → network layer issue
5. Since bot is send-only, REST broadcast is the correct pattern

## Takeaway

**WebSocket handshake succeeding does not mean WebSocket is working.** The handshake is HTTP; the actual communication happens on data frames over a persistent TCP connection. Shared/constrained network environments (like GCP e2-micro) can break one without breaking the other.

For one-way senders that don't need to subscribe/listen, always prefer `httpSend()` over `channel.send()`.
