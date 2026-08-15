package com.blokhr.capture.face

import android.app.Activity
import android.content.Intent
import android.util.Base64
import android.widget.Toast
import com.blokhr.capture.queue.EncryptedEventQueue
import com.blokhr.capture.session.SessionTokenClient
import org.json.JSONObject

/**
 * Phase 4: on-device embedding → template only. Discard camera frame.
 * No emotion / attention / engagement. Jurisdiction hard-blocks come from session-token
 * (EU/UK/NY never see face in available_modalities).
 */
class FaceEmbedPipeline(
    private val activity: Activity,
    private val queue: EncryptedEventQueue,
    private val session: SessionTokenClient,
) {
    fun start(intent: Intent?) {
        val subjectType = intent?.data?.getQueryParameter("subject_type") ?: "staff"
        val token = runCatching { session.fetch(subjectType, deviceId()) }.getOrNull()
        if (token == null || !token.availableModalities.contains("face")) {
            Toast.makeText(activity, "Face not available (geo/entitlement/DPIA gate)", Toast.LENGTH_LONG).show()
            return
        }
        val embed = OnDeviceFaceEmbedder.embedAndDiscardFrame()
        if (embed == null) {
            Toast.makeText(activity, "Face embed failed", Toast.LENGTH_SHORT).show()
            return
        }
        val payloadB64 = Base64.encodeToString(embed, Base64.NO_WRAP)
        queue.enqueue("face", payloadB64, JSONObject().put("algo", "blokhr.face.embed.v1"), deviceId())
        Toast.makeText(activity, "Face template queued (image discarded)", Toast.LENGTH_SHORT).show()
    }

    private fun deviceId(): String =
        android.provider.Settings.Secure.getString(activity.contentResolver, android.provider.Settings.Secure.ANDROID_ID)
            ?: "android-unknown"
}

object OnDeviceFaceEmbedder {
    /** Capture → embed → zero camera buffer. Never return bitmap. */
    fun embedAndDiscardFrame(): ByteArray? {
        // Wire MediaPipe / TFLite face embedder; discard input tensor after inference.
        return null
    }
}
