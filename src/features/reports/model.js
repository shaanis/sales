
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

export const blankReport = (user, date) => ({
  date: date || new Date().toLocaleDateString("en-CA"),
  executive: user?.displayName || "",
  area: "",
  newLeads: "",
  siteSurvey: "",
  proposalSent: "",
  activityType: "",
  revisits: "",
  poCount: "",
  documentsCollected: "",
  dealerVisits: "",
  paymentCollected: "",
  totalPoCount: "",
  mtdPoCount: "",
  mtdClosure: "",
  mtdSiteSurvey: "",
  mtdRevisits: "",
  docsProcess: "",
  docsBank: "",
  collectionPending: "",
  mtdDealerVisits: "",
  focus1: "",
  focus2: "",
  focus3: "",
});

export const todayFields = [
  ["area", "Area / locations worked", "e.g. Worked with Ashraf"],
  ["newLeads", "New leads collected", "e.g. 4"],
  ["siteSurvey", "Site surveys completed", "e.g. 2"],
  ["proposalSent", "Proposals sent", "e.g. 1"],
  ["activityType", "Activity type", "e.g. Site visit, follow-up"],
  ["revisits", "Re-visits", "e.g. 2"],
  ["poCount", "PO count today", "e.g. 1"],
  ["documentsCollected", "Documents collected", "e.g. KSEB bill, ID proof"],
  ["dealerVisits", "Dealer / B2B visits", "e.g. 2"],
  ["paymentCollected", "Payment collected", "e.g. ₹10,000"],
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
    dealerVisits: priorReports.reduce((s, r) => s + parseCount(r.dealerVisits), 0),
    newLeads: priorReports.reduce((s, r) => s + parseCount(r.newLeads), 0),
    proposalSent: priorReports.reduce((s, r) => s + parseCount(r.proposalSent), 0),
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
  const todayDealerVisits = parseCount(report.dealerVisits);

  const mtdSiteSurvey = base.siteSurvey + todaySiteSurvey;
  const mtdRevisits = base.revisits + todayRevisits;
  const mtdPoCount = base.poCount + todayPoCount;
  const mtdDealerVisits = base.dealerVisits + todayDealerVisits;
  const totalPoCount = allTimePriorPoCount + todayPoCount;
  const mtdClosure = mtdPoCount;

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

export function formatReport(report, expenses = [], allReports = []) {
  const value = (v) => (v !== undefined && v !== null && v !== "" ? v : "");

  // If MTD numbers are not explicitly set or empty, compute dynamically if allReports is provided
  let calculatedTotals = null;
  if (allReports && allReports.length > 0) {
    calculatedTotals = calculateMtd({
      date: report.date,
      report,
      allReports,
      excludeId: report.id,
    }).totals;
  }

  const getMtdVal = (key) => {
    if (
      report[key] !== undefined &&
      report[key] !== null &&
      report[key] !== ""
    ) {
      return report[key];
    }
    if (calculatedTotals && calculatedTotals[key] !== undefined) {
      return calculatedTotals[key];
    }
    return "";
  };

  return `📊 *DAILY SALES REPORT* 📊
*Date:* ${report.date ? report.date.split("-").reverse().join("/") : " "}
*Executive:* ${value(report.executive)}

🚀 *TODAY'S UPDATE*
• AREA: ${value(report.area)}
• NEW LEADS COLLECTED: ${value(report.newLeads)}
• SITE SURVEY DONE: ${value(report.siteSurvey)}
• PROPOSAL SENT: ${value(report.proposalSent)}
• ACTIVITY TYPE: ${value(report.activityType)}
• RE VISITS: ${value(report.revisits)}
• PO COUNT: ${value(report.poCount)}
• DOCUMENTS COLLECTED: ${value(report.documentsCollected)}
• DEALER/B2B VISITS: ${value(report.dealerVisits)}
• PAYMENT COLLECTED: ${value(report.paymentCollected)}
---------------------------------------------------------
🚀 *MTD UPDATE*
• TOTAL PO COUNT: ${value(getMtdVal("totalPoCount"))}
• MTD PO COUNT: ${value(getMtdVal("mtdPoCount"))}
• MTD CLOSURE: ${value(getMtdVal("mtdClosure"))}
• MTD SITE SURVEYS: ${value(getMtdVal("mtdSiteSurvey"))}
• MTD REVISITS: ${value(getMtdVal("mtdRevisits"))}
• DOCUMENTS IN PROCESS: ${value(report.docsProcess)}
• DOCUMENTS IN BANK: ${value(report.docsBank)}
• COLLECTION PENDING: ${value(report.collectionPending)}
• DEALER / B2B VISITS: ${value(getMtdVal("mtdDealerVisits"))}
---------------------------------------------------------
🎯 *TOMORROW'S TOP 3 FOCUS*
1. ${value(report.focus1)}
2. ${value(report.focus2)}
3. ${value(report.focus3)}`;
}
