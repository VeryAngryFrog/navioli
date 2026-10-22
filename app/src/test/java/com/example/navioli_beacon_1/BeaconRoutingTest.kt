package com.example.navioli_beacon_1

import org.junit.Test
import org.junit.Assert.*

class BeaconRoutingTest {

    @Test
    fun testHardcodedDatabaseRoutes() {
        // Szenario 1: Nutzer steht am Eingang (beacon_entrance) und sucht "pasta"
        val routeToPasta = getHardcodedRoute("beacon_entrance", "pasta")

        println("=== TEST ROUTE: ENTRANCE -> PASTA ===")
        routeToPasta.forEach { println("- $it") }

        assertTrue(routeToPasta.isNotEmpty())
        assertEquals("Turn right and walk about 2 meters straight ahead.", routeToPasta.first())

        // Szenario 2: Nutzer steht am Eingang (beacon_entrance) und sucht "bread"
        val routeToBread = getHardcodedRoute("beacon_entrance", "bread")

        println("\n=== TEST ROUTE: ENTRANCE -> BREAD ===")
        routeToBread.forEach { println("- $it") }

        assertEquals("Go straight into Aisle 1.", routeToBread.first())
    }
}