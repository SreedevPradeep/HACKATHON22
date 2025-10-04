const express = require("express");
const cors = require("cors");

const app = express();

// Configure CORS
app.use(
  cors({
    origin: [
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://localhost:3000",
    ], // Add your frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Parse JSON requests
app.use(express.json());

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

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
    const {
      vehicles = [],
      bill: electricityBill = 0,
      lpg: lpgCylinders = 0,
    } = req.body;

    let totalCommuteCO2 = 0;
    let totalFuelCO2 = 0;

    // Calculate emissions from each vehicle
    vehicles.forEach((v) => {
      const {
        type: vehicleType = "car",
        fuelType = "petrol",
        distancePerDay = 0,
        fuelAmountPerMonth = 0,
      } = v;

      const factor =
        (vehicleEmissionFactors[fuelType] &&
          vehicleEmissionFactors[fuelType][vehicleType]) ||
        0.15; // default fallback

      if (distancePerDay > 0) {
        const monthlyCO2 = distancePerDay * 30 * factor; // assume 30 days of commute
        totalCommuteCO2 += monthlyCO2;
      } else if (fuelAmountPerMonth > 0) {
        const monthlyCO2 =
          fuelAmountPerMonth * factor * (fuelType === "electric" ? 0.82 : 2.31); // kWh or L to CO2
        totalFuelCO2 += monthlyCO2;
      }
    });

    const electricityCO2 = electricityBill * electricityFactor;
    const lpgCO2 = lpgCylinders * 46.1; // Each cylinder ~ 46.1 kg CO2

    const totalCO2 = +(
      totalCommuteCO2 +
      electricityCO2 +
      lpgCO2 +
      totalFuelCO2
    ).toFixed(1);
    const co2Status =
      totalCO2 > SAFE_CO2_THRESHOLD
        ? "⚠️ Warning: Emissions above safe monthly level!"
        : "✅ Emissions within safe level";

    const potentialSavings = +Math.max(
      0,
      totalCO2 - SAFE_CO2_THRESHOLD
    ).toFixed(1);
    const pointsEarned = Math.floor(potentialSavings * POINTS_PER_KG_SAVED);

    // Calculate monthly spending
    const moneyElectricity = electricityBill;
    const moneyLpg = lpgCylinders * 1100; // Approx ₹1100 per cylinder
    const moneyPetrol = vehicles.reduce(
      (acc, v) =>
        v.fuelType === "petrol" && v.fuelAmountPerMonth
          ? acc + v.fuelAmountPerMonth * 100
          : acc,
      0
    );
    const moneyDiesel = vehicles.reduce(
      (acc, v) =>
        v.fuelType === "diesel" && v.fuelAmountPerMonth
          ? acc + v.fuelAmountPerMonth * 90
          : acc,
      0
    );

    res.json({
      commuteCO2: +totalCommuteCO2.toFixed(1),
      electricityCO2: +electricityCO2.toFixed(1),
      lpgCO2: +lpgCO2.toFixed(1),
      fuelCO2: +totalFuelCO2.toFixed(1),
      totalCO2,
      co2Status,
      pointsEarned,
      tips: generateTips(totalCO2),
      money: {
        electricity: moneyElectricity,
        lpg: moneyLpg,
        petrol: moneyPetrol,
        diesel: moneyDiesel,
        total: moneyElectricity + moneyLpg + moneyPetrol + moneyDiesel,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Calculation error", details: error.message });
  }
});

// Store leaderboard data in memory (in a real app, use a database)
const leaderboardData = new Map();

// Get leaderboard data
app.get("/leaderboard/:locality", (req, res) => {
  const locality = req.params.locality || "Global";
  const scores = leaderboardData.get(locality) || [];
  res.json(scores.sort((a, b) => b.score - a.score).slice(0, 10));
});

// Submit score to leaderboard
app.post("/leaderboard", (req, res) => {
  const { name, locality, score } = req.body;
  if (!name || !locality || typeof score !== "number") {
    return res.status(400).json({ error: "Invalid data" });
  }

  const localityScores = leaderboardData.get(locality) || [];
  localityScores.push({ name, locality, score });
  leaderboardData.set(locality, localityScores);

  res.json({ success: true, message: "Score submitted successfully" });
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
app.listen(PORT, () =>
  console.log(`✅ Backend running at http://localhost:${PORT}`)
);
