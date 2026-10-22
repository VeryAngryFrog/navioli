#!/usr/bin/env kotlin

package com.example.supermarketbeaconnav // ACHTUNG: Hier muss DEIN Paketname stehen!

import kotlin.math.abs
import kotlin.math.sqrt

// 1. Datenstrukturen
data class SupermarketBeacon(
    val id: String,
    val name: String,
    val x: Double,
    val y: Double
)

data class NavigationRoute(
    val distanceInMeters: Double,
    val directions: List<String>
)

// Mock-Karte der Beacons im Supermarkt
val beaconMap = mapOf(
    "beacon_001" to SupermarketBeacon("beacon_001", "Regal A (Nudeln)", 1.0, 2.0),
    "beacon_002" to SupermarketBeacon("beacon_002", "Regal B (Saucen)", 1.0, 5.0),
    "beacon_003" to SupermarketBeacon("beacon_003", "Regal C (Kasse)", 5.0, 1.0)
)

// 2. Logik: Nächsten Beacon finden
fun getCurrentLocation(scannedBeacons: Map<String, Int>): SupermarketBeacon? {
    if (scannedBeacons.isEmpty()) return null
    val nearestBeaconId = scannedBeacons.maxByOrNull { it.value }?.key
    return beaconMap[nearestBeaconId]
}

// 3. Logik: Route berechnen
fun calculateRoute(current: SupermarketBeacon, targetX: Double, targetY: Double): NavigationRoute {
    val deltaX = targetX - current.x
    val deltaY = targetY - current.y

    val distance = sqrt(deltaX * deltaX + deltaY * deltaY)
    val directions = mutableListOf<String>()

    if (deltaX > 0) directions.add("Gehe ${abs(deltaX)} Meter nach rechts.")
    else if (deltaX < 0) directions.add("Gehe ${abs(deltaX)} Meter nach links.")

    if (deltaY > 0) directions.add("Gehe ${abs(deltaY)} Meter geradeaus.")
    else if (deltaY < 0) directions.add("Gehe ${abs(deltaY)} Meter zurück.")

    return NavigationRoute(distance, directions)
}

// 4. Test-Main-Funktion direkt im Studio ausführen
fun main() {
    val mockScanResults = mapOf("beacon_001" to -70, "beacon_002" to -45, "beacon_003" to -85)
    val userLocation = getCurrentLocation(mockScanResults)

    if (userLocation != null) {
        println("Nutzer steht bei: ${userLocation.name} (${userLocation.x}, ${userLocation.y})")
        val route = calculateRoute(userLocation, 5.0, 1.0)
        println("Entfernung: ${String.format("%.2f", route.distanceInMeters)} Meter")
        println("Anweisungen: ${route.directions}")
    } else {
        println("Kein Beacon-Signal empfangen.")
    }
}