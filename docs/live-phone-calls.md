# Seller live calls

`ON_SERVER.livePhoneCalls` enables call popups for sellers with an assigned extension. The paired
backend and signed office AMI bridge must be running. Deployment and rollback steps live in
`shamrad/lang` under `docs/seller-phone-calls.md`. Turn this flag off when rolling that service back.

`GET /api/sales/v1/calls/` returns `{available, enabled, connected, extension, server_time, calls}`
using the current Django session. The server chooses the seller's extension and applies existing
customer permissions. `available` with no `extension` means the seller hasn't picked their desk phone:
the Today page links to Settings, where `GET`/`PUT /api/sales/v1/calls/extension/` (`{extension:
"104" | null}`, 409 when another active seller has it) sets it. This is the office PBX desk phone,
not the PortSIP `internal_number` from staff admin. Each call contains `id`, `extension`, `phone`, `direction` (`inbound`/`outbound`),
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
