const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// CO2 Emission Factors (kg CO2 per km/litre per fuel)
const vehicleEmissionFactors = {
petrol: {
bike: 0.065,
car: 0.192,
auto: 0.113,
},
diesel: {
car: 0.171,
auto: 0.102,
},
electric: {
car: 0.045,
bike: 0.015,
},
};

// Electricity and gas emissions (kg CO2 per ₹)
const electricityFactor = 0.82 / 8; // ₹8/kWh → 0.1025 kg CO2/₹
const gasFactor = 2.983 / 70; // ₹70 per kg → 0.0426 kg CO2/₹

const SAFE_CO2_THRESHOLD = 180; // kg/month (example safe level)
const POINTS_PER_KG_SAVED = 0.5;

app.get("/", (_req, res) => {
res.send("Carbon API is running!");
});

// POST /calculate
app.post("/calculate", (req, res) => {
try {
const { vehicles = [], electricityBill = 0, gasBill = 0 } = req.body;

let totalCommuteCO2 = 0;

// Calculate emissions from each vehicle
vehicles.forEach((v) => {
  const { distance = 0, fuelType = "petrol", vehicleType = "car" } = v;

  const factor =
    (vehicleEmissionFactors[fuelType] &&
      vehicleEmissionFactors[fuelType][vehicleType]) ||
    0.15; // default fallback

  const monthlyCO2 = distance * 30 * factor; // assume 30 days of commute
  totalCommuteCO2 += monthlyCO2;
});

const electricityCO2 = electricityBill * electricityFactor;
const gasCO2 = gasBill * gasFactor;

const totalCO2 = +(totalCommuteCO2 + electricityCO2 + gasCO2).toFixed(1);
const co2Status =
  totalCO2 > SAFE_CO2_THRESHOLD
    ? "⚠️ Warning: Emissions above safe monthly level!"
    : "✅ Emissions within safe level";

const potentialSavings = +(Math.max(0, totalCO2 - SAFE_CO2_THRESHOLD).toFixed(1));
const pointsEarned = Math.floor(potentialSavings * POINTS_PER_KG_SAVED);

res.json({
  commuteCO2: +totalCommuteCO2.toFixed(1),
  electricityCO2: +electricityCO2.toFixed(1),
  gasCO2: +gasCO2.toFixed(1),
  totalCO2,
  co2Status,
  pointsEarned,
  tips: generateTips(totalCO2),
});


} catch (error) {
res.status(500).json({ error: "Calculation error", details: error.message });
}
});

// Leaderboard - (Mocked for now)
app.get("/leaderboard", (_req, res) => {
res.json([
{ name: "Ananya", locality: "Bangalore", score: 120 },
{ name: "Ravi", locality: "Bangalore", score: 110 },
{ name: "Meera", locality: "Bangalore", score: 100 },
]);
});

// Redeem points - (Mocked)
app.post("/redeem", (req, res) => {
const { points } = req.body;
if (points >= 100) {
res.json({ success: true, message: "🎁 Reward redeemed!" });
} else {
res.json({ success: false, message: "❌ Not enough points to redeem." });
}
});

// Tips Generator
function generateTips(co2) {
const tips = [];

if (co2 > 200) tips.push("Use public transport at least 3x a week.");
if (co2 > 150) tips.push("Switch to energy-efficient appliances.");
if (co2 > 120) tips.push("Consider carpooling with colleagues.");
if (co2 > 100) tips.push("Switch to LED lighting and unplug idle devices.");
if (co2 > 80) tips.push("Keep AC usage minimal and use fans more.");
if (co2 > 60) tips.push("Cycle short distances instead of driving.");
if (co2 > 50) tips.push("Schedule a home energy audit.");

if (tips.length === 0) tips.push("You're doing great! 🌱");

return tips;
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend running at http://localhost:${PORT}`));