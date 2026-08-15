package com.blokhr.capture.session

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

data class CaptureSession(
    val availableModalities: List<String>,
    val rollCall: Boolean,
)

/** Fetches server-gated modalities. UI must not invent modalities. */
class SessionTokenClient(private val apiBase: String) {
    private val http = OkHttpClient()

    fun fetch(subjectType: String, deviceId: String?): CaptureSession {
        val url = buildString {
            append(apiBase.trimEnd('/'))
            append("/api/capture/session-token?subject_type=")
            append(subjectType)
            if (!deviceId.isNullOrBlank()) {
                append("&device_id=")
                append(deviceId)
            }
        }
        val req = Request.Builder().url(url).get().build()
        http.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            val json = JSONObject(body)
            val mods = json.optJSONArray("available_modalities")
            val list = mutableListOf<String>()
            if (mods != null) {
                for (i in 0 until mods.length()) list.add(mods.getString(i))
            }
            return CaptureSession(list, json.optBoolean("roll_call", false))
        }
    }
}
