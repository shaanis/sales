import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const TA_RATE = 3;

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

export function downloadWeeklyReportPDF({
  items = [],
  selectedDate,
  user,
}) {
  if (!selectedDate) {
    console.error("Please select a date before downloading the PDF.");
    return;
  }

  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);

  // Get all expense records for the selected Monday-Sunday week.
  const weeklyRecords = items
    .filter(
      (item) =>
        item.date &&
        getWeekStart(item.date) === weekStart
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const taRecords = weeklyRecords.filter(
    (item) => item.type === "TA"
  );

  const otherRecords = weeklyRecords.filter(
    (item) => item.type !== "TA"
  );

  // Calculate totals.
  const totalTaAmount = taRecords.reduce(
    (sum, item) =>
      sum + Number(item.km || 0) * TA_RATE,
    0
  );

  const totalOtherAmount = otherRecords.reduce(
    (sum, item) =>
      sum + Number(item.amount || 0),
    0
  );

  const grandTotal = totalTaAmount + totalOtherAmount;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;

  // --------------------------------------------------
  // 1. Document title
  // --------------------------------------------------

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);

  doc.text(
    "ECHONIX TECHNOLOGY PVT LTD",
    pageWidth / 2,
    10,
    { align: "center" }
  );
  doc.text(
    "DAILY REPORT",
    pageWidth / 2,
    18,
    { align: "center" }
  );

  // --------------------------------------------------
  // 2. Staff details
  // --------------------------------------------------

  const boxY = 26;
  const boxHeight = 27;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);

  doc.rect(
    margin,
    boxY,
    contentWidth,
    boxHeight
  );

  doc.line(
    margin,
    boxY + 9,
    margin + contentWidth,
    boxY + 9
  );

  doc.line(
    margin,
    boxY + 18,
    margin + contentWidth,
    boxY + 18
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  const staffName =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "________________";

  doc.text(
    `Name : ${staffName}`,
    margin + 3,
    boxY + 6.5
  );

  doc.text(
    `From Date: ${weekStart}`,
    margin + 3,
    boxY + 15.5
  );

  doc.text(
    `To Date: ${weekEnd}`,
    margin + contentWidth / 2,
    boxY + 15.5
  );

  doc.text(
    `Submit Date: ${localDate()}`,
    margin + 3,
    boxY + 24.5
  );

  // --------------------------------------------------
  // 3. Travel allowance table
  // From is always House.
  // To is the destination from the route.
  // --------------------------------------------------

  const taRows = taRecords.map((item) => {
    const km = Number(item.km || 0);

    let destination = "-";

    if (item.route) {
      const routeParts = String(item.route).split(/\s+to\s+/i);

      destination =
        routeParts.length > 1
          ? routeParts.slice(1).join(" to ").trim() || "-"
          : String(item.route).trim() || "-";
    }

    return [
      item.date,
      "House",
      destination,
      item.mode || "Bike",
      String(km),
      String(TA_RATE),
      (km * TA_RATE).toFixed(2),
    ];
  });

  // Keep a minimum of four rows for printing.
  while (taRows.length < 4) {
    taRows.push(["", "", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: boxY + boxHeight + 6,

    margin: {
      left: margin,
      right: margin,
      bottom: 20,
    },

    head: [
      [
        {
          content: "TRAVEL ALLOWANCE",
          colSpan: 7,
          styles: {
            halign: "center",
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontStyle: "bold",
          },
        },
      ],
      [
        "Date",
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
          content: "SUBTOTAL:",
          colSpan: 6,
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
        {
          content: `Rs. ${totalTaAmount.toFixed(2)}`,
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
      ],
    ],

    theme: "grid",

    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      fontStyle: "bold",
      halign: "center",
    },

    footStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },

    bodyStyles: {
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 6.5,
    },

    styles: {
      font: "helvetica",
      fontSize: 8,
      valign: "middle",
      overflow: "linebreak",
      cellPadding: 2,
    },

    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 24, // Date
      },
      1: {
        halign: "left",
        cellWidth: 30, // Travel From - increased
      },
      2: {
        halign: "left",
        cellWidth: 40, // Travel To - increased
      },
      3: {
        halign: "center",
        cellWidth: 25, // Mode of Travel - reduced
      },
      4: {
        halign: "center",
        cellWidth: 18, // Distance (KM) - reduced
      },
      5: {
        halign: "center",
        cellWidth: 17, // Per KM Rate - reduced
      },
      6: {
        halign: "right",
        cellWidth: 28, // Amount
      },
    },
  });

  // --------------------------------------------------
  // 4. Food and other expenses table
  // Category column removed.
  // Show description, or category when description is empty.
  // --------------------------------------------------

  const otherRows = otherRecords.map((item) => {
    const description = String(item.note || "").trim();
    const route = String(item.route || "").trim();
    const type = String(item.type || "Other").trim();

    const details = description || route || type;

    return [
      item.date,
      details,
      Number(item.amount || 0).toFixed(2),
    ];
  });

  while (otherRows.length < 4) {
    otherRows.push(["", "", ""]);
  }

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,

    margin: {
      left: margin,
      right: margin,
      bottom: 20,
    },

    head: [
      [
        {
          content: "EXPENSES",
          colSpan: 3,
          styles: {
            halign: "center",
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontStyle: "bold",
          },
        },
      ],
      [
        "DATE",
        "DESCRIPTION ",
        "AMOUNT",
      ],
    ],

    body: otherRows,

    foot: [
      [
        {
          content: "SUBTOTAL:",
          colSpan: 2,
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
        {
          content: `Rs. ${totalOtherAmount.toFixed(2)}`,
          styles: {
            halign: "right",
            fontStyle: "bold",
          },
        },
      ],
    ],

    theme: "grid",

    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      fontStyle: "bold",
      halign: "center",
    },

    footStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },

    bodyStyles: {
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 6.5,
    },

    styles: {
      font: "helvetica",
      fontSize: 9,
      valign: "middle",
      overflow: "linebreak",
      cellPadding: 2,
    },

    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 28,
      },
      1: {
        cellWidth: "auto",
      },
      2: {
        halign: "right",
        cellWidth: 32,
      },
    },
  });

  // --------------------------------------------------
  // 5. Grand total summary
  // --------------------------------------------------

  let summaryY = doc.lastAutoTable.finalY + 5;

  // Move summary to a new page if necessary.
  if (summaryY + 8 > pageHeight - 25) {
    doc.addPage();
    summaryY = 25;
  }

  doc.setDrawColor(0);
  doc.setFillColor(240, 240, 240);

  doc.rect(
    margin,
    summaryY,
    contentWidth,
    8,
    "FD"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  doc.text(
    "GRAND TOTAL AMOUNT:",
    margin + 4,
    summaryY + 5.5
  );

  doc.text(
    `Rs. ${grandTotal.toFixed(2)}`,
    margin + contentWidth - 4,
    summaryY + 5.5,
    { align: "right" }
  );

  // --------------------------------------------------
  // 6. Employee and approval signatures
  // --------------------------------------------------
  let signY = summaryY + 18;

  if (signY + 22 > pageHeight - 10) {
    doc.addPage();
    signY = 30;
  }
  
  doc.setFontSize(9);
  
  const col1 = margin;
  const col2 = margin + contentWidth / 3;
  const col3 = margin + (contentWidth * 2) / 3;
  
  // All three headings in the same row
  doc.text("VERIFIED BY", col1, signY);
  doc.text("APPROVED BY", col2, signY);
  doc.text("SETTLEMENT REMARKS", col3, signY);
  
  // Date labels below the first two headings
  doc.text("Date:", col1, signY + 10);
  doc.text("Date:", col2, signY + 10);

  // --------------------------------------------------
  // 7. Download PDF
  // --------------------------------------------------

  doc.save(
    `Expense_Allowance_${weekStart}_to_${weekEnd}.pdf`
  );
}