package com.example.navioli_beacon_1

import android.widget.Toast
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Farb-Definitionen der App
val BarGreen = Color(0xFF5A9E54)
val DarkGreenBorder = Color(0xFF3D6B38)
val SettingsGreen = Color(0xFF4D8847)
val DoughYellow = Color(0xFFE2B143)
val DoughBorder = Color(0xFFC49123)
val FillingLight = Color(0xFFF0CE65)
val FillingDark = Color(0xFFD39F30)

// Die mathematische Zacken-Form für die Ravioli
val WavyPastaShape = GenericShape { size, _ ->
    if (size.width <= 0f || size.height <= 0f) return@GenericShape
    val waves = 10
    val depth = 40f
    val stepX = size.width / waves
    val stepY = size.height / waves

    moveTo(0f, 0f)
    for (i in 0 until waves) {
        val midX = (i * stepX) + (stepX / 2)
        val endX = (i + 1) * stepX
        quadraticBezierTo(midX, depth, endX, 0f)
    }
    for (i in 0 until waves) {
        val midY = (i * stepY) + (stepY / 2)
        val endY = (i + 1) * stepY
        quadraticBezierTo(size.width - depth, midY, size.width, endY)
    }
    for (i in waves downTo 1) {
        val midX = ((i - 1) * stepX) + (stepX / 2)
        val endX = (i - 1) * stepX
        quadraticBezierTo(midX, size.height - depth, endX, size.height)
    }
    for (i in waves downTo 1) {
        val midY = ((i - 1) * stepY) + (stepY / 2)
        val endY = (i - 1) * stepY
        quadraticBezierTo(depth, midY, 0f, endY)
    }
    close()
}

@Composable
fun NavioliAppScreen(
    buttonText: String,
    currentBeacon: String,
    currentProduct: String,
    onRavioliClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        // --- TOP BAR ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp)
                .background(BarGreen)
                .border(2.dp, DarkGreenBorder)
                .padding(horizontal = 15.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = "MVP v0.3", color = Color.White, fontSize = 16.sp, fontFamily = FontFamily.Monospace)
            Text(
                text = "Navioli",
                color = Color.White,
                fontSize = 32.sp,
                fontFamily = FontFamily.Cursive,
                fontWeight = FontWeight.Bold
            )
            Box(
                modifier = Modifier
                    .width(25.dp)
                    .height(14.dp)
                    .border(2.dp, Color.White, RoundedCornerShape(3.dp))
                    .padding(2.dp)
            ) {
                Box(modifier = Modifier.fillMaxHeight().fillMaxWidth(0.7f).background(Color.White))
            }
        }

        // --- MAIN CONTENT (Die interaktive Ravioli) ---
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(Color.White),
            contentAlignment = Alignment.Center
        ) {
            var isPressed by remember { mutableStateOf(false) }
            val scale by animateFloatAsState(if (isPressed) 0.94f else 1f, label = "scale")

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "Status: Beacon [$currentBeacon] | Item [$currentProduct]",
                    color = Color.Gray,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 24.dp)
                )

                // Die stylische Teig-Tasche fungiert jetzt als euer Action-Button!
                Box(
                    modifier = Modifier
                        .size(280.dp)
                        .scale(scale)
                        .clip(WavyPastaShape)
                        .background(DoughYellow)
                        .border(3.dp, DoughBorder, WavyPastaShape)
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onPress = {
                                    isPressed = true
                                    tryAwaitRelease()
                                    isPressed = false
                                    onRavioliClick()
                                }
                            )
                        },
                    contentAlignment = Alignment.Center
                ) {
                    // Die Füllungswölbung
                    Box(
                        modifier = Modifier
                            .size(160.dp)
                            .background(
                                brush = Brush.radialGradient(colors = listOf(FillingLight, FillingDark)),
                                shape = CircleShape
                            )
                            .border(2.dp, Color(0x66A07314), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        // Der Zustandstext direkt im Kern der Ravioli platziert
                        Text(
                            text = buttonText,
                            color = Color(0xFF5C4308),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }
        }

        // --- BOTTOM BAR ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(55.dp)
                .background(BarGreen)
                .border(2.dp, DarkGreenBorder),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier
                    .fillMaxHeight()
                    .background(SettingsGreen)
                    .border(width = 2.dp, color = DarkGreenBorder)
                    .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(modifier = Modifier.size(16.dp).background(Color.White, CircleShape))
                Text(text = "Settings", color = Color.White, fontSize = 18.sp)
            }
        }
    }
}