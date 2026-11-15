/**
 * Solar Sizing, Tariff, PM Surya Ghar Subsidy & WhatsApp Handover Specs
 * Tailored for Kerala / KSEB consumers and ECHONIX field sales.
 */

// PM Surya Ghar Muft Bijli Yojana Central Subsidy (Residential)
// 1 kW: ₹30,000 | 2 kW: ₹60,000 | 3 kW+: ₹78,000 (capped at 3 kW for residential)
export function calculateSubsidy(systemKw, isResidential = true) {
  if (!isResidential || !systemKw || systemKw <= 0) return 0;
  const kw = Number(systemKw);
  if (kw <= 1) return 30000;
  if (kw < 3) return 30000 + Math.round((kw - 1) * 30000);
  return 78000; // Capped at ₹78,000 for 3kW and above
}

// Official ECHONIX turnkey rates in Kerala (With KSEB Net Metering, Structure & Delivery)
// Exact company price ranges:
// 3 kW Normal: ₹2,15,000 - ₹2,20,000 | + Optimizer: ₹2,25,000 - ₹2,30,000
// 4 kW Normal: ₹2,65,000 - ₹2,70,000 | + Optimizer: ₹2,75,000 - ₹2,80,000
// 5 kW Normal: ₹3,45,000 - ₹3,50,000 | + Optimizer: ₹3,55,000 - ₹3,60,000
export const ECHONIX_PRICING_TABLE = {
  1: {
    normal: { min: 80000, max: 85000, default: 85000 },
    optimizer: { min: 90000, max: 95000, default: 95000 },
  },
  2: {
    normal: { min: 150000, max: 155000, default: 155000 },
    optimizer: { min: 160000, max: 165000, default: 165000 },
  },
  3: {
    normal: { min: 215000, max: 220000, default: 220000 },
    optimizer: { min: 225000, max: 230000, default: 225000 },
  },
  4: {
    normal: { min: 265000, max: 270000, default: 265000 },
    optimizer: { min: 275000, max: 280000, default: 275000 },
  },
  5: {
    normal: { min: 345000, max: 350000, default: 345000 },
    optimizer: { min: 355000, max: 360000, default: 355000 },
  },
  6: {
    normal: { min: 415000, max: 420000, default: 415000 },
    optimizer: { min: 425000, max: 430000, default: 425000 },
  },
  7: {
    normal: { min: 480000, max: 490000, default: 485000 },
    optimizer: { min: 495000, max: 505000, default: 500000 },
  },
  8: {
    normal: { min: 545000, max: 555000, default: 550000 },
    optimizer: { min: 560000, max: 570000, default: 565000 },
  },
  9: {
    normal: { min: 610000, max: 620000, default: 615000 },
    optimizer: { min: 625000, max: 635000, default: 630000 },
  },
  10: {
    normal: { min: 675000, max: 685000, default: 680000 },
    optimizer: { min: 690000, max: 700000, default: 695000 },
  },
};

export const DEFAULT_PRICING = {
  1: 85000,
  2: 155000,
  3: 220000,
  4: 265000,
  5: 345000,
  6: 415000,
  7: 485000,
  8: 550000,
  9: 615000,
  10: 680000,
};

export function getEchonixPriceRange(systemKw, withOptimizer = false) {
  const kw = Math.round(Number(systemKw || 3));
  const entry = ECHONIX_PRICING_TABLE[kw];
  if (entry) {
    return withOptimizer ? entry.optimizer : entry.normal;
  }
  const basePerKw = withOptimizer ? 72000 : 70000;
  const approx = Math.round(kw * basePerKw);
  return { min: approx - 5000, max: approx + 5000, default: approx };
}

export function estimateSystemCost(systemKw, withOptimizer = false) {
  const range = getEchonixPriceRange(systemKw, withOptimizer);
  return range.default;
}

// Default panel count from system kW (based on ~550Wp / 554Wp panels)
export function estimatePanelCount(systemKw, panelWattage = 554) {
  const kw = Number(systemKw || 3);
  const totalWatts = kw * 1000;
  const count = Math.ceil(totalWatts / Number(panelWattage || 554));
  return Math.max(2, count);
}

// Kerala KSEB bimonthly bill to monthly units & recommended kW estimation
export function estimateSizingFromBill(bimonthlyBillRupees) {
  const bill = Math.max(0, Number(bimonthlyBillRupees || 0));

  let estimatedMonthlyUnits = 100;
  if (bill <= 1000) {
    estimatedMonthlyUnits = Math.round(bill / 8.5);
  } else if (bill <= 3000) {
    estimatedMonthlyUnits = Math.round(bill / 9.2);
  } else if (bill <= 6000) {
    estimatedMonthlyUnits = Math.round(bill / 9.8);
  } else {
    estimatedMonthlyUnits = Math.round(bill / 10.5);
  }

  // 1 kW solar in Kerala generates ~120 units per month (~4 units/day)
  let recommendedKw = estimatedMonthlyUnits / 120;

  if (recommendedKw <= 1.5) recommendedKw = 2;
  else if (recommendedKw <= 2.4) recommendedKw = 2;
  else if (recommendedKw <= 3.4) recommendedKw = 3;
  else if (recommendedKw <= 4.4) recommendedKw = 4;
  else if (recommendedKw <= 5.4) recommendedKw = 5;
  else recommendedKw = Math.ceil(recommendedKw);

  return {
    estimatedMonthlyUnits,
    recommendedKw: Math.min(20, Math.max(1, recommendedKw)),
  };
}

export function calculateSolarMetrics({
  systemKw = 3,
  customCost = null,
  isResidential = true,
  tariffPerUnit = 8.0,
  withOptimizer = false,
}) {
  const kw = Number(systemKw) || 3;
  const cost = customCost ? Number(customCost) : estimateSystemCost(kw, withOptimizer);
  const subsidy = calculateSubsidy(kw, isResidential);
  const netInvestment = Math.max(0, cost - subsidy);

  // In Kerala, ~4 units per kW per day -> ~120 units/month -> ~1,440 units/year
  const dailyGenerationUnits = Math.round(kw * 4 * 10) / 10;
  const monthlyGenerationUnits = Math.round(kw * 120);
  const yearlyGenerationUnits = Math.round(kw * 1440);

  // Financial savings
  const monthlySavings = Math.round(monthlyGenerationUnits * tariffPerUnit);
  const yearlySavings = Math.round(yearlyGenerationUnits * tariffPerUnit);

  // Payback period in years
  const paybackYears =
    yearlySavings > 0
      ? Math.round((netInvestment / yearlySavings) * 10) / 10
      : 3.5;

  // 25-year lifetime generation and gross savings
  const lifetimeGenerationUnits = yearlyGenerationUnits * 25;
  const lifetimeGrossSavings = yearlySavings * 25;
  const lifetimeNetProfit = lifetimeGrossSavings - netInvestment;

  // Roof space requirement (approx 80-90 sq ft per kW for modern 550W+ Mono PERC / Bi-facial panels)
  const roofAreaSqFt = Math.round(kw * 85);

  // Environmental Impact
  const annualCo2SavedKg = Math.round(yearlyGenerationUnits * 0.82);
  const equivalentTrees = Math.round(annualCo2SavedKg / 20);

  return {
    systemKw: kw,
    cost,
    subsidy,
    netInvestment,
    dailyGenerationUnits,
    monthlyGenerationUnits,
    yearlyGenerationUnits,
    monthlySavings,
    yearlySavings,
    paybackYears,
    lifetimeGenerationUnits,
    lifetimeGrossSavings,
    lifetimeNetProfit,
    roofAreaSqFt,
    annualCo2SavedKg,
    equivalentTrees,
  };
}

/**
 * EXACT ECHONIX WhatsApp Group Handover / Booking Specification format:
 * Used when a customer confirms OK and the execution WhatsApp group is created.
 */
export function formatWhatsAppGroupBookingSpec({
  customerName = "",
  phone = "",
  location = "",
  systemKw = 4,
  systemType = "On-Grid",
  withOptimizer = true,
  panelWattage = "554 Wp",
  panelCount = 6,
  panelBrand = "Goldie/ Rayzon",
  inverterKw = 4,
  inverterBrand = "",
  structure = "8 panel  structure",
  roofType = "concrete flat  roof",
  totalPrice = 240000,
  withKsebCharge = true,
  paymentType = "Loan  amount 2 Lack",
  branch = "chandapadi, ponnani",
  website = "https://echonix.in",
  includeCustomerHeader = true,
}) {
  const kw = Number(systemKw) || 4;
  const invKw = inverterKw || kw;
  const optText = withOptimizer ? " with optimizer" : "";
  const ksebText = withKsebCharge ? " (With KSEB Charge )" : "";
  const priceDisplay = Number(totalPrice || 0);

  let header = "";
  if (includeCustomerHeader && (customerName || phone || location)) {
    header = `👤 *Customer: ${customerName || "Customer"}*${phone ? ` (${phone})` : ""}${location ? ` - ${location}` : ""}\n\n`;
  }

  return `${header}🌞 *സിസ്റ്റം: ${kw} KW ${systemType}*${optText}
🔺പാനലുകൾ: ${panelWattage} x ${panelCount} എണ്ണം ${panelBrand} 
🔺 ഇൻവെർട്ടർ: ${invKw}KW${inverterBrand ? ` ${inverterBrand}` : ""}

     ( ${structure.trim()})
🔺റൂഫ് ടൈപ്: ${roofType}

💰 *ആകെ വില: ₹ ${priceDisplay}*${ksebText}


Payment Type:: ${paymentType}
branch: ${branch} 

${website}`;
}

/**
 * Detailed Customer Pitch & Financial Proposal (Pre-closing presentation)
 */
export function formatWhatsAppQuote({
  customerName = "Valued Customer",
  phone = "",
  location = "",
  ksebConsumerNo = "",
  systemKw = 3,
  systemType = "On-Grid (Grid-Tied)",
  panelBrand = "Tier-1 550W+ Bi-Facial / Mono PERC",
  inverterBrand = "Grid-Tied Solar Inverter with Wi-Fi App",
  customCost = null,
  isResidential = true,
  executiveName = "Shanis",
  branch = "chandapadi, ponnani",
}) {
  const metrics = calculateSolarMetrics({
    systemKw,
    customCost,
    isResidential,
  });

  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  return `☀️ *ECHONIX SOLAR — INSTANT QUOTATION* ☀️
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${customerName}
📍 *Location:* ${location || "Site Address"}
${ksebConsumerNo ? `⚡ *KSEB Consumer No:* ${ksebConsumerNo}\n` : ""}🏢 *Branch:* ${branch}
🗓️ *Date:* ${new Date().toLocaleDateString("en-GB")}

⚡ *PROPOSED SOLAR SYSTEM:*
• *System Capacity:* *${metrics.systemKw} kW* ${systemType}
• *Solar Modules:* ${panelBrand}
• *Inverter:* ${inverterBrand}
• *Required Roof Area:* ~${metrics.roofAreaSqFt} sq.ft
• *Avg. Daily Generation:* ~${metrics.dailyGenerationUnits} Units/day
• *Monthly Generation:* ~${metrics.monthlyGenerationUnits} Units/month

💰 *FINANCIAL & SUBSIDY BREAKDOWN:*
• *Total Turnkey Price:* ${money(metrics.cost)}
• *PM Surya Ghar Subsidy:* -${money(metrics.subsidy)}
━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *NET EFFECTIVE INVESTMENT: ${money(metrics.netInvestment)}*
━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 *SAVINGS & RETURN ON INVESTMENT:*
• *Monthly Bill Savings:* ~${money(metrics.monthlySavings)} /month
• *Yearly Savings:* ~${money(metrics.yearlySavings)} /year
• *Est. Payback Period:* *${metrics.paybackYears} Years*
• *25-Year Net Benefit:* ~${money(metrics.lifetimeNetProfit)}

🛡️ *ECHONIX QUALITY GUARANTEE:*
✅ 25-Year Performance Warranty on Solar Panels
✅ 5-8 Year Warranty on Solar Inverter
✅ 5-Year Comprehensive Free Workmanship & Service
✅ Complete KSEB Bi-directional Net Metering & Subsidy assistance

🌐 *Website:* https://echonix.in
📞 *Executive:* ${executiveName} (ECHONIX Solar)`;
}
