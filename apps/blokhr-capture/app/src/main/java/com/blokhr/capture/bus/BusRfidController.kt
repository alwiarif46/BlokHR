package com.blokhr.capture.bus

import android.app.Activity
import android.content.Intent
import android.location.LocationManager
import android.util.Base64
import android.widget.Toast
import com.blokhr.capture.queue.EncryptedEventQueue
import com.blokhr.capture.session.SessionTokenClient
import org.json.JSONObject

/**
 * Phase 5: bus RFID boarding/alighting with GPS context.
 * Separate module `transport_bus_rfid` / legal basis — not a campus attendance substitute.
 */
class BusRfidController(
    private val activity: Activity,
    private val queue: EncryptedEventQueue,
    private val session: SessionTokenClient,
) {
    fun start(intent: Intent?) {
        val token = runCatching { session.fetch("student", deviceId()) }.getOrNull()
        if (token == null || !token.availableModalities.contains("bus_rfid")) {
            Toast.makeText(activity, "Bus RFID module not entitled", Toast.LENGTH_LONG).show()
            return
        }
        val tagUid = intent?.data?.getQueryParameter("rfid") ?: return
        val payloadB64 = Base64.encodeToString(tagUid.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        val loc = lastKnownLocation()
        val ctx = JSONObject()
            .put("route_id", intent.data?.getQueryParameter("route_id") ?: "")
            .put("stop_id", intent.data?.getQueryParameter("stop_id") ?: "")
            .put("event_kind", intent.data?.getQueryParameter("kind") ?: "board")
            .put("lat", loc?.first)
            .put("lng", loc?.second)
            .put("legal_basis", "transport_bus_rfid")
        queue.enqueue("bus_rfid", payloadB64, ctx, deviceId())
        Toast.makeText(activity, "Bus RFID event queued", Toast.LENGTH_SHORT).show()
    }

    private fun lastKnownLocation(): Pair<Double, Double>? {
        val lm = activity.getSystemService(LocationManager::class.java) ?: return null
        val loc = runCatching {
            lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        }.getOrNull() ?: return null
        return loc.latitude to loc.longitude
    }

    private fun deviceId(): String =
        android.provider.Settings.Secure.getString(activity.contentResolver, android.provider.Settings.Secure.ANDROID_ID)
            ?: "android-unknown"
}
