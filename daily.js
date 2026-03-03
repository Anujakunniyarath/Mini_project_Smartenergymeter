// =================================================
// IMPORTS
// =================================================
const admin = require("firebase-admin");

// =================================================
// FIREBASE SETUP
// =================================================
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json"))
});

const db = admin.firestore();

console.log("Firebase initialized");

// =================================================
// DAILY AGGREGATION
// =================================================
const runDailyAggregation = async () => {
  console.log("\n🔄 Running Daily Aggregation...\n");

  // Your actual structure (known from manual check)
  const devices = ["esp_001", "esp_002"];
  const pins = ["GPIO_18", "GPIO_5", "GPIO_4"]; // Add all your pins

  let totalProcessed = 0;

  for (const deviceId of devices) {
    console.log(`📱 Device: ${deviceId}`);
    
    for (const pinId of pins) {
      console.log(`\n📊 Pin: ${pinId}`);
      
      // Access subcollection directly - works even if parent is empty!
      const dataSnapshot = await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_15min")
        .doc(pinId)
        .collection("data")
        .get();
      
      console.log(`   📥 Records found: ${dataSnapshot.size}`);
      
      if (dataSnapshot.empty) {
        console.log(`   ⚠️ No data - skipping`);
        continue;
      }

      // Calculate totals
      let totalPower = 0;
      let totalVoltage = 0;
      let totalCurrent = 0;
      let totalEnergy = 0;
      let totalSamples = 0;

      dataSnapshot.forEach(doc => {
        const d = doc.data();
        totalPower += d.avg_power || 0;
        totalVoltage += d.avg_voltage || 0;
        totalCurrent += d.avg_current || 0;
        totalEnergy += d.total_energy || 0;
        totalSamples += d.sample_count || 0;
      });

      const avgPower = totalPower / dataSnapshot.size;
      const avgVoltage = totalVoltage / dataSnapshot.size;
      const avgCurrent = totalCurrent / dataSnapshot.size;

      console.log(`   ⚡ Avg Power: ${avgPower.toFixed(2)}W`);
      console.log(`   🔌 Avg Voltage: ${avgVoltage.toFixed(2)}V`);
      console.log(`   📈 Avg Current: ${avgCurrent.toFixed(3)}A`);
      console.log(`   🔋 Total Energy: ${totalEnergy.toFixed(4)} kWh`);

      // Store daily aggregate
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_daily")
        .doc(pinId)
        .collection("data")
        .add({
          date: today,
          daily_avg_power: avgPower,
          daily_avg_voltage: avgVoltage,
          daily_avg_current: avgCurrent,
          daily_total_energy: totalEnergy,
          total_samples: totalSamples,
          window_count: dataSnapshot.size,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`   ✅ Stored to aggregates_daily!`);
      totalProcessed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Complete! Processed: ${totalProcessed} pins`);
  console.log("=".repeat(50));
  
  process.exit(0);
};

// =================================================
// RUN
// =================================================
runDailyAggregation();