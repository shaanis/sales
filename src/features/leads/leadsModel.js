/**
 * Lead Management Data Models, Statuses & Parsers
 * For ECHONIX Field Sales Lead Management System
 */

export const LEAD_STAGES = [
  {
    id: "New",
    label: "New Lead",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    desc: "Fresh lead received, yet to be contacted",
  },
  {
    id: "Contacted",
    label: "Call Done / In Talk",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    desc: "Call completed, discussing requirements",
  },
  {
    id: "Visit_Scheduled",
    label: "Site Visit Fixed",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    desc: "Customer provided date & time for site visit",
  },
  {
    id: "Visited",
    label: "Site Survey Done",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    dot: "bg-teal-500",
    desc: "Site visit and roof inspection completed",
  },
  {
    id: "Proposal",
    label: "Proposal Sent",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    desc: "Solar quotation & pricing provided",
  },
  {
    id: "Won",
    label: "Closed / Won",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    desc: "PO confirmed, advance token received",
  },
  {
    id: "Lost",
    label: "Lost / Dropped",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    desc: "Not interested, price constraint or dropped",
  },
];

export const CALL_STATUSES = [
  {
    id: "Pending",
    label: "Call Pending",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    icon: "Clock",
  },
  {
    id: "Connected",
    label: "Connected / Spoke",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: "PhoneCall",
  },
  {
    id: "Ringing",
    label: "Ringing / No Answer",
    badge: "bg-orange-100 text-orange-800 border-orange-300",
    icon: "PhoneForwarded",
  },
  {
    id: "Callback",
    label: "Callback Requested",
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    icon: "PhoneIncoming",
  },
  {
    id: "SwitchedOff",
    label: "Switched Off / Unreachable",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    icon: "PhoneOff",
  },
  {
    id: "Invalid",
    label: "Invalid Number",
    badge: "bg-rose-100 text-rose-800 border-rose-300",
    icon: "PhoneMissed",
  },
];

export const VISIT_STATUSES = [
  { id: "Not_Fixed", label: "Visit Not Fixed" },
  { id: "Scheduled", label: "Site Visit Scheduled" },
  { id: "Completed", label: "Site Survey Completed" },
  { id: "Rescheduled", label: "Rescheduled" },
  { id: "Cancelled", label: "Cancelled" },
];

export const LEAD_SOURCES = [
  "WhatsApp",
  "FB LEAD",
  "KSEB",
  "YOUTUBE",
  "REFERRAL",
  "WEBSITE",
  "OTHERS",
];

export const COMMON_SECTIONS = [
  "VALANCHERI",
  "EDAYOOR",
  "PUTHENATHANI",
  "CHANGARAMKULAM",
  "PONNANI",
  "AYINGALAM",
  "PATTAMBI",
  "EDAPPAL",
  "THAVANUR",
  "NADUVATTOM",
  "MARAVATTAM",
  "PUTHANPALLI",
  "MARANCHERI",
  "THIRUVEGAPPURA",
  "PALAKKAD",
  "KADAMPUZHA",
  "KUTTAYI",
  "KOTHAPARAMB",
  "BEERANCIRA",
  "KODAKKAL",
  "VETTICHIRA",
  "RANDATHANI",
  "TIRUR",
  "KOTTAKKAL",
  "MALAPPURAM",
];

export const QUICK_UPDATE_SNIPPETS = [
  "📞 Called customer: Inquired about solar setup, requested evening callback.",
  "⚡ Customer shared KSEB electricity bill for load calculation.",
  "📅 Customer gave site visit time: Fixed for this week.",
  "🏡 Site visit completed: Good unshaded rooftop, suitable for 5kW On-Grid.",
  "📑 5 kW On-Grid Solar quotation shared via WhatsApp.",
  "💰 Discussing price and MNRE subsidy details.",
  "⏳ Customer requested 2-3 days time to discuss with family.",
  "✅ Customer agreed, token advance and PO pending collection.",
  "❌ Not interested: High initial budget / rented house.",
];

