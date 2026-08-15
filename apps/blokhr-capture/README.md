# BlokHR Capture (Android)

Single device agent for HR + School. Package: `com.blokhr.capture`.

## Product invariants

- Raw biometrics never leave the device — extract template/UID locally; discard images/minutiae.
- Modalities come from `GET /api/capture/session-token` only (server-gated).
- No Aadhaar / RD Service. No emotion/attention APIs.
- Students: never fingerprint unless `session-token` includes it (`capture_fingerprint_students` + DPIA). Face/iris only when token includes them.
- iOS companion is separate (QR + roll call only) — this app is Android.

## Capabilities by phase

| Phase | Module | Notes |
|-------|--------|-------|
| 2 | NFC | MIFARE Classic UID; photo-on-tap from roster cache; impossible-sequence handled server-side |
| 3 | OTG fingerprint | Mantra MFS100 / eSSL; dual-finger enrol (`finger_slot` 1\|2); staff + gated students |
| 4 | Face | On-device embed → `payload_b64`; discard frame; India adults first |
| 5 | Bus RFID | Separate legal basis; GPS in event `context` |

## Deep links

- `blokhr://capture/nfc?period_id=&class_id=&gate_id=`
- `blokhr://capture/fingerprint?subject_ref=`
- `blokhr://capture/face`
- `blokhr://capture/bus?route_id=&stop_id=`
- Android Intent: `intent://capture/...#Intent;scheme=blokhr;package=com.blokhr.capture;end`

## Offline queue

Encrypted local queue with client `idempotency_key`, exponential backoff sync to `POST /api/capture/events`.
Wipe template cache on logout / deprovision. TTL from tenant jurisdiction retention.

## Build

Open `apps/blokhr-capture` in Android Studio (API 26+). Vendor SDKs (Mantra/eSSL) are optional compile-time deps behind `fingerprint` product flavor.
