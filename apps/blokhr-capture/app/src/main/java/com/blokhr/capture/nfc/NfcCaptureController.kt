package com.blokhr.capture.nfc

import android.app.Activity
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.MifareClassic
import android.util.Base64
import android.widget.Toast
import com.blokhr.capture.queue.EncryptedEventQueue
import com.blokhr.capture.session.SessionTokenClient
import org.json.JSONObject

/**
 * Phase 2: read MIFARE Classic UID, show roster photo-on-tap (caller supplies photo URL),
 * queue event. Impossible-sequence is enforced server-side when gate_id is present.
 * Lost card → temporary QR is issued via Capture Admin /api/capture/temporary-qr.
 */
class NfcCaptureController(
    private val activity: Activity,
    private val queue: EncryptedEventQueue,
    private val session: SessionTokenClient,
) {
    fun start(intent: Intent?) {
        val token = runCatching { session.fetch("student", deviceId()) }.getOrNull()
        if (token == null || !token.availableModalities.contains("nfc")) {
            Toast.makeText(activity, "NFC not available in session-token", Toast.LENGTH_LONG).show()
            return
        }
        val adapter = NfcAdapter.getDefaultAdapter(activity)
        if (adapter == null) {
            Toast.makeText(activity, "No NFC hardware", Toast.LENGTH_LONG).show()
            return
        }
        val tag = intent?.getParcelableExtra<Tag>(NfcAdapter.EXTRA_TAG)
        if (tag != null) {
            onTag(tag, intent)
            return
        }
        Toast.makeText(activity, "Ready — tap NFC card", Toast.LENGTH_SHORT).show()
        adapter.enableForegroundDispatch(
            activity,
            android.app.PendingIntent.getActivity(
                activity,
                0,
                Intent(activity, activity.javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                android.app.PendingIntent.FLAG_MUTABLE,
            ),
            null,
            null,
        )
    }

    private fun onTag(tag: Tag, intent: Intent?) {
        val uid = tag.id.joinToString("") { b -> "%02X".format(b) }
        // Photo-on-tap: look up cached roster photo by pending match; UI layer shows bitmap.
        val photoHint = RosterPhotoCache.lookupByUidHint(uid)
        if (photoHint != null) {
            Toast.makeText(activity, "Photo: $photoHint", Toast.LENGTH_SHORT).show()
        }
        val payloadB64 = Base64.encodeToString(uid.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        val ctx = JSONObject()
            .put("period_id", intent?.data?.getQueryParameter("period_id") ?: "")
            .put("class_id", intent?.data?.getQueryParameter("class_id") ?: "")
            .put("gate_id", intent?.data?.getQueryParameter("gate_id") ?: "gate_main")
            .put("photo_shown", photoHint != null)
        queue.enqueue("nfc", payloadB64, ctx, deviceId())
        Toast.makeText(activity, "NFC saved (pending sync=${queue.pendingCount()})", Toast.LENGTH_SHORT).show()
        // Prefer MifareClassic auth only for UID — never store sector keys / Aadhaar.
        runCatching { MifareClassic.get(tag)?.close() }
    }

    private fun deviceId(): String =
        android.provider.Settings.Secure.getString(activity.contentResolver, android.provider.Settings.Secure.ANDROID_ID)
            ?: "android-unknown"
}

object RosterPhotoCache {
    private val map = mutableMapOf<String, String>()
    fun put(uidHint: String, photoUrl: String) {
        map[uidHint] = photoUrl
    }
    fun lookupByUidHint(uid: String): String? = map[uid]
}
