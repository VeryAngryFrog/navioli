package com.example.navioli_beacon_1

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.example.radartest.RadarManager

class MainActivity : ComponentActivity() {

    private var voiceManager: VoiceManager? = null

    // 0 = Ready, 1 = Waiting for Beacon, 2 = Waiting for Product
    private var dialogStep by mutableStateOf(0)
    private var currentBeacon by mutableStateOf("beacon_entrance")
    private var currentProduct by mutableStateOf("milk")

    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.CAMERA] == true) {
            startRadar()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkAndRequestPermissions()
        initVoiceManager()

        setContent {
            val context = LocalContext.current
            var activeRoute by remember { mutableStateOf<List<String>>(emptyList()) }

            LaunchedEffect(activeRoute) {
                if (activeRoute.isNotEmpty()) {
                    voiceManager?.speak("Route found. Here are the instructions:")
                    activeRoute.forEachIndexed { index, step ->
                        Handler(Looper.getMainLooper()).postDelayed({
                            voiceManager?.speak(step)
                        }, (index * 4500).toLong())
                    }
                }
            }

            // Textzustand für das Innere der Ravioli ermitteln
            val textForRavioli = when(dialogStep) {
                1 -> "Listening for\nLocation..."
                2 -> "Listening for\nProduct..."
                else -> "Tap Ravioli\nto Speak"
            }

            // HIER RUFEN WIR DIE NEUE DESIGN-KLASSE AUF!
            NavioliAppScreen(
                buttonText = textForRavioli,
                currentBeacon = currentBeacon,
                currentProduct = currentProduct,
                onRavioliClick = {
                    dialogStep = 1
                    activeRoute = emptyList()
                    voiceManager?.speak("Please state your location. Say entrance or aisle one.")

                    Handler(Looper.getMainLooper()).postDelayed({
                        voiceManager?.startListening()
                    }, 5000)
                }
            )
        }
    }

    private fun initVoiceManager() {
        try {
            voiceManager?.destroy()
            voiceManager = null
            voiceManager = VoiceManager(this) { spokenText ->
                processVoiceInput(spokenText)
            }
        } catch (e: Exception) {
            Log.e("MAIN", "Error initializing VoiceManager", e)
        }
    }

    private fun processVoiceInput(word: String) {
        Log.d("MAIN_VOICE", "Step $dialogStep received word: $word")

        if (dialogStep == 1) {
            if (word.contains("entrance")) {
                currentBeacon = "beacon_entrance"
                dialogStep = 2
                voiceManager?.speak("Location entrance recorded. Which product are you looking for? Milk, bread, or pasta?")
                startVoiceInputDelayed(6000)
            } else if (word.contains("aisle one") || word.contains("aisle 1") || word.contains("one")) {
                currentBeacon = "beacon_aisle_1"
                dialogStep = 2
                voiceManager?.speak("Location aisle 1 recorded. Which product are you looking for? Milk, bread, or pasta?")
                startVoiceInputDelayed(6000)
            } else {
                voiceManager?.speak("I did not understand you. Please say again: entrance or aisle one.")
                startVoiceInputDelayed(5000)
            }
        } else if (dialogStep == 2) {
            var productFound = false

            if (word.contains("milk")) {
                currentProduct = "milk"
                productFound = true
                voiceManager?.speak("Search for milk started.")
            } else if (word.contains("bread")) {
                currentProduct = "bread"
                productFound = true
                voiceManager?.speak("Search for bread started.")
            } else if (word.contains("pasta") || word.contains("noodles")) {
                currentProduct = "pasta"
                productFound = true
                voiceManager?.speak("Search for pasta started.")
            }

            if (productFound) {
                dialogStep = 0
                Handler(Looper.getMainLooper()).postDelayed({
                    val route = getRouteFromJSON(this, currentBeacon, currentProduct)
                    if (route.isNotEmpty()) {
                        voiceManager?.speak("Route found. Here are the instructions:")
                        route.forEachIndexed { index, step ->
                            Handler(Looper.getMainLooper()).postDelayed({
                                voiceManager?.speak(step)
                            }, (index * 4500).toLong())
                        }
                    }
                }, 2500)
            } else {
                voiceManager?.speak("I don't know this product. Please choose: milk, bread, or pasta.")
                startVoiceInputDelayed(5000)
            }
        }
    }

    private fun startVoiceInputDelayed(delayMillis: Long) {
        Handler(Looper.getMainLooper()).postDelayed({
            initVoiceManager()
            Handler(Looper.getMainLooper()).postDelayed({
                voiceManager?.startListening()
            }, 300)
        }, delayMillis)
    }

    private fun checkAndRequestPermissions() {
        val permissions = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missingPermissions.isNotEmpty()) {
            requestPermissionsLauncher.launch(missingPermissions.toTypedArray())
        } else {
            startRadar()
        }
    }

    private fun startRadar() {
        try {
            val radar = RadarManager(this)
            radar.startRadar(this)
        } catch (e: Exception) {
            Log.e("MAIN", "Radar could not be started", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        voiceManager?.destroy()
    }
}