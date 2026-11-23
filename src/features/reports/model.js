
export const TA_RATE_PER_KM = 3;

/**
 * Safely parse numeric count from numbers or strings (e.g., "4", "4 visits", " 3 ").
 */
export function parseCount(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/,/g, "");
  if (!str) return 0;
  const match = str.match(/^-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Safely parse currency or payment amount from string or number (e.g., "₹10,000", "15000", "5.5k").
 */
export function parsePaymentAmount(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/,/g, "");
  if (!str) return 0;
  const match = str.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[0]) : 0;
}

export const blankReport = (user, date) => ({
  date: date || new Date().toLocaleDateString("en-CA"),
  executive: user?.displayName || "",
  siteSurvey: "0",
  revisits: "0",
  dealerVisits: "0",
  newLeads: "0",
  poCount: "0",
  docsBank: "0",
  closure: "0",
  paymentCollected: "0",
  activityType: "",
  area: "",
  focus1: "",
  focus2: "",
  focus3: "",
  // Legacy fields preserved for backward compatibility
  proposalSent: "",
  documentsCollected: "",
  docsProcess: "",
  collectionPending: "",
  totalPoCount: "",
  mtdPoCount: "",
  mtdClosure: "",
  mtdSiteSurvey: "",
  mtdRevisits: "",
  mtdDealerVisits: "",
});

/**
 * 10 Daily Sales Report fields in exact requested order
 */
export const todayFields = [
  ["siteSurvey", "Site survey done", "0"],
  ["revisits", "Re-visits", "0"],
  ["dealerVisits", "B2B visits", "0"],
  ["newLeads", "New leads collected", "0"],
  ["poCount", "PO count", "0"],
  ["docsBank", "Documents to bank", "0"],
  ["closure", "Closure", "0"],
  ["paymentCollected", "Payment collected", "0"],
  ["activityType", "Activity type", "e.g. Site survey, Lead visit"],
  ["area", "Area worked", "e.g. Kozhikode, Manjeri"],
];

export const mtdFields = [
  ["totalPoCount", "Total PO count", true],
  ["mtdPoCount", "MTD PO count", true],
  ["mtdClosure", "MTD closure", true],
  ["mtdSiteSurvey", "MTD site surveys", true],
  ["mtdRevisits", "MTD revisits", true],
  ["docsProcess", "Documents in process", false],
  ["docsBank", "Documents in bank", false],
  ["collectionPending", "Collection pending", false],
  ["mtdDealerVisits", "Dealer / B2B visits", true],
];

/**
 * Calculates Month-To-Date (MTD) cumulative metrics up to the specified date.
 * Excludes the current report being edited to prevent double counting.
 * Automatically deduplicates any duplicate records for the same date.
 */
