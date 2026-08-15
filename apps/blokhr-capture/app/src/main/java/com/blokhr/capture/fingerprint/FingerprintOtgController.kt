package com.blokhr.capture.fingerprint

import android.app.Activity
import android.content.Intent
import android.util.Base64
import android.widget.Toast
import com.blokhr.capture.queue.EncryptedEventQueue
import com.blokhr.capture.session.SessionTokenClient
import org.json.JSONObject

/**
 * Phase 3: OTG Mantra MFS100 / eSSL — extract template locally only.
 * Dual-finger enrol via finger_slot 1|2.
 * Staff: capture_fingerprint_staff + employment consent; PIN/card/QR fallback.
 * Students: capture_fingerprint_students + DPIA + guardian consent; card/QR fallback (no kiosk PIN).
 * Availability always from session-token for the requested subject_type.
 */
class FingerprintOtgController(
    private val activity: Activity,
    private val queue: EncryptedEventQueue,
    private val session: SessionTokenClient,
) {
    fun start(intent: Intent?) {
        val subjectType = intent?.data?.getQueryParameter("subject_type") ?: "staff"
        val token = runCatching { session.fetch(subjectType, deviceId()) }.getOrNull()
        if (token == null || !token.availableModalities.contains("fingerprint")) {
            val fallback =
                if (subjectType == "student") "use card or QR fallback"
                else "use PIN/kiosk or QR/NFC fallback"
            Toast.makeText(
                activity,
                "Fingerprint not in session-token — $fallback",
                Toast.LENGTH_LONG,
            ).show()
            return
        }
        val subjectRef = intent?.data?.getQueryParameter("subject_ref")
        val enrolMode = intent?.data?.getQueryParameter("mode") == "enrol"
        val slot = intent?.data?.getQueryParameter("finger_slot")?.toIntOrNull() ?: 1
        val tpl = VendorFingerprintSdk.captureTemplate()
        if (tpl == null) {
            Toast.makeText(
                activity,
                if (subjectType == "student") "Reader unavailable — use card or QR"
                else "Reader unavailable — use PIN or card",
                Toast.LENGTH_LONG,
            ).show()
            return
        }
        val payloadB64 = Base64.encodeToString(tpl, Base64.NO_WRAP)
        if (enrolMode) {
            Toast.makeText(
                activity,
                "Enrol finger_slot=$slot for $subjectRef ($subjectType) — POST enrolments + consent_ref",
                Toast.LENGTH_LONG,
            ).show()
            return
        }
        val ctx = JSONObject()
            .put("fallback", if (subjectType == "student") "card_or_qr" else "pin_or_card")
            .put("subject_type", subjectType)
            .put("period_id", intent?.data?.getQueryParameter("period_id") ?: "")
            .put("class_id", intent?.data?.getQueryParameter("class_id") ?: "")
        queue.enqueue("fingerprint", payloadB64, ctx, deviceId())
        Toast.makeText(activity, "Fingerprint queued ($subjectType)", Toast.LENGTH_SHORT).show()
    }

    private fun deviceId(): String =
        android.provider.Settings.Secure.getString(activity.contentResolver, android.provider.Settings.Secure.ANDROID_ID)
            ?: "android-unknown"
}

/** Stub until Mantra/eSSL AAR is on the classpath. Never sends raw images. */
object VendorFingerprintSdk {
    fun captureTemplate(): ByteArray? {
        // Integrate Mantra MFS100 / eSSL Capture here; return ISO/vendor template bytes only.
        return null
    }
}
