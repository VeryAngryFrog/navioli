package com.example.navioli_beacon_1

import android.content.Context
import org.json.JSONObject
import java.io.IOException

// Liest die JSON-Datei aus dem assets-Ordner als Text ein
fun loadJSONFromAsset(context: Context, fileName: String): String? {
    return try {
        context.assets.open(fileName).bufferedReader().use { it.readText() }
    } catch (ex: IOException) {
        ex.printStackTrace()
        null
    }
}

// Sucht dynamisch in der JSON-Datei nach der passenden Route
fun getRouteFromJSON(context: Context, currentBeaconId: String, productId: String): List<String> {
    val jsonString = loadJSONFromAsset(context, "supermarket_db.json")
        ?: return listOf("Fehler: supermarket_db.json konnte nicht geladen werden.")

    try {
        val root = JSONObject(jsonString)

        // 1. Hole das Produkt, um die shelf_id herauszufinden
        val products = root.getJSONObject("products")
        if (!products.has(productId)) {
            return listOf("Produkt '$productId' nicht in der Datenbank gefunden.")
        }
        val productObj = products.getJSONObject(productId)
        val shelfId = productObj.getString("shelf_id")

        // 2. Gehe zu den Shelves und suche das richtige Regal
        val shelves = root.getJSONObject("shelves")
        if (!shelves.has(shelfId)) {
            return listOf("Regal '$shelfId' existiert nicht in der Datenbank.")
        }
        val shelfObj = shelves.getJSONObject(shelfId)

        // 3. Hole die Routen für dieses Regal
        val routes = shelfObj.getJSONObject("routes")
        if (!routes.has(currentBeaconId)) {
            return listOf("Keine Route von '$currentBeaconId' zu Regal '$shelfId' hinterlegt.")
        }

        // 4. Konvertiere das JSON-Array in eine Kotlin-Liste
        val jsonRouteArray = routes.getJSONArray(currentBeaconId)
        val routeList = mutableListOf<String>()
        for (i in 0 until jsonRouteArray.length()) {
            routeList.add(jsonRouteArray.getString(i))
        }

        return routeList

    } catch (e: Exception) {
        e.printStackTrace()
        return listOf("Fehler beim Lesen der JSON-Daten: ${e.localizedMessage}")
    }
}