
export const TA_RATE_PER_KM = 3;

export const blankReport = (user) => ({
  date: new Date().toLocaleDateString("en-CA"),
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
  ["totalPoCount", "Total PO count"],
  ["mtdPoCount", "MTD PO count"],
  ["mtdClosure", "MTD closure"],
  ["mtdSiteSurvey", "MTD site surveys"],
  ["mtdRevisits", "MTD revisits"],
  ["docsProcess", "Documents in process"],
  ["docsBank", "Documents in bank"],
  ["collectionPending", "Collection pending"],
  ["mtdDealerVisits", "Dealer / B2B visits"],
];

export function formatReport(report, expenses = []) {
  const value = (v) => (v !== undefined && v !== null && v !== "" ? v : "—");

  // Only expenses belonging to the selected report date
  const today = expenses.filter((e) => e.date === report.date);

  const ta = today.filter((e) => e.type === "TA");
  const other = today.filter((e) => e.type !== "TA");

  // TA calculations
  const km = ta.reduce(
    (sum, e) => sum + Number(e.km || 0),
    0
  );

  const taAmount = ta.reduce(
    (sum, e) => sum + Number(e.km || 0) * TA_RATE_PER_KM,
    0
  );

  // Display each route with its own km and TA amount
  const routes = ta
    .map((e) => {
      const routeKm = Number(e.km || 0);
      const routeAmount = routeKm * TA_RATE_PER_KM;

      return `${e.route || "Route"} — ${routeKm} km — ₹${routeAmount.toLocaleString("en-IN")}`;
    })
    .join("; ");

  // Non-TA expenses
  const expenseNotes = other
    .map((e) => {
      const description = e.note || e.route || "—";
      const amount =
        e.amount !== undefined && e.amount !== null && e.amount !== ""
          ? ` ₹${Number(e.amount).toLocaleString("en-IN")}`
          : "";

      return `${e.type}: ${description}${amount}`;
    })
    .join("; ");

  return `*DAILY SALES REPORT*
*Date:* ${report.date ? report.date.split("-").reverse().join("/") : "—"}
*Executive:* ${value(report.executive)}

*TODAY'S UPDATE*
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

*TRAVEL & EXPENSES*
• TA / ROUTE: ${routes || "—"}
• TOTAL TA ALLOWANCE: ₹${taAmount.toLocaleString("en-IN")}
• FOOD / OTHER: ${expenseNotes || "—"}
• TODAY'S TRAVEL: ${km} km

*MTD UPDATE*
• TOTAL PO COUNT: ${value(report.totalPoCount)}
• MTD PO COUNT: ${value(report.mtdPoCount)}
• MTD CLOSURE: ${value(report.mtdClosure)}
• MTD SITE SURVEYS: ${value(report.mtdSiteSurvey)}
• MTD REVISITS: ${value(report.mtdRevisits)}
• DOCUMENTS IN PROCESS: ${value(report.docsProcess)}
• DOCUMENTS IN BANK: ${value(report.docsBank)}
• COLLECTION PENDING: ${value(report.collectionPending)}
• DEALER / B2B VISITS: ${value(report.mtdDealerVisits)}

*TOMORROW'S TOP 3 FOCUS*
1. ${value(report.focus1)}
2. ${value(report.focus2)}
3. ${value(report.focus3)}`;
}
