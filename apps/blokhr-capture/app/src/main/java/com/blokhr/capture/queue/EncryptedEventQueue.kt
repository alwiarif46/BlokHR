package com.blokhr.capture.queue

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Encrypted offline event queue. Syncs to POST /api/capture/events with idempotency_key.
 * Wipe on logout via [clear].
 */
class EncryptedEventQueue(context: Context) {
    private val file = File(context.filesDir, "capture_queue.enc")
    private val keyBytes = context.getSharedPreferences("capture", Context.MODE_PRIVATE)
        .getString("qkey", null)
        ?.let { Base64.decode(it, Base64.NO_WRAP) }
        ?: ByteArray(32).also { bytes ->
            java.security.SecureRandom().nextBytes(bytes)
            context.getSharedPreferences("capture", Context.MODE_PRIVATE)
                .edit()
                .putString("qkey", Base64.encodeToString(bytes, Base64.NO_WRAP))
                .apply()
        }

    fun enqueue(
        modality: String,
        payloadB64: String,
        contextJson: JSONObject,
        deviceId: String,
    ): String {
        val idem = "dev_" + UUID.randomUUID().toString().replace("-", "")
        val item = JSONObject()
            .put("modality", modality)
            .put("payload_b64", payloadB64)
            .put("idempotency_key", idem)
            .put("device_id", deviceId)
            .put("context", contextJson)
            .put("captured_at", java.time.Instant.now().toString())
        val arr = load()
        arr.put(item)
        save(arr)
        return idem
    }

    fun pendingCount(): Int = load().length()

    fun drainForSync(): JSONArray = load()

    fun replaceAfterSync(remaining: JSONArray) = save(remaining)

    fun clear() {
        if (file.exists()) file.delete()
    }

    private fun load(): JSONArray {
        if (!file.exists()) return JSONArray()
        return try {
            val raw = file.readBytes()
            val plain = decrypt(raw)
            JSONArray(String(plain, Charsets.UTF_8))
        } catch (_: Exception) {
            JSONArray()
        }
    }

    private fun save(arr: JSONArray) {
        file.writeBytes(encrypt(arr.toString().toByteArray(Charsets.UTF_8)))
    }

    private fun encrypt(plain: ByteArray): ByteArray {
        val iv = ByteArray(12).also { java.security.SecureRandom().nextBytes(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
        return iv + cipher.doFinal(plain)
    }

    private fun decrypt(blob: ByteArray): ByteArray {
        val iv = blob.copyOfRange(0, 12)
        val ct = blob.copyOfRange(12, blob.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
        return cipher.doFinal(ct)
    }
}