export const blankLead = (user) => ({
  name: "",
  phone: "",
  section: "",
  source: "WhatsApp",
  status: "New",
  callStatus: "Pending",
  firstCallDate: "",
  lastCallDate: "",
  callNotes: "",
  visitStatus: "Not_Fixed",
  siteVisitDate: "",
  siteVisitTime: "",
  siteVisitAddress: "",
  siteVisitNotes: "",
  currentUpdate: "New lead received from company",
  requirement: "5 kW Solar On-Grid",
  assignedTo: user?.displayName || "Ashraf",
  generatedMonth: new Date().toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  }),
  updates: [
    {
      id: "init",
      text: "Lead recorded in system",
      date: new Date().toISOString(),
      by: user?.displayName || "Sales rep",
    },
  ],
});

/**
 * Intelligent parser for WhatsApp lead messages & Excel/Spreadsheet copy-pastes
 */
export function parseLeadsText(
  text,
  defaultSource = "WhatsApp",
  defaultAssign = "Ashraf"
) {
  if (!text || typeof text !== "string") return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = [];

  for (const rawLine of lines) {
    // Skip table header lines
    if (
      /source\s+status\s+name/i.test(rawLine) ||
      /^name\s+phone/i.test(rawLine) ||
      /^#\s+name/i.test(rawLine)
    ) {
      continue;
    }

    // TSV check (Tab-separated values copied from Excel / Google Sheets)
    if (rawLine.includes("\t")) {
      const cols = rawLine.split("\t").map((c) => c.trim());
      if (cols.length >= 3) {
        let sourceVal = defaultSource;
        let statusVal = "New";
        let nameVal = "";
        let sectionVal = "";
        let phoneVal = "";
        let assignVal = defaultAssign;
        let firstCallVal = "";

        // Detect if matches Excel layout: SOURCE | STATUS | NAME | SECTION | Contact details | generated | Assign | First Call
        if (
          cols.length >= 5 &&
          (cols[0].toUpperCase().includes("KSEB") ||
            cols[0].toUpperCase().includes("FB") ||
            cols[0].toUpperCase().includes("YOUTU") ||
            cols[0].toUpperCase().includes("OTHER") ||
            cols[1].toUpperCase().includes("INTREST"))
        ) {
          sourceVal = cols[0] || defaultSource;
          const rawStatus = cols[1] || "";
          statusVal = rawStatus.toUpperCase().includes("INTREST")
            ? "Contacted"
            : "New";
          nameVal = cols[2] || "";
          sectionVal = cols[3] || "";
          phoneVal = (cols[4] || "").replace(/\D/g, "");
          assignVal = cols[6] || defaultAssign;
          firstCallVal = cols[7] || "";
        } else {
          // Generic column finder
          const pIndex = cols.findIndex((c) =>
            /\b\d{10}\b/.test(c.replace(/\s+/g, ""))
          );
          if (pIndex !== -1) {
            phoneVal = cols[pIndex].replace(/\D/g, "");
            nameVal = cols[0] || "";
            sectionVal = cols[1] || "";
          } else {
            nameVal = cols[0] || "";
            sectionVal = cols[1] || "";
            phoneVal = (cols[2] || "").replace(/\D/g, "");
          }
        }

        if (phoneVal.length > 10) phoneVal = phoneVal.slice(-10);

        if (nameVal || phoneVal) {
          parsed.push({
            id: "temp_" + Math.random().toString(36).slice(2, 9),
            name: nameVal.toUpperCase().trim(),
            phone: phoneVal,
            section: sectionVal.toUpperCase().trim(),
            source: sourceVal,
            assignedTo: assignVal,
            status: statusVal,
            callStatus: firstCallVal ? "Connected" : "Pending",
            firstCallDate: firstCallVal,
            lastCallDate: firstCallVal,
            visitStatus: "Not_Fixed",
            siteVisitDate: "",
            siteVisitTime: "",
            currentUpdate: firstCallVal
              ? `First call completed on ${firstCallVal}`
              : "Imported from Sheet",
            requirement: "5 kW Solar On-Grid",
            generatedMonth: new Date().toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            }),
          });
          continue;
        }
      }
    }

    // Format like WhatsApp: "MIBIN BEERANCIRA 9847397698 10:23 am"
    // 1. Strip time signature (e.g., 10:23 am, 10:23 AM, [10:23 am])
    let line = rawLine
      .replace(/\[?\d{1,2}:\d{2}\s*(am|pm)?\]?/gi, "")
      .trim();
    // Strip date stamps if any: e.g. 30/09/2026
    line = line.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, "").trim();

    // 2. Extract phone number (Indian 10-digit or +91 prefix)
    const phoneMatch = line.match(/(?:\+?91[\s-]?)?([6-9]\d{9})\b/);
    let phoneVal = "";
    let remaining = line;

    if (phoneMatch) {
      phoneVal = phoneMatch[1];
      remaining = line.replace(phoneMatch[0], " ").trim();
    } else {
      const any10 = line.match(/\b\d{10}\b/);
      if (any10) {
        phoneVal = any10[0];
        remaining = line.replace(any10[0], " ").trim();
      }
    }

    // 3. Clean labels like "Name:", "Mob:", "Area:", "Section:"
    remaining = remaining
      .replace(/^(name|mob|phone|area|section|place)\s*[:=-]\s*/gi, "")
      .trim();

    // 4. Split name and section
    let nameVal = "";
    let sectionVal = "";

    // If separated by 2+ spaces (common in formatted WhatsApp lines)
    const multiSpaceParts = remaining
      .split(/\s{2,}|\s*[-–,|]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (multiSpaceParts.length >= 2) {
      nameVal = multiSpaceParts[0];
      sectionVal = multiSpaceParts.slice(1).join(", ");
    } else {
      // Space separated words: e.g. "MIBIN BEERANCIRA"
      const words = remaining.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        // Last word is section/place
        nameVal = words.slice(0, words.length - 1).join(" ");
        sectionVal = words[words.length - 1];
      } else if (words.length === 1) {
        nameVal = words[0];
        sectionVal = "";
      }
    }

    if (nameVal || phoneVal) {
      parsed.push({
        id: "temp_" + Math.random().toString(36).slice(2, 9),
        name: nameVal.toUpperCase().trim(),
        phone: phoneVal,
        section: sectionVal.toUpperCase().trim(),
        source: defaultSource,
        assignedTo: defaultAssign,
        status: "New",
        callStatus: "Pending",
        firstCallDate: "",
        lastCallDate: "",
        visitStatus: "Not_Fixed",
        siteVisitDate: "",
        siteVisitTime: "",
        currentUpdate: "New lead from WhatsApp",
        requirement: "5 kW Solar On-Grid",
        generatedMonth: new Date().toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
      });
    }
  }

  return parsed;
}

/**
 * Generate a professional customer WhatsApp intro message
 */
export function generateLeadWhatsAppUrl(lead, executiveName = "") {
  if (!lead || !lead.phone) return "";

  const phone = lead.phone.replace(/\D/g, "");
  const formattedPhone = phone.length === 10 ? `91${phone}` : phone;

  const rep = executiveName || "ECHONIX Solar";
  const name = lead.name ? `${lead.name} Sir` : "Sir/Madam";
  const place = lead.section ? ` at ${lead.section}` : "";

  const message = `Hello ${name},
Greetings from *ECHONIX Solar*! ☀️
This is ${rep}. 

We received your inquiry regarding Solar Rooftop system installation${place}. 

I tried connecting with you over phone. Could you please share a convenient time to speak or send your latest KSEB electricity bill for a free rooftop solar calculation?

Thank you!
*ECHONIX Solar Solutions*`;

  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(
    message
  )}`;
}
