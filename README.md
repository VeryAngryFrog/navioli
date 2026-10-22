# Navioli

Navioli is a shopping aid for blind and partially sighted people. It guides them
through a supermarket with spoken, step-by-step directions to the items they are
looking for.

This repository is the **staff tool** – a small web app to manage the store:
which shelves exist, where they are and what is on them. From that, it
automatically produces the spoken directions that the navigation device reads
out to the customer.

## Start it

You only need Python 3 – no extra packages.

```bash
cd navioli
python server.py
```

Then open <http://localhost:8000> in your browser.

## Using it

The page shows a **floor plan** of the store: the entrance and the checkout sit
at the front, the aisles above them.

- **Add** a shelf or an item with the buttons at the top.
- **Drag** shelves to another spot, or items to another level (top / middle / bottom).
- Each shelf has a **“Directions”** section that shows the route to it.
- Everything you change is **saved automatically**.

All data lives in `supermarket_db.json` – the shared file that the navigation
device reads.

## How the directions are calculated

Every shelf knows its **aisle**, its **side** (left or right) and its **row**
(how far into the aisle). Starting from the **entrance** – or from any aisle the
customer is already standing in – the app builds the walk step by step:

1. walk along the front to the correct aisle,
2. turn into it and go to the right row,
3. say which side the shelf is on and which level the item sits on.

It does the same for the way **to the checkout** and **from the checkout to the
exit**. If an automatic route isn’t ideal, you can edit it by hand for a given
start point, and your version is used instead.

> The distances (in meters) are placeholders and are set to the real values when
> the system is installed.


### How to Test the App Locally (Step-by-Step)

Since this app relies on real hardware sensors (Camera, Microphone, and Haptic Feedback), it is best tested on a physical Android device rather than an emulator.

#### 1. Prepare your Android Smartphone
* **Enable Developer Options:** On your phone, go to *Settings > About Phone* and tap *Build Number* 7 times until it says "You are now a developer".
* **Enable USB Debugging:** Go to *Settings > System > Developer Options* and turn on **USB Debugging**.
* **Connect to PC:** Plug your phone into your computer using a USB cable. If prompted on the phone, select "Allow USB Debugging from this computer".

#### 2. Run the Code in Android Studio
* Open the project in Android Studio.
* Look at the top toolbar and ensure your **physical device name** is selected in the device dropdown list (instead of an emulator).
* Click the green **Run button (Play icon)** or press `Shift + F10`.
* The app will compile and install automatically on your phone.

#### 3. Perform the Voice Navigation Test
1. Disconnect any active Bluetooth headphones so you can hear the phone's built-in speaker.
2. Tap the large gray button **"Tap here & Speak"**.
3. When the phone asks for your location, wait for the chime sound and say clearly: **"entrance"**.
4. The phone will confirm and ask for a product. Wait for the second chime and say: **"pasta"** (or "milk" / "bread").
5. The app will fetch the mock route from `supermarket_db.json` and read the step-by-step navigation instructions aloud.

#### 4. Test the AI Obstacle Radar
* Hold your phone up so the camera view is active.
* Place an object (like a water bottle, a chair, or your hand) close to the camera lens.
* Move the object closer the phone will start to **vibrate in short bursts**, simulating an obstacle warning for a blind user.
