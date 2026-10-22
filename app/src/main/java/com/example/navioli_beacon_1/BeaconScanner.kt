package com.example.navioli_beacon_1

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import android.util.Log

class BeaconScanner(context: Context, private val onBeaconFound: (Map<String, Int>) -> Unit) {

    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager.adapter
    private val bleScanner = bluetoothAdapter?.bluetoothLeScanner

    // Hier speichern wir die aktuell gescannten Beacons und ihre Signalstärke
    private val latestScanResults = mutableMapOf<String, Int>()

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val deviceAddress = result.device.address                   // MAC-Adresse des Beacons
            val deviceName = result.device.name ?: "Unbekanntes Gerät"  // Name des Geräts
            val rssi = result.rssi                                      // Die Signalstärke

            //printet jedes gefundene Gerät in die Konsole (NUR ALS TEST)
            println("BLE-LIVE-FUND: Name: $deviceName | MAC: $deviceAddress | Signal: $rssi dBm")

            latestScanResults[deviceAddress] = rssi                     // speichert das Signal ab
            onBeaconFound(latestScanResults)                            // aktualisierte Liste wird an die Logik gegeben

            Log.d("BeaconScanner", "Beacon gefunden: $deviceAddress mit Stärke: $rssi dBm")
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e("BeaconScanner", "Scan fehlgeschlagen! Fehlercode: $errorCode")
        }
    }

    @SuppressLint("MissingPermission")
    fun startScanning() {
        if (bleScanner == null) {
            Log.e("BeaconScanner", "Bluetooth LE Scanner nicht verfügbar (Bluetooth aus?)")
            return
        }
        latestScanResults.clear()
        bleScanner.startScan(scanCallback)
        Log.d("BeaconScanner", "BLE Scan gestartet...")
    }

    @SuppressLint("MissingPermission")
    fun stopScanning() {
        bleScanner?.stopScan(scanCallback)
        Log.d("BeaconScanner", "BLE Scan gestoppt.")
    }
}