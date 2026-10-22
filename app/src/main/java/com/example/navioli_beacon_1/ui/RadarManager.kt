package com.example.radartest

import android.content.Context
import android.os.*
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import com.google.mlkit.vision.objects.*
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import java.util.concurrent.Executors

class RadarManager(private val context: Context) {

    private val ALARM_SCHWELLE = 500f
    private val messwerteListe = mutableListOf<Float>()
    private var lastVibration = 0L

    @OptIn(ExperimentalGetImage::class)

    fun startRadar(lifecycleOwner: LifecycleOwner) {
        val providerFuture = ProcessCameraProvider.getInstance(context)

        providerFuture.addListener({
            val provider = providerFuture.get()

            val options = ObjectDetectorOptions.Builder()
                .setDetectorMode(ObjectDetectorOptions.STREAM_MODE)
                .build()
            val detector = ObjectDetection.getClient(options)

            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            // Hier der fix fÃ¼r den ImageProxy-Zugriff:
            analysis.setAnalyzer(Executors.newSingleThreadExecutor()) { imageProxy: ImageProxy ->
                val mediaImage = imageProxy.image

                if (mediaImage != null) {
                    val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

                    detector.process(image)
                        .addOnSuccessListener { results ->
                            val obj = results.firstOrNull()
                            if (obj != null) {
                                val aktuelleHoehe = obj.boundingBox.height().toFloat()
                                messwerteListe.add(aktuelleHoehe)
                                if (messwerteListe.size > 10) messwerteListe.removeAt(0)

                                if (messwerteListe.average() > ALARM_SCHWELLE) {
                                    triggerVibration()
                                }
                            } else {
                                messwerteListe.clear()
                            }
                        }
                        .addOnCompleteListener {
                            // Wichtig: Der Proxy muss immer geschlossen werden, egal ob erfolgreich oder nicht
                            imageProxy.close()
                        }
                } else {
                    imageProxy.close()
                }
            }

            provider.unbindAll()
            provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, analysis)

        }, ContextCompat.getMainExecutor(context))
    }

    private fun triggerVibration() {
        if (System.currentTimeMillis() - lastVibration > 300) {
            val v = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= 26) {
                v.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(200)
            }
            lastVibration = System.currentTimeMillis()
        }
    }
}