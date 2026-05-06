# SmartCounter

A wearable rep-counting system for gym workouts. An ESP32 microcontroller worn on the body detects exercise repetitions using an MPU-6050 accelerometer and streams them in real time over Bluetooth Low Energy (BLE) to a React Native mobile app.

---

## What It Does

The user wears an ESP32 on their body while exercising. The device detects reps automatically (no button presses), tracks set breaks, and sends each rep to the paired phone over BLE. The app displays live rep and set counts, records workout sessions, shows a fatigue chart (rep duration over time within a set), and saves session history locally on the device.

---

## System Architecture

```
[ESP32 + MPU-6050]  --BLE notify-->  [React Native App (iOS)]
   _arduino/                              app/
   bluetooth_test.ino                     index.tsx     (home / BLE pairing)
                                          workout.tsx   (live workout screen)
                                          history.tsx   (past sessions)
```

### Hardware

- **Microcontroller:** ESP32 (advertises as `SmartCounter` over BLE)
- **Sensor:** MPU-6050 IMU, reading the Z-axis accelerometer at 100 Hz
- **Firmware:** [`_arduino/bluetooth_test.ino`](_arduino/bluetooth_test.ino) — written for Arduino IDE using `NimBLE`

**Rep detection logic (firmware):**
- Maintains a rolling 50-sample baseline of the Z-axis to account for sensor drift and orientation changes
- A rep starts when the directional deviation from baseline exceeds `REP_THRESHOLD` (2500 raw units)
- A rep is confirmed when the signal returns to within half the threshold AND the duration was ≥ `MIN_REP_MS` (300 ms) — this filters noise and bounces
- After `REST_TIMEOUT_MS` (15 s) of no reps, the set counter increments automatically
- Each confirmed rep is sent via BLE notify as a 12-byte struct: `{ setNumber, repNumber, durationMs }` (all `uint32_t`)

**BLE UUIDs (must match between firmware and app):**
- Service: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- Characteristic: `beb5483e-36e1-4688-b7f5-ea07361b26a8`

---

### Mobile App

**Stack:** React Native + Expo (SDK 54), Expo Router (file-based navigation), TypeScript

**Key files:**

| Path | Purpose |
|---|---|
| [`context/BLEContext.tsx`](context/BLEContext.tsx) | Global BLE state provider — survives navigation; wraps `react-native-ble-plx` |
| [`hooks/useWorkoutSession.ts`](hooks/useWorkoutSession.ts) | Manages the in-progress workout session state (sets, reps, timing) |
| [`lib/storage.ts`](lib/storage.ts) | AsyncStorage persistence for completed `WorkoutSession` objects |
| [`lib/types.ts`](lib/types.ts) | Shared TypeScript types (`RepData`, `WorkoutSet`, `WorkoutSession`, `BLEStatus`) |
| [`lib/bleConstants.ts`](lib/bleConstants.ts) | BLE UUIDs and device name constants |
| [`components/RepCounter.tsx`](components/RepCounter.tsx) | Displays current rep count and last rep duration |
| [`components/SetTracker.tsx`](components/SetTracker.tsx) | Displays current set number |
| [`components/FatigueChart.tsx`](components/FatigueChart.tsx) | Bar chart (via `victory-native`) of rep durations within the current set — visually shows fatigue as reps slow down |
| [`components/DeviceCard.tsx`](components/DeviceCard.tsx) | BLE device list item with connect button |

**App screens:**

1. **Home (`app/index.tsx`)** — Scans for nearby BLE devices, lists discovered devices, lets the user tap to connect; navigates to Workout screen on connect.
2. **Workout (`app/workout.tsx`)** — User selects a workout type (Pushups, Pullups, Squats, Situps, Curls, Shoulder Press), then the screen shows live rep/set counts fed by BLE notifications. Has a fatigue chart and a BLE debug log panel. "Finish and save" saves the session to local storage.
3. **History (`app/history.tsx`)** — Lists all saved `WorkoutSession` records (workout name, date, sets, reps). Can clear all history.

**Data flow:**
```
ESP32 BLE notify  -->  BLEContext.lastRep  -->  workout.tsx useEffect  -->  useWorkoutSession.addRep()
                                                                                  |
                                                                         session saved via saveSession()
                                                                         on "Finish and save"
```

---

## Data Types

```typescript
RepData        { set, rep, durationMs, timestamp }
WorkoutSet     { setNumber, reps: RepData[], startTime, endTime? }
WorkoutSession { id, date, workoutName, sets, totalReps }
```

---

## Design

- Dark theme throughout (`#0a0a0a` background, `#e8f542` yellow accent)
- iOS-only (BLE dependency requires native build; not compatible with Expo Go — uses `expo-dev-client`)
- Sessions persisted locally with AsyncStorage; no backend or cloud sync

---

## Build & Run

```bash
npm install
npm run start:dev-client   # requires dev client build on device

# Build dev client (first time or after native deps change):
npm run build:ios:dev      # EAS cloud build
npm run build:ios:sim      # simulator build
```

Firmware: open `_arduino/bluetooth_test.ino` in Arduino IDE, select the ESP32 board, and upload.