export function calculateMtd({
  date,
  report = {},
  allReports = [],
  excludeId = null,
}) {
  const targetDate =
    date || report.date || new Date().toLocaleDateString("en-CA");
  const month = targetDate.slice(0, 7); // e.g. "2026-11"

  // Deduplicate past reports by date to avoid skewing sums
  const uniqueReportsByDate = new Map();

  allReports.forEach((r) => {
    if (!r || !r.date) return;
    if (excludeId && r.id === excludeId) return;
    if (r.date === targetDate) return;

    // Must be in the same month and strictly prior to target date
    if (r.date.slice(0, 7) === month && r.date < targetDate) {
      const existing = uniqueReportsByDate.get(r.date);
      if (!existing) {
        uniqueReportsByDate.set(r.date, r);
      } else {
        const timeA =
          existing.updatedAt?.toMillis?.() ||
          existing.createdAt?.toMillis?.() ||
          0;
        const timeB =
          r.updatedAt?.toMillis?.() || r.createdAt?.toMillis?.() || 0;
        if (timeB >= timeA) {
          uniqueReportsByDate.set(r.date, r);
        }
      }
    }
  });

  const priorReports = Array.from(uniqueReportsByDate.values());

  const base = {
    siteSurvey: priorReports.reduce((s, r) => s + parseCount(r.siteSurvey), 0),
    revisits: priorReports.reduce((s, r) => s + parseCount(r.revisits), 0),
    poCount: priorReports.reduce((s, r) => s + parseCount(r.poCount), 0),
    dealerVisits: priorReports.reduce((s, r) => s + parseCount(r.dealerVisits ?? r.b2bVisits), 0),
    newLeads: priorReports.reduce((s, r) => s + parseCount(r.newLeads), 0),
    proposalSent: priorReports.reduce((s, r) => s + parseCount(r.proposalSent), 0),
    docsBank: priorReports.reduce((s, r) => s + parseCount(r.docsBank), 0),
    closure: priorReports.reduce((s, r) => s + parseCount(r.closure || r.poCount), 0),
    daysCount: priorReports.length,
  };

  // Cumulative all-time POs prior to target date
  const allTimeUnique = new Map();
  allReports.forEach((r) => {
    if (!r || !r.date) return;
    if (excludeId && r.id === excludeId) return;
    if (r.date >= targetDate) return;
    const existing = allTimeUnique.get(r.date);
    if (!existing) {
      allTimeUnique.set(r.date, r);
    }
  });
  const allTimePriorPoCount = Array.from(allTimeUnique.values()).reduce(
    (s, r) => s + parseCount(r.poCount),
    0
  );

  const todaySiteSurvey = parseCount(report.siteSurvey);
  const todayRevisits = parseCount(report.revisits);
  const todayPoCount = parseCount(report.poCount);
  const todayDealerVisits = parseCount(report.dealerVisits ?? report.b2bVisits);
  const todayClosure = parseCount(report.closure !== undefined && report.closure !== "" ? report.closure : report.poCount);

  const mtdSiteSurvey = base.siteSurvey + todaySiteSurvey;
  const mtdRevisits = base.revisits + todayRevisits;
  const mtdPoCount = base.poCount + todayPoCount;
  const mtdDealerVisits = base.dealerVisits + todayDealerVisits;
  const totalPoCount = allTimePriorPoCount + todayPoCount;
  const mtdClosure = base.closure + todayClosure;

  return {
    base,
    totals: {
      mtdSiteSurvey,
      mtdRevisits,
      mtdPoCount,
      mtdDealerVisits,
      totalPoCount: totalPoCount || mtdPoCount,
      mtdClosure,
    },
    daysLoggedThisMonth: priorReports.length + 1,
  };
}

/**
 * Finds the latest report saved before a specified date.
 * Useful for carrying forward pipeline statuses (docs in process, bank, etc.).
 */
export function getPreviousReport(allReports = [], beforeDate) {
  const sorted = [...allReports]
    .filter((r) => r.date && (!beforeDate || r.date < beforeDate))
    .sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0] || null;
}

/**
 * Formats the Daily Sales Report into the user's exact requested template:
 *
 * 📊 *DAILY SALES REPORT* 📊
 * *Date:* [21/11/2026]
 * *Executive:* ADHIL
 * --------------------------------------------------------
 * 🚀 *TODAY’S UPDATE*
 *
 * • SITE SURVEY DONE: 0
 *
 * • RE VISITS :0
 *
 * • B2B VISITS:0
 *
 * • NEW LEADS COLLECTED:0
 *
 * • PO COUNT :0
 *
 * • DOCUMENTS TO BANK:0
 *
 * • CLOSURE :0
 *
 * • PAYMENT COLLECTED :0
 *
 * • ACTIVITY TYPE:
 *
 * • AREA WORKED :
 *
 * ---------------------------------------------------------
 *
 * 🎯 *TOMORROW'S TOP 3 FOCUS*
 * 1.
 * 2.
 * 3.
 */
export function formatReport(report = {}) {
  const numVal = (v) => {
    if (v === undefined || v === null || String(v).trim() === "") return "0";
    return String(v).trim();
  };
  const strVal = (v) => {
    if (v === undefined || v === null) return "";
    return String(v).trim();
  };

  const d = report.date ? report.date.split("-").reverse().join("/") : "";
  const dateFormatted = d ? `[${d}]` : "[]";

  const b2bVal =
    report.dealerVisits !== undefined &&
    report.dealerVisits !== null &&
    String(report.dealerVisits).trim() !== ""
      ? String(report.dealerVisits).trim()
      : numVal(report.b2bVisits);

  const closureVal =
    report.closure !== undefined &&
    report.closure !== null &&
    String(report.closure).trim() !== ""
      ? String(report.closure).trim()
      : numVal(report.poCount);

  const f1 = strVal(report.focus1);
  const f2 = strVal(report.focus2);
  const f3 = strVal(report.focus3);

  return `📊 *DAILY SALES REPORT* 📊
*Date:* ${dateFormatted}
*Executive:* ${strVal(report.executive)}
--------------------------------------------------------
🚀 *TODAY’S UPDATE*

• SITE SURVEY DONE: ${numVal(report.siteSurvey)}

• RE VISITS :${numVal(report.revisits)}

• B2B VISITS:${b2bVal}

• NEW LEADS COLLECTED:${numVal(report.newLeads)}

• PO COUNT :${numVal(report.poCount)}

• DOCUMENTS TO BANK:${numVal(report.docsBank)}

• CLOSURE :${closureVal}

• PAYMENT COLLECTED :${numVal(report.paymentCollected)}

• ACTIVITY TYPE:${strVal(report.activityType)}

• AREA WORKED :${strVal(report.area)}

---------------------------------------------------------

🎯 *TOMORROW'S TOP 3 FOCUS*
1.${f1 ? ` ${f1}` : ""}
2.${f2 ? ` ${f2}` : ""}
3.${f3 ? ` ${f3}` : ""}`;
}

/**
 * Calculates comprehensive Monthly Metrics, Daily Time Series,
 * Conversion Funnel Stages, Activity Mix, and Territory breakdowns
 * for the interactive Monthly Report charts and diagrams.
 */
