
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const TA_RATE = 3;
const MARGIN = 12;

const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getWeekStart = (dateString) => {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();

  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));

  return localDate(date);
};

const getWeekEnd = (dateString) => {
  const date = new Date(`${getWeekStart(dateString)}T12:00:00`);
  date.setDate(date.getDate() + 6);

  return localDate(date);
};

const formatDate = (dateString) => {
  if (!dateString) return "";

  const parts = String(dateString).split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : dateString;
};

const money = (value) => Number(value || 0).toFixed(2);

const getOrigin = (route) => {
  if (!route) return "House";

  const parts = String(route).trim().split(/\s+to\s+/i);

  return parts.length > 1 ? parts[0].trim() : "House";
};

const getDestination = (route) => {
  if (!route) return "";

  const parts = String(route).trim().split(/\s+to\s+/i);

  return parts.length > 1
    ? parts.slice(1).join(" to ").trim()
    : String(route).trim();
};

export function downloadWeeklyReportPDF({
  items = [],
  selectedDate,
  user,
}) {
  if (!selectedDate) {
    console.error("Please select a date before downloading.");
    return;
  }

  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);

  const weeklyRecords = items
    .filter(
      (item) =>
        item.date &&
        item.date >= weekStart &&
        item.date <= weekEnd
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const taRecords = weeklyRecords.filter(
    (item) => item.type === "TA"
  );

  const otherRecords = weeklyRecords.filter(
    (item) => item.type !== "TA"
  );

  const totalTA = taRecords.reduce(
    (sum, item) => sum + Number(item.km || 0) * TA_RATE,
    0
  );

  const totalOther = otherRecords.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const grandTotal = totalTA + totalOther;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  const black = [0, 0, 0];
  const headerGray = [245, 245, 245];

  doc.setTextColor(...black);
  doc.setDrawColor(...black);
  doc.setLineWidth(0.25);

  // ==================================================
  // 1. COMPANY HEADING
  // ==================================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);

  doc.text(
    "ECHONIX TECHNOLOGY PVT LTD",
    pageWidth / 2,
    12,
    { align: "center" }
  );

  doc.setFontSize(9);

  doc.text(
    "DAILY REPORT",
    pageWidth / 2,
    17,
    { align: "center" }
  );

  // ==================================================
  // 2. STAFF DETAILS
  // ==================================================

  const staffName =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text(`NAME: ${staffName}`, MARGIN, 25);

  doc.text(
    `FROM DATE: ${formatDate(weekStart)}`,
    MARGIN,
    31
  );

  doc.text(
    `TO DATE: ${formatDate(weekEnd)}`,
    pageWidth / 2 - 5,
    31
  );

  doc.text(
    `SUBMITTED DATE: ${formatDate(localDate())}`,
    pageWidth - MARGIN,
    25,
    { align: "right" }
  );

  // ==================================================
  // 3. FULL-WIDTH TRAVEL ALLOWANCE TABLE
  // ==================================================

  const taRows = taRecords.map((item) => {
    const km = Number(item.km || 0);

    return [
      formatDate(item.date),
      getOrigin(item.route),
      getDestination(item.route),
      item.mode || "Bike",
      String(km),
      String(TA_RATE),
      money(km * TA_RATE),
    ];
  });

  // Blank rows for handwritten entries.
  while (taRows.length < 7) {
    taRows.push(["", "", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: 35,

    margin: {
      left: MARGIN,
      right: MARGIN,
      bottom: 10,
    },

    tableWidth: contentWidth,

    head: [
      [
        {
          content: "TRAVEL ALLOWANCE",
          colSpan: 7,
          styles: {
            halign: "center",
            fontStyle: "bold",
            fillColor: headerGray,
          },
        },
      ],
      [
        "DATE",
        "TRAVEL FROM",
        "TRAVEL TO",
        "MODE OF TRAVEL",
        "DISTANCE (KM)",
        "PER KM RATE",
        "AMOUNT",
      ],
    ],

    body: taRows,

    foot: [
      [
        {
          content: "SUB TOTAL",
          colSpan: 6,
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
        {
          content: money(totalTA),
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
      ],
    ],

    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 7,
      textColor: black,
      lineColor: black,
      lineWidth: 0.25,
      cellPadding: 1.3,
      minCellHeight: 6,
      valign: "middle",
      overflow: "linebreak",
    },

    headStyles: {
      fillColor: headerGray,
      textColor: black,
      lineColor: black,
      lineWidth: 0.25,
      halign: "center",
      valign: "middle",
      fontStyle: "bold",
    },

    footStyles: {
      fillColor: [255, 255, 255],
      textColor: black,
      lineColor: black,
      lineWidth: 0.25,
    },

    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: 32 },
      2: { cellWidth: 35 },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 22, halign: "center" },
      6: { cellWidth: 28, halign: "right" },
    },

    rowPageBreak: "avoid",
  });

  // ==================================================
  // 4. TWO EXPENSE SECTIONS IN ONE ALIGNED TABLE
  // ==================================================

  // Using one table guarantees that the horizontal
  // borders of both expense sections align exactly.

  const splitIndex = Math.ceil(otherRecords.length / 2);

  const leftRecords = otherRecords.slice(0, splitIndex);
  const rightRecords = otherRecords.slice(splitIndex);

  const rowCount = Math.max(
    7,
    leftRecords.length,
    rightRecords.length
  );

  const expenseRows = [];

  for (let i = 0; i < rowCount; i++) {
    const left = leftRecords[i];
    const right = rightRecords[i];

    const leftDescription = left
      ? String(left.note || "").trim() ||
        String(left.route || "").trim() ||
        String(left.type || "Other")
      : "";

    const rightDescription = right
      ? String(right.note || "").trim() ||
        String(right.route || "").trim() ||
        String(right.type || "Other")
      : "";

    expenseRows.push([
      left ? formatDate(left.date) : "",
      leftDescription,
      left ? money(left.amount) : "",
      right ? formatDate(right.date) : "",
      rightDescription,
      right ? money(right.amount) : "",
    ]);
  }

  const leftTotal = leftRecords.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const rightTotal = rightRecords.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,

    margin: {
      left: MARGIN,
      right: MARGIN,
      bottom: 10,
    },

    tableWidth: contentWidth,

    head: [
      [
        {
          content: "EXPENSES",
          colSpan: 3,
          styles: {
            halign: "center",
            fillColor: headerGray,
            fontStyle: "bold",
          },
        },
        {
          content: "EXPENSES",
          colSpan: 3,
          styles: {
            halign: "center",
            fillColor: headerGray,
            fontStyle: "bold",
          },
        },
      ],
      [
        "DATE",
        "DESCRIPTION",
        "AMOUNT",
        "DATE",
        "DESCRIPTION",
        "AMOUNT",
      ],
    ],

    body: expenseRows,

    foot: [
      [
        {
          content: "SUBTOTAL",
          colSpan: 2,
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
        {
          content: money(leftTotal),
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
        {
          content: "SUBTOTAL",
          colSpan: 2,
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
        {
          content: money(rightTotal),
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
      ],
    ],

    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 7,
      textColor: black,
      lineColor: black,
      lineWidth: 0.25,
      cellPadding: 1.3,
      minCellHeight: 6,
      valign: "middle",
      overflow: "linebreak",
    },

    headStyles: {
      fillColor: headerGray,
      textColor: black,
      lineColor: black,
      lineWidth: 0.25,
      halign: "center",
      valign: "middle",
      fontStyle: "bold",
    },

    footStyles: {
      fillColor: [255, 255, 255],
      textColor: black,
      lineColor: black,
      lineWidth: 0.25,
    },

    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: 40 },
      2: { cellWidth: 33, halign: "right" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 40 },
      5: { cellWidth: 33, halign: "right" },
    },

    rowPageBreak: "avoid",
  });

  // ==================================================
  // 5. FULL-WIDTH TOTAL ROW
  // ==================================================

  let totalY = doc.lastAutoTable.finalY + 2;

  const totalHeight = 8;
  const officeHeight = 31;

  // Keep the total and approval section together.
  if (totalY + totalHeight + officeHeight > pageHeight - 7) {
    doc.addPage();
    totalY = 15;
  }

  doc.setLineWidth(0.3);

  doc.rect(
    MARGIN,
    totalY,
    contentWidth,
    totalHeight
  );

  // Match the right-side total cell in the reference.
  const amountCellWidth = 27;
  const labelStart = pageWidth - MARGIN - 65;

  doc.line(
    labelStart,
    totalY,
    labelStart,
    totalY + totalHeight
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  doc.text(
    "TOTAL",
    labelStart - 3,
    totalY + 5.2,
    { align: "right" }
  );

  doc.text(
    money(grandTotal),
    pageWidth - MARGIN - 3,
    totalY + 5.2,
    { align: "right" }
  );

  // ==================================================
  // 6. OFFICE VERIFICATION / APPROVAL SECTION
  // ==================================================

  const officeY = totalY + 14;

  const col1 = MARGIN;
  const col2 = MARGIN + contentWidth * 0.34;
  const col3 = MARGIN + contentWidth * 0.64;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);

  doc.text("FOR OFFICE USE", col1, officeY);

  doc.setFont("helvetica", "normal");

  doc.text("VERIFIED BY", col1, officeY + 6);
  doc.text("APPROVED BY", col2, officeY + 6);
  doc.text("SETTLEMENT REMARKS", col3, officeY + 6);

  doc.setFontSize(8);

  doc.text("DATE: __________________", col1, officeY + 19);
  doc.text("DATE: __________________", col2, officeY + 19);

  // ==================================================
  // 7. DOWNLOAD
  // ==================================================

  doc.save(
    `Expense_Allowance_${weekStart}_to_${weekEnd}.pdf`
  );
}
