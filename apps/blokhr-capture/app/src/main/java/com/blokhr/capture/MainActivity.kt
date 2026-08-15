package com.blokhr.capture

import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.blokhr.capture.bus.BusRfidController
import com.blokhr.capture.face.FaceEmbedPipeline
import com.blokhr.capture.fingerprint.FingerprintOtgController
import com.blokhr.capture.nfc.NfcCaptureController
import com.blokhr.capture.queue.EncryptedEventQueue
import com.blokhr.capture.session.SessionTokenClient

/**
 * Entry for NFC / FP / face / bus deep links.
 * Modalities are never chosen locally — only [SessionTokenClient] results drive UI.
 */
class MainActivity : AppCompatActivity() {
    private val queue by lazy { EncryptedEventQueue(this) }
    private val session by lazy { SessionTokenClient(BuildConfig.API_BASE) }
    private val nfc by lazy { NfcCaptureController(this, queue, session) }
    private val fingerprint by lazy { FingerprintOtgController(this, queue, session) }
    private val face by lazy { FaceEmbedPipeline(this, queue, session) }
    private val bus by lazy { BusRfidController(this, queue, session) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val tv = TextView(this).apply {
            text = "BlokHR Capture — waiting for modality from session-token"
            setPadding(48, 48, 48, 48)
        }
        setContentView(tv)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val path = intent?.data?.pathSegments?.firstOrNull() ?: "nfc"
        when (path) {
            "nfc" -> nfc.start(intent)
            "fingerprint" -> fingerprint.start(intent)
            "face" -> face.start(intent)
            "bus" -> bus.start(intent)
            else -> nfc.start(intent)
        }
    }
}
