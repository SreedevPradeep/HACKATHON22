const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

// ---------- Factors & Prices ----------
const EF = {
  // per-km travel emissions (kg CO2 per km)
  commute: { car: 0.21, bus: 0.10, bike: 0.05, metro: 0.07, auto: 0.13, ev: 0.12 },
  // grid electricity (India avg)
  grid_kg_per_kwh: 0.82,
  // LPG per 14.2 kg cylinder
  lpg_kg_per_cylinder: 44.7,
  // liquid fuels (kg per liter)
  petrol_kg_per_l: 2.31,
  diesel_kg_per_l: 2.68
};

const PRICES = {
  rupees_per_kwh: 8,
  petrol_per_l: 105,
  diesel_per_l: 95,
  lpg_per_cylinder: 1100
};

const MONTHLY_GOAL_KG = 170; // ~2 t/yr target

// In-memory demo stores
const leaderboard = new Map(); // locality => [{name,totalKg,points,ts}, ...]
const userPoints = new Map();  // name => points
const catalog = [
  { id: "tree-plant", label: "Plant-a-Tree Badge", cost: 200 },
  { id: "water-saver", label: "Water Saver Badge", cost: 150 },
  { id: "bike-hero", label: "Bike Hero Badge", cost: 250 }
];

app.get("/", (_req, res) => res.send("Carbon API OK"));

/**
 * Body:
 * { bill, lpgCylinders,
 *   vehicles: [{
 *     type: "car"|"bike"|"bus"|"metro"|"auto"|"ev",
 *     distancePerDay?: number,                  // km/day
 *     fuelType: "petrol"|"diesel"|"electric",   // pick one
 *     fuelAmountPerMonth?: number               // L for petrol/diesel, kWh for electric
 *   }]
 * }
 */
app.post("/calculate", (req, res) => {
  const { bill = 0, lpgCylinders = 0, vehicles = [] } = req.body || {};

  // Home electricity
  const units = Number(bill) / PRICES.rupees_per_kwh;
  const electricityKg = Math.max(0, units * EF.grid_kg_per_kwh);

  // Cooking gas
  const lpgKg = Math.max(0, Number(lpgCylinders) * EF.lpg_kg_per_cylinder);

  // Vehicles
  let commuteVehiclesKg = 0, petrolVehiclesKg = 0, dieselVehiclesKg = 0, evEnergyKg = 0;

  if (Array.isArray(vehicles)) {
    for (const v of vehicles) {
      const type = (v?.type || "car").toLowerCase();
      const fuelType = (v?.fuelType || "").toLowerCase(); // petrol|diesel|electric
      const kmPerDay = Math.max(0, Number(v?.distancePerDay) || 0);
      const fuelAmount = Math.max(0, Number(v?.fuelAmountPerMonth) || 0);

      // Commute (km/day × 30 × factor)
      const perKm = EF.commute[type] ?? EF.commute.car;
      commuteVehiclesKg += kmPerDay * perKm * 30;

      // Fuel/energy
      if (fuelType === "petrol") petrolVehiclesKg += fuelAmount * EF.petrol_kg_per_l;
      else if (fuelType === "diesel") dieselVehiclesKg += fuelAmount * EF.diesel_kg_per_l;
      else if (fuelType === "electric") evEnergyKg += fuelAmount * EF.grid_kg_per_kwh; // kWh × grid
    }
  }

  const fuelVehiclesKg = petrolVehiclesKg + dieselVehiclesKg + evEnergyKg;
  const totalKg = +(electricityKg + lpgKg + commuteVehiclesKg + fuelVehiclesKg).toFixed(1);

  // Money (EV kWh not priced here to avoid double counting with home bill)
  const petrolLitersTotal = Array.isArray(vehicles)
    ? vehicles.reduce((a, v) => a + (v?.fuelType === "petrol" ? Number(v?.fuelAmountPerMonth) || 0 : 0), 0) : 0;
  const dieselLitersTotal = Array.isArray(vehicles)
    ? vehicles.reduce((a, v) => a + (v?.fuelType === "diesel" ? Number(v?.fuelAmountPerMonth) || 0 : 0), 0) : 0;

  const money = {
    electricity: Math.max(0, Number(bill) || 0),
    lpg: Math.max(0, Number(lpgCylinders) * PRICES.lpg_per_cylinder),
    petrol: Math.max(0, petrolLitersTotal * PRICES.petrol_per_l),
    diesel: Math.max(0, dieselLitersTotal * PRICES.diesel_per_l)
  };
  money.total = money.electricity + money.lpg + money.petrol + money.diesel;

  const warning = totalKg > MONTHLY_GOAL_KG
    ? { level: "above_target", goal: MONTHLY_GOAL_KG, overBy: +(totalKg - MONTHLY_GOAL_KG).toFixed(1) }
    : { level: "on_target", goal: MONTHLY_GOAL_KG, remaining: +(MONTHLY_GOAL_KG - totalKg).toFixed(1) };

  const tips = [];
  if (vehicles.some(v => ["car","auto"].includes((v?.type||"").toLowerCase()))) {
    tips.push("Swap 2 days/week to public transit to cut commute CO₂ by ~30%.");
    tips.push("Carpool once a week and combine errands.");
  }
  if (bill > 0) {
    tips.push("Set AC to 26°C and use a fan: saves ~10–20% electricity.");
    tips.push("Switch to LED and turn off standby loads to save 10–15%.");
  }
  if (lpgCylinders > 0) tips.push("Use pressure cooker and batch-cook to reduce LPG use.");

  res.json({
    parts: { electricityKg, lpgKg, commuteVehiclesKg, petrolVehiclesKg, dieselVehiclesKg, evEnergyKg },
    totalKg, goal: MONTHLY_GOAL_KG, warning, money, tips
  });
});

// Leaderboard / points / rewards
app.post("/score", (req, res) => {
  const { name = "Guest", locality = "Global", totalKg = 0 } = req.body || {};
  const cleanName = String(name).slice(0, 30);
  const cleanLoc = String(locality).slice(0, 40);
  const pointsEarned = Math.max(0, Math.round(500 - Number(totalKg)));
  const current = userPoints.get(cleanName) || 0;
  userPoints.set(cleanName, current + pointsEarned);
  const list = leaderboard.get(cleanLoc) || [];
  list.push({ name: cleanName, totalKg: Number(totalKg), points: current + pointsEarned, ts: Date.now() });
  list.sort((a, b) => b.points - a.points);
  leaderboard.set(cleanLoc, list.slice(0, 10));
  res.json({ ok: true, pointsEarned, totalPoints: userPoints.get(cleanName) });
});

app.get("/leaderboard", (req, res) => {
  const locality = String(req.query.locality || "Global");
  res.json({ locality, top: leaderboard.get(locality) || [] });
});

app.get("/rewards", (_req, res) => res.json({ catalog }));
app.post("/redeem", (req, res) => {
  const { name = "Guest", rewardId } = req.body || {};
  const reward = catalog.find(r => r.id === rewardId);
  if (!reward) return res.status(400).json({ ok: false, error: "Invalid reward" });
  const pts = userPoints.get(name) || 0;
  if (pts < reward.cost) return res.status(400).json({ ok: false, error: "Not enough points" });
  userPoints.set(name, pts - reward.cost);
  res.json({ ok: true, reward, remainingPoints: userPoints.get(name) });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Backend running on ${port}`));