export function calculateMonthlyMetrics({
  monthKey, // e.g. "2026-11"
  allReports = [],
  executive = "All",
}) {
  const targetMonth =
    monthKey || new Date().toLocaleDateString("en-CA").slice(0, 7);
  const [yearStr, monthNumStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthNumStr, 10);

  // Formatted Month name e.g. "November 2026"
  const monthDate = new Date(year, monthNum - 1, 1);
  const monthName = monthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Filter reports strictly for target month and optionally by executive
  const monthReports = allReports.filter((r) => {
    if (!r || !r.date) return false;
    const inMonth = r.date.startsWith(targetMonth);
    if (!inMonth) return false;
    if (executive && executive !== "All") {
      return (
        (r.executive || "").toLowerCase().trim() ===
        executive.toLowerCase().trim()
      );
    }
    return true;
  });

  // Deduplicate by date (keep the latest updated record)
  const uniqueByDate = new Map();
  monthReports.forEach((r) => {
    const existing = uniqueByDate.get(r.date);
    if (!existing) {
      uniqueByDate.set(r.date, r);
    } else {
      const timeA =
        existing.updatedAt?.toMillis?.() ||
        existing.createdAt?.toMillis?.() ||
        0;
      const timeB =
        r.updatedAt?.toMillis?.() || r.createdAt?.toMillis?.() || 0;
      if (timeB >= timeA) {
        uniqueByDate.set(r.date, r);
      }
    }
  });

  const validReports = Array.from(uniqueByDate.values());

  // Aggregate monthly totals
  let totalSiteSurveys = 0;
  let totalRevisits = 0;
  let totalB2bVisits = 0;
  let totalNewLeads = 0;
  let totalPos = 0;
  let totalDocsBank = 0;
  let totalClosures = 0;
  let totalPayments = 0;
  const areaCounts = {};

  validReports.forEach((r) => {
    const surveys = parseCount(r.siteSurvey);
    const revs = parseCount(r.revisits);
    const b2b = parseCount(r.dealerVisits ?? r.b2bVisits);
    const leads = parseCount(r.newLeads);
    const pos = parseCount(r.poCount);
    const docs = parseCount(r.docsBank);
    const closures = parseCount(
      r.closure !== undefined && r.closure !== "" ? r.closure : r.poCount
    );
    const payment = parsePaymentAmount(r.paymentCollected);

    totalSiteSurveys += surveys;
    totalRevisits += revs;
    totalB2bVisits += b2b;
    totalNewLeads += leads;
    totalPos += pos;
    totalDocsBank += docs;
    totalClosures += closures;
    totalPayments += payment;

    if (r.area) {
      const areaList = String(r.area)
        .split(/[,/&]+/)
        .map((a) => a.trim())
        .filter((a) => a.length > 2);
      areaList.forEach((areaName) => {
        areaCounts[areaName] = (areaCounts[areaName] || 0) + 1;
      });
    }
  });

  const activeDays = validReports.length;
  const totalFieldVisits = totalSiteSurveys + totalRevisits + totalB2bVisits;

  // Conversion rates
  const surveyToClosureRate =
    totalSiteSurveys > 0
      ? ((totalClosures / totalSiteSurveys) * 100).toFixed(1)
      : "0.0";
  const leadToSurveyRate =
    totalNewLeads > 0
      ? ((totalSiteSurveys / totalNewLeads) * 100).toFixed(1)
      : "0.0";
  const avgVisitsPerDay =
    activeDays > 0 ? (totalFieldVisits / activeDays).toFixed(1) : "0.0";

  // Days in month
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const dailySeries = [];
  let cumulativePos = 0;
  let cumulativeSurveys = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, "0");
    const dateStr = `${targetMonth}-${dayStr}`;
    const r = uniqueByDate.get(dateStr) || null;

    const surveys = r ? parseCount(r.siteSurvey) : 0;
    const revs = r ? parseCount(r.revisits) : 0;
    const b2b = r ? parseCount(r.dealerVisits ?? r.b2bVisits) : 0;
    const leads = r ? parseCount(r.newLeads) : 0;
    const pos = r ? parseCount(r.poCount) : 0;
    const docs = r ? parseCount(r.docsBank) : 0;
    const closures = r
      ? parseCount(
          r.closure !== undefined && r.closure !== "" ? r.closure : r.poCount
        )
      : 0;
    const payment = r ? parsePaymentAmount(r.paymentCollected) : 0;

    cumulativePos += closures;
    cumulativeSurveys += surveys;

    dailySeries.push({
      day,
      dayStr,
      date: dateStr,
      hasReport: !!r,
      siteSurvey: surveys,
      revisits: revs,
      dealerVisits: b2b,
      newLeads: leads,
      poCount: pos,
      docsBank: docs,
      closure: closures,
      payment,
      area: r?.area || "",
      executive: r?.executive || "",
      totalVisits: surveys + revs + b2b,
      cumulativePos,
      cumulativeSurveys,
    });
  }

  // Conversion Funnel Stages Data
  const funnelStages = [
    {
      id: "leads",
      name: "New Leads Collected",
      count: totalNewLeads,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500",
      percentage: 100,
    },
    {
      id: "surveys",
      name: "Site Surveys Done",
      count: totalSiteSurveys,
      color: "from-teal-500 to-emerald-500",
      bgColor: "bg-teal-500",
      percentage:
        totalNewLeads > 0
          ? Math.min(100, Math.round((totalSiteSurveys / totalNewLeads) * 100))
          : totalSiteSurveys > 0
            ? 100
            : 0,
    },
    {
      id: "revisits",
      name: "Re-visits & Negotiations",
      count: totalRevisits,
      color: "from-amber-500 to-yellow-500",
      bgColor: "bg-amber-500",
      percentage:
        totalSiteSurveys > 0
          ? Math.min(100, Math.round((totalRevisits / totalSiteSurveys) * 100))
          : 0,
    },
    {
      id: "docs",
      name: "Documents to Bank",
      count: totalDocsBank,
      color: "from-indigo-500 to-purple-500",
      bgColor: "bg-indigo-500",
      percentage:
        totalSiteSurveys > 0
          ? Math.min(100, Math.round((totalDocsBank / totalSiteSurveys) * 100))
          : 0,
    },
    {
      id: "closure",
      name: "Closed Deals / POs Won",
      count: totalClosures,
      color: "from-emerald-500 to-green-600",
      bgColor: "bg-emerald-600",
      percentage:
        totalSiteSurveys > 0
          ? Math.min(100, Math.round((totalClosures / totalSiteSurveys) * 100))
          : 0,
    },
  ];

  // Activity Mix (for Donut / Ratio Diagram)
  const totalActions =
    totalSiteSurveys + totalRevisits + totalB2bVisits + totalNewLeads;
  const activityMix = [
    {
      name: "Site Surveys",
      count: totalSiteSurveys,
      percentage:
        totalActions > 0
          ? Math.round((totalSiteSurveys / totalActions) * 100)
          : 0,
      color: "#059669", // emerald-600
    },
    {
      name: "Re-visits",
      count: totalRevisits,
      percentage:
        totalActions > 0
          ? Math.round((totalRevisits / totalActions) * 100)
          : 0,
      color: "#0284c7", // sky-600
    },
    {
      name: "B2B Visits",
      count: totalB2bVisits,
      percentage:
        totalActions > 0
          ? Math.round((totalB2bVisits / totalActions) * 100)
          : 0,
      color: "#8b5cf6", // purple-500
    },
    {
      name: "New Leads",
      count: totalNewLeads,
      percentage:
        totalActions > 0
          ? Math.round((totalNewLeads / totalActions) * 100)
          : 0,
      color: "#f59e0b", // amber-500
    },
  ];

  // Top territory/areas worked
  const topTerritories = Object.entries(areaCounts)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    monthKey: targetMonth,
    monthName,
    year,
    monthNum,
    daysInMonth,
    activeDays,
    executive,
    totals: {
      siteSurvey: totalSiteSurveys,
      revisits: totalRevisits,
      dealerVisits: totalB2bVisits,
      newLeads: totalNewLeads,
      poCount: totalPos,
      docsBank: totalDocsBank,
      closure: totalClosures,
      totalClosures,
      paymentSum: totalPayments,
      totalFieldVisits,
      activeDays,
    },
    conversionRates: {
      surveyToClosure: `${surveyToClosureRate}%`,
      leadToSurvey: `${leadToSurveyRate}%`,
      avgVisitsPerDay,
    },
    funnelStages,
    activityMix,
    totalActions,
    topTerritories,
    dailySeries,
    rawReports: validReports.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/**
 * Formats a clean WhatsApp-ready monthly summary message
 */
