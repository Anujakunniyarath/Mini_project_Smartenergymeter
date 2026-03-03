// =================================================
// COMPLETE AUTO-DISCOVERY CODE
// =================================================
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json"))
});

const db = admin.firestore();

console.log("Firebase initialized\n");

// Common ESP device IDs to try
const possibleDeviceIds = [
  "esp_001", "esp_002", "esp_003", "esp_004", "esp_005"
];

const possiblePins = [
  "GPIO_18", "GPIO_5", "GPIO_19", "GPIO_21", "GPIO_22", 
  "GPIO_23", "GPIO_25", "GPIO_26", "GPIO_27", "GPIO_32"
];

const discoverDevices = async () => {
  console.log("🔍 Discovering devices...\n");
  const devices = [];
  
  for (const deviceId of possibleDeviceIds) {
    for (const pinId of possiblePins) {
      const snapshot = await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_15min")
        .doc(pinId)
        .collection("data")
        .get();
      
      if (!snapshot.empty) {
        console.log(`   ✅ Found device: ${deviceId}`);
        devices.push(deviceId);
        break;
      }
    }
  }
  
  return devices;
};

const discoverPins = async (deviceId) => {
  const pins = [];
  
  for (const pinId of possiblePins) {
    const snapshot = await db
      .collection("energy_data")
      .doc(deviceId)
      .collection("aggregates_15min")
      .doc(pinId)
      .collection("data")
      .get();
    
    if (!snapshot.empty) {
      pins.push(pinId);
    }
  }
  
  return pins;
};

const runDailyAggregation = async () => {
  console.log("\n🔄 Running Daily Aggregation (Auto-Discovery)...\n");
  console.log("=".repeat(50));

  const devices = await discoverDevices();
  
  console.log(`📱 Devices found: ${devices.join(", ")}\n`);
  
  if (devices.length === 0) {
    console.log("❌ No devices found!");
    process.exit(0);
  }

  let totalProcessed = 0;

  for (const deviceId of devices) {
    console.log(`📱 Device: ${deviceId}`);
    
    const pins = await discoverPins(deviceId);
    console.log(`   📋 Pins: ${pins.join(", ")}`);

    for (const pinId of pins) {
      console.log(`\n📊 Pin: ${pinId}`);
      
      const dataSnapshot = await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_15min")
        .doc(pinId)
        .collection("data")
        .get();
      
      console.log(`   📥 Records: ${dataSnapshot.size}`);
      
      if (dataSnapshot.empty) continue;

      let totalPower = 0, totalVoltage = 0, totalCurrent = 0;
      let totalEnergy = 0, totalSamples = 0;

      dataSnapshot.forEach(doc => {
        const d = doc.data();
        totalPower += d.avg_power || 0;
        totalVoltage += d.avg_voltage || 0;
        totalCurrent += d.avg_current || 0;
        totalEnergy += d.total_energy || 0;
        totalSamples += d.sample_count || 0;
      });

      const avgPower = totalPower / dataSnapshot.size;
      
      console.log(`   ⚡ Avg Power: ${avgPower.toFixed(2)}W`);
      console.log(`   🔋 Total Energy: ${totalEnergy.toFixed(4)} kWh`);

      await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_daily")
        .doc(pinId)
        .collection("data")
        .add({
          date: new Date(),
          daily_avg_power: avgPower,
          daily_avg_voltage: totalVoltage / dataSnapshot.size,
          daily_avg_current: totalCurrent / dataSnapshot.size,
          daily_total_energy: totalEnergy,
          total_samples: totalSamples,
          window_count: dataSnapshot.size,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`   ✅ Stored!`);
      totalProcessed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Done! Processed: ${totalProcessed} pins`);
  console.log("=".repeat(50));
  
  process.exit(0);
};

runDailyAggregation();