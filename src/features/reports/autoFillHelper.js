/**
 * Auto-Fill Engine for ECHONIX Daily Sales Report
 * Aggregates today's real activity from Firestore collections:
 * leads, followups, expenses, and extracts tomorrow's scheduled focus.
 */

import { parseCount, TA_RATE_PER_KM } from "./model";

const getTomorrowDateString = (currentDateStr) => {
  const base = currentDateStr ? new Date(`${currentDateStr}T12:00:00`) : new Date();
  base.setDate(base.getDate() + 1);
  return base.toLocaleDateString("en-CA");
};

export function autoCompileReportFromDailyActivity({
  targetDate,
  currentReport,
  leads = [],
  followups = [],
  expenses = [],
  allReports = [],
}) {
  const dateStr = targetDate || currentReport?.date || new Date().toLocaleDateString("en-CA");
  const tomorrowStr = getTomorrowDateString(dateStr);

  const breakdown = {
    detectedNewLeads: 0,
    detectedSurveys: 0,
    detectedProposals: 0,
    detectedRevisits: 0,
    detectedPos: 0,
    detectedPaymentSum: 0,
    detectedDocsList: [],
    detectedAreas: [],
    detectedFocusItems: [],
  };

  // 1. Leads Analysis for Target Date
  leads.forEach((l) => {
    if (!l) return;

    // Check if lead was created on this date
    const createdDate = l.createdAt?.slice?.(0, 10) || l.date || "";
    if (createdDate === dateStr) {
      breakdown.detectedNewLeads += 1;
      if (l.section || l.area) {
        breakdown.detectedAreas.push(l.section || l.area);
      }
    }

    // Check site visit completion on this date
    if (l.siteVisitDate === dateStr && l.visitStatus === "Completed") {
      breakdown.detectedSurveys += 1;
      if (l.section || l.area) {
        breakdown.detectedAreas.push(l.section || l.area);
      }
    }

    // Proposals marked today
    if (
      l.proposalDate === dateStr ||
      (l.status === "Proposal Sent" && l.updatedAt?.slice?.(0, 10) === dateStr)
    ) {
      breakdown.detectedProposals += 1;
    }

    // Closures / POs closed today
    if (
      (l.status === "Closed" || l.status === "PO Received") &&
      (l.closedDate === dateStr || l.updatedAt?.slice?.(0, 10) === dateStr)
    ) {
      breakdown.detectedPos += 1;
    }

    // Documents collected
    if (l.documentsCollected && (l.siteVisitDate === dateStr || l.updatedAt?.slice?.(0, 10) === dateStr)) {
      breakdown.detectedDocsList.push(l.documentsCollected);
    } else if (l.ksebConsumerNo && l.siteVisitDate === dateStr) {
      breakdown.detectedDocsList.push("KSEB Consumer details");
    }

    // Advance or payments collected
    const payment = Number(l.advancePayment || l.paymentCollected || 0);
    if (payment > 0 && (l.paymentDate === dateStr || l.siteVisitDate === dateStr)) {
      breakdown.detectedPaymentSum += payment;
    }
  });

  // 2. Follow-ups & Appointments Analysis for Target Date
  followups.forEach((f) => {
    if (!f || f.date !== dateStr) return;

    if (f.status === "Completed") {
      const type = (f.type || "").toLowerCase();
      if (type.includes("survey") || type.includes("site visit")) {
        // Only count if not already counted via leads
        if (!leads.some((l) => l.id === f.leadId && l.siteVisitDate === dateStr && l.visitStatus === "Completed")) {
          breakdown.detectedSurveys += 1;
        }
      } else if (type.includes("revisit") || type.includes("re-visit")) {
        breakdown.detectedRevisits += 1;
      }

      if (f.area) {
        breakdown.detectedAreas.push(f.area);
      }

      if (f.notes && /kseb|bill|aadhaar|id proof|cheque|advance/i.test(f.notes)) {
        breakdown.detectedDocsList.push(f.notes);
      }
    }
  });

  // 3. Travel Expenses Routes
  expenses.forEach((e) => {
    if (e.date === dateStr && e.route) {
      breakdown.detectedAreas.push(e.route);
    }
  });

  // 4. Tomorrow's Scheduled Focus Items (Appointments planned for tomorrow)
  const tomorrowTasks = [];

  // From followups for tomorrow
  followups.forEach((f) => {
    if (f.date === tomorrowStr && f.status !== "Completed" && f.status !== "Cancelled") {
      const timeStr = f.time ? ` at ${f.time}` : "";
      tomorrowTasks.push(`${f.type || "Appointment"}: ${f.name}${f.area ? ` (${f.area})` : ""}${timeStr}`);
    }
  });

  // From leads scheduled for tomorrow
  leads.forEach((l) => {
    if (
      l.siteVisitDate === tomorrowStr &&
      l.visitStatus !== "Completed" &&
      l.status !== "Lost"
    ) {
      if (!tomorrowTasks.some((t) => t.includes(l.name))) {
        const timeStr = l.siteVisitTime ? ` at ${l.siteVisitTime}` : "";
        tomorrowTasks.push(`Site Survey: ${l.name}${l.section ? ` (${l.section})` : ""}${timeStr}`);
      }
    }
  });

  breakdown.detectedFocusItems = tomorrowTasks.slice(0, 3);

  // Construct Compiled Form Updates
  const compiled = { ...currentReport };

  // New Leads
  if (breakdown.detectedNewLeads > 0 || !compiled.newLeads) {
    compiled.newLeads = String(
      Math.max(parseCount(compiled.newLeads), breakdown.detectedNewLeads) || ""
    );
  }

  // Site Survey
  if (breakdown.detectedSurveys > 0 || !compiled.siteSurvey) {
    compiled.siteSurvey = String(
      Math.max(parseCount(compiled.siteSurvey), breakdown.detectedSurveys) || ""
    );
  }

  // Proposals
  if (breakdown.detectedProposals > 0 || !compiled.proposalSent) {
    compiled.proposalSent = String(
      Math.max(parseCount(compiled.proposalSent), breakdown.detectedProposals) || ""
    );
  }

  // Revisits
  if (breakdown.detectedRevisits > 0 || !compiled.revisits) {
    compiled.revisits = String(
      Math.max(parseCount(compiled.revisits), breakdown.detectedRevisits) || ""
    );
  }

  // PO Count & Closures
  if (breakdown.detectedPos > 0 || !compiled.poCount) {
    compiled.poCount = String(
      Math.max(parseCount(compiled.poCount), breakdown.detectedPos) || "0"
    );
  }
  compiled.closure = compiled.closure && compiled.closure !== "0"
    ? compiled.closure
    : compiled.poCount || "0";

  // Documents to Bank
  if (!compiled.docsBank) {
    compiled.docsBank = "0";
  }

  // B2B Visits
  if (!compiled.dealerVisits) {
    compiled.dealerVisits = "0";
  }

  // Payment Collected
  if (breakdown.detectedPaymentSum > 0) {
    compiled.paymentCollected = `₹${breakdown.detectedPaymentSum.toLocaleString("en-IN")}`;
  }

  // Area: Combine unique detected areas
  const uniqueAreas = Array.from(
    new Set(
      breakdown.detectedAreas
        .map((a) => a.trim())
        .filter((a) => a && a.length > 2)
    )
  );
  if (uniqueAreas.length > 0 && !compiled.area) {
    compiled.area = uniqueAreas.slice(0, 3).join(", ");
  }

  // Documents Collected
  if (breakdown.detectedDocsList.length > 0 && !compiled.documentsCollected) {
    compiled.documentsCollected = Array.from(new Set(breakdown.detectedDocsList))
      .slice(0, 3)
      .join(", ");
  }

  // Tomorrow's Focus
  if (breakdown.detectedFocusItems.length > 0) {
    if (breakdown.detectedFocusItems[0] && !compiled.focus1) {
      compiled.focus1 = breakdown.detectedFocusItems[0];
    }
    if (breakdown.detectedFocusItems[1] && !compiled.focus2) {
      compiled.focus2 = breakdown.detectedFocusItems[1];
    }
    if (breakdown.detectedFocusItems[2] && !compiled.focus3) {
      compiled.focus3 = breakdown.detectedFocusItems[2];
    }
  }

  // Activity Type auto-inference
  if (!compiled.activityType) {
    const activities = [];
    if (parseCount(compiled.siteSurvey) > 0) activities.push("Site survey");
    if (parseCount(compiled.revisits) > 0) activities.push("Customer revisit");
    if (parseCount(compiled.newLeads) > 0) activities.push("Lead generation");
    if (parseCount(compiled.poCount) > 0) activities.push("Deal closure");
    if (activities.length > 0) {
      compiled.activityType = activities.join(", ");
    }
  }

  return {
    compiledReport: compiled,
    breakdown,
  };
}