export function formatMonthlyReport({
  monthName,
  executive,
  totals = {},
  conversionRates = {},
}) {
  return `📊 *MONTHLY SALES PERFORMANCE REPORT* 📊
*Month:* [${monthName || ""}]
*Executive:* ${executive || "All"}
--------------------------------------------------------
🚀 *MONTHLY HIGHLIGHTS & TOTALS*

• TOTAL PO / CLOSURES: ${totals.closure ?? totals.totalClosures ?? 0}

• TOTAL SITE SURVEYS: ${totals.siteSurvey ?? 0}

• TOTAL RE-VISITS: ${totals.revisits ?? 0}

• TOTAL B2B VISITS:${totals.dealerVisits ?? 0}

• NEW LEADS COLLECTED:${totals.newLeads ?? 0}

• DOCUMENTS TO BANK:${totals.docsBank ?? 0}

• TOTAL PAYMENT COLLECTED: ₹${(totals.paymentSum ?? 0).toLocaleString("en-IN")}

• ACTIVE FIELD DAYS: ${totals.activeDays ?? 0} Days
---------------------------------------------------------
🎯 *PERFORMANCE & RATIOS*
• Survey to Closure: ${conversionRates.surveyToClosure || "0%"}
• Leads to Survey: ${conversionRates.leadToSurvey || "0%"}
• Daily Field Avg: ${conversionRates.avgVisitsPerDay || "0"} visits/day
---------------------------------------------------------
✨ Generated via Echonix Sales CRM`;
}
