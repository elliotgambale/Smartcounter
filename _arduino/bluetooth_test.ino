// paste into adrino IDE and build sketch
#include <Wire.h>
#include <NimBLEDevice.h>

// ─── BLE UUIDs (must match app) ───────────────────────────────────────────────
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ─── IMU ──────────────────────────────────────────────────────────────────────
#define MPU_ADDR 0x68
#define SAMPLE_RATE_MS 10        // 100Hz sampling

// ─── Rep detection tuning ─────────────────────────────────────────────────────
#define REP_THRESHOLD     2500   // how far above/below baseline to count as movement
#define MIN_REP_MS        300    // minimum rep duration (filters noise/bounces)
#define REST_TIMEOUT_MS   15000  // 15 seconds no movement = new set
#define REP_DIRECTION     1      // 1 counts positive/up motion, -1 counts negative/up motion

// ─── BLE ──────────────────────────────────────────────────────────────────────
NimBLECharacteristic* pCharacteristic = nullptr;
bool deviceConnected = false;

// ─── Rep state ────────────────────────────────────────────────────────────────
int32_t baseline = 0;
bool calibrated = false;
bool inRep = false;
bool peakDetected = false;
int32_t repPeakDeviation = 0;

uint32_t currentSet = 1;
uint32_t currentRep = 0;
uint32_t repStartTime = 0;
uint32_t lastRepTime = 0;

// Rolling average for baseline
#define BASELINE_SAMPLES 50
int32_t baselineBuffer[BASELINE_SAMPLES];
int baselineIndex = 0;
bool baselineFull = false;

struct RepPayload {
  uint32_t setNumber;
  uint32_t repNumber;
  uint32_t durationMs;
};

// ─── BLE Callbacks ────────────────────────────────────────────────────────────
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    deviceConnected = true;
    Serial.println("Phone connected!");
  }

  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    deviceConnected = false;
    Serial.print("Phone disconnected. Reason: ");
    Serial.println(reason);
    NimBLEDevice::startAdvertising();
  }
};

class RepCharacteristicCallbacks : public NimBLECharacteristicCallbacks {
  void onSubscribe(NimBLECharacteristic* pCharacteristic, NimBLEConnInfo& connInfo, uint16_t subValue) override {
    Serial.print("Phone subscription changed — subValue: ");
    Serial.println(subValue);
  }
};


// ─── Read Z axis from MPU-6050 ────────────────────────────────────────────────
int16_t readZ() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);

  int16_t ax = Wire.read() << 8 | Wire.read();
  int16_t ay = Wire.read() << 8 | Wire.read();
  int16_t az = Wire.read() << 8 | Wire.read();

  // Return magnitude so direction doesn't matter
  // This works regardless of how the sensor is mounted
  return az;
}

// ─── Update rolling baseline ──────────────────────────────────────────────────
void updateBaseline(int32_t z) {
  baselineBuffer[baselineIndex] = z;
  baselineIndex = (baselineIndex + 1) % BASELINE_SAMPLES;
  if (baselineIndex == 0) baselineFull = true;

  int count = baselineFull ? BASELINE_SAMPLES : baselineIndex;
  int32_t sum = 0;
  for (int i = 0; i < count; i++) sum += baselineBuffer[i];
  baseline = sum / count;
}

// ─── Send rep over BLE ────────────────────────────────────────────────────────
void sendRep(uint32_t set, uint32_t rep, uint32_t durationMs) {
  RepPayload payload;
  payload.setNumber  = set;
  payload.repNumber  = rep;
  payload.durationMs = durationMs;

  pCharacteristic->setValue((uint8_t*)&payload, sizeof(payload));
  pCharacteristic->notify();

  Serial.print("Set: "); Serial.print(set);
  Serial.print("  Rep: "); Serial.print(rep);
  Serial.print("  Duration: "); Serial.print(durationMs); Serial.println("ms");
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);
  delay(1000);

  // Init IMU
  Wire.begin(21, 22);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0); // wake up
  Wire.endTransmission();

  // Set accelerometer range to ±4g for better gym motion sensitivity
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C);
  Wire.write(0x08);
  Wire.endTransmission();

  Serial.println("Calibrating baseline — keep sensor still for 2 seconds...");

  // Collect initial baseline samples
  for (int i = 0; i < BASELINE_SAMPLES; i++) {
    updateBaseline(readZ());
    delay(SAMPLE_RATE_MS);
  }
  calibrated = true;
  Serial.print("Baseline set: "); Serial.println(baseline);

  // Init BLE
  NimBLEDevice::init("SmartCounter");
  NimBLEServer* pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  NimBLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );

  pCharacteristic->setCallbacks(new RepCharacteristicCallbacks());

  pService->start();

  NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();

  Serial.println("Advertising as SmartCounter — ready!");
}

// ─── Main loop ────────────────────────────────────────────────────────────────
void loop() {
  uint32_t now = millis();
  int32_t z = readZ();

  // Update rolling baseline only when not in a rep
  // This lets baseline drift slowly with sensor orientation changes
  if (!inRep) {
    updateBaseline(z);
  }

  int32_t deviation = z - baseline;
  int32_t directionalDeviation = deviation * REP_DIRECTION;

  // ── Rep start — only count movement in the configured "up" direction ──
  if (!inRep && directionalDeviation > REP_THRESHOLD) {
    inRep = true;
    peakDetected = true;
    repStartTime = now;
    repPeakDeviation = deviation;
    Serial.print("Rep started — deviation: "); Serial.println(deviation);
  }

  if (inRep && directionalDeviation > repPeakDeviation * REP_DIRECTION) {
    repPeakDeviation = deviation;
  }

  // ── Rep complete — returned toward baseline after the up phase ──
  if (inRep && abs(deviation) < REP_THRESHOLD / 2) {
    uint32_t duration = now - repStartTime;

    if (duration >= MIN_REP_MS) {
      // Valid rep
      currentRep++;
      lastRepTime = now;

      if (deviceConnected) {
        sendRep(currentSet, currentRep, duration);
      } else {
        // Still log to serial even without phone connected
        Serial.print("Rep detected (no phone) — Set: ");
        Serial.print(currentSet);
        Serial.print("  Rep: "); Serial.print(currentRep);
        Serial.print("  Duration: "); Serial.print(duration);
        Serial.print("ms  Peak: "); Serial.println(repPeakDeviation);
      }
    } else {
      Serial.print("Ignored — too short: "); Serial.print(duration); Serial.println("ms");
    }

    inRep = false;
    peakDetected = false;
    repPeakDeviation = 0;
  }

  // ── Rest detection — new set ──
  if (currentRep > 0 && !inRep) {
    if (now - lastRepTime > REST_TIMEOUT_MS) {
      Serial.println("--- Rest detected, new set ---");
      currentSet++;
      currentRep = 0;
      lastRepTime = now; // reset so it doesn't keep triggering
    }
  }

  delay(SAMPLE_RATE_MS);
}
