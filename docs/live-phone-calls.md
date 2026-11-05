# Seller live calls

Implementation is staged behind `ON_SERVER.livePhoneCalls = false`. Deploy the paired backend
`shamrad/lang` change and office AMI bridge before enabling it. Deployment and rollback steps live
in that repository's `docs/seller-phone-calls.md`; no PBX or production configuration is changed by
this frontend commit.

`GET /api/sales/v1/calls/` returns `{enabled, connected, extension, server_time, calls}` using the
current Django session. The server chooses the seller's extension and applies existing customer
permissions. Each call contains `id`, `extension`, `phone`, `direction` (`inbound`/`outbound`),
`status` (`ringing`/`connected`/`ended`/`missed`/`cancelled`), ISO `started_at`, nullable
`answered_at`/`ended_at`, and `customer: {id, name} | null`.

One listener in `WorkspaceLayout` polls every two seconds, including across route changes.
Known customers open the existing contact form; unmatched callers open a number-only card.
Polling only updates call metadata: typed notes, selected outcomes and minimization survive.
Dismissed calls do not reopen on every poll; historical completed calls do not auto-open.
Session storage belongs to one account and is cleared at logout. No contact, follow-up or SMS is
created automatically.

The timer uses answer/end timestamps and a server clock offset. Before answer it shows ringing
time; after answer it shows conversation time. Ending freezes the timer. Bridge/API failures keep
the draft and show that live updates are unavailable. Browser timers never make API requests.

Before activation, verify incoming queue calls, handset outgoing calls, missed calls, transfers,
unknown callers, minimization, reload, seller switching and bridge reconnection with real office
phones. Transcription and durable call history are a later feature.
