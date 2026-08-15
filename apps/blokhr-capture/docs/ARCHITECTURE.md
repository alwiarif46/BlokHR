# Architecture — BlokHR Capture Android agent

See [../README.md](../README.md).

## Sync worker

Background sync drains `EncryptedEventQueue` → `POST /api/capture/events` with exponential backoff.
Never auto-absent students on `no_match`; surface manual override to the operator.

## Photo-on-tap (NFC)

At login, cache roster `{ subject_ref, display_name, photo_url, nfc_uid_hint }` for operator scope.
On tag, show photo before/while queuing the event (buddy-punch mitigation).

## Lost card

Call `POST /api/capture/temporary-qr` (admin) and print/display QR for teacher scan until card replaced.
