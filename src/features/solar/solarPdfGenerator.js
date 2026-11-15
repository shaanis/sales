import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateSolarMetrics } from "./solarCalculatorModel";

export function generateSolarQuotationPdf({
  customerName = "Customer",
  phone = "",
  location = "",
  ksebConsumerNo = "",
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
  customCost = null,
  isResidential = true,
  executiveName = "Shanis",
  executivePhone = "",
}) {
  const finalCost = totalPrice ? Number(totalPrice) : customCost;
  const metrics = calculateSolarMetrics({
    systemKw,
    customCost: finalCost,
    isResidential,
  });

  const money = (n) => `INR ${Number(n || 0).toLocaleString("en-IN")}`;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const todayStr = new Date().toLocaleDateString("en-GB");
  const quoteRef = `ECH-SOL-${new Date().getFullYear()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  // Header banner background
  doc.setFillColor(16, 43, 50); // #102b32
  doc.rect(0, 0, pageWidth, 42, "F");

  // Accent line
  doc.setFillColor(18, 165, 148); // #12a594
  doc.rect(0, 42, pageWidth, 2.5, "F");

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("ECHONIX", 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(182, 203, 205);
  doc.text(`SOLAR POWER SOLUTIONS | Branch: ${branch.toUpperCase()}`, 14, 26);
  doc.text("Kerala, India | Clean Green Energy Systems | https://echonix.in", 14, 31);

  // Proposal Reference on right
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(81, 216, 198); // #51d8c6
  doc.text("SOLAR BOOKING & SPECIFICATION", pageWidth - 14, 18, { align: "right" });

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`Ref: ${quoteRef}`, pageWidth - 14, 25, { align: "right" });
  doc.text(`Date: ${todayStr}`, pageWidth - 14, 30, { align: "right" });

  let cursorY = 52;

  // Customer & Site Information Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, cursorY, pageWidth - 28, 28, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("CLIENT & SITE DETAILS", 20, cursorY + 7);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  doc.text(`Customer Name:`, 20, cursorY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${customerName || "N/A"}`, 52, cursorY + 14);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Contact / Phone:`, 20, cursorY + 21);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${phone || "Provided on File"}`, 52, cursorY + 21);

  // Right column of client box
  const midX = pageWidth / 2 + 10;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Site Location:`, midX, cursorY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${location || "Kerala"}`, midX + 32, cursorY + 14);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Branch Office:`, midX, cursorY + 21);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${branch}`, midX + 32, cursorY + 21);

  cursorY += 34;

  // System Technical Overview Table
  const optStr = withOptimizer ? "with Optimizer" : "Standard Grid-tied";
  autoTable(doc, {
    startY: cursorY,
    head: [["TECHNICAL SPECIFICATION", "CONFIGURATION & HARDWARE"]],
    body: [
      ["Proposed System Capacity", `${metrics.systemKw} KW ${systemType} (${optStr})`],
      ["Solar PV Panels", `${panelWattage} x ${panelCount} Nos (${panelBrand})`],
      ["Solar Inverter", `${inverterKw || metrics.systemKw} KW ${inverterBrand || "Solar Inverter"}`],
      ["Mounting Structure", structure],
      ["Roof Type", roofType],
      ["Estimated Daily Generation", `~${metrics.dailyGenerationUnits} Units (kWh) / day`],
      ["Estimated Monthly Generation", `~${metrics.monthlyGenerationUnits} Units (kWh) / month`],
      ["Grid Synchronization", "KSEB Bi-directional Net Meter with Solar Generation Meter"],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [16, 43, 50],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 70 },
      1: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = doc.lastAutoTable.finalY + 7;

  // Financial Investment Breakdown Table
  const ksebLabel = withKsebCharge ? " (With KSEB Charges Included)" : "";
  autoTable(doc, {
    startY: cursorY,
    head: [["COMMERCIAL & PAYMENT DETAILS", "AMOUNT / TERMS"]],
    body: [
      [
        `Total Turnkey Project Price${ksebLabel}\n(Panels, Inverter, Structure, Installation, Testing & KSEB Liasoning)`,
        money(metrics.cost),
      ],
      [
        "Payment Scheme / Terms",
        paymentType || "Direct / Bank Loan",
      ],
      [
        "Direct PM Surya Ghar Muft Bijli Yojana Central Subsidy\n(Disbursed directly into customer's bank account upon meter installation)",
        `- ${money(metrics.subsidy)}`,
      ],
      [
        "NET CUSTOMER EFFECTIVE INVESTMENT",
        money(metrics.netInvestment),
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [18, 165, 148], // #12a594
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9.5,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 125 },
      1: { halign: "right", fontStyle: "bold", cellWidth: "auto" },
    },
    rowPageBreak: "avoid",
    didParseCell: (data) => {
      if (data.row.index === 3) {
        data.cell.styles.fillColor = [224, 242, 254];
        data.cell.styles.textColor = [12, 74, 96];
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = doc.lastAutoTable.finalY + 6;

  // Financial Return / ROI Highlights (3 boxes side by side)
  const boxWidth = (pageWidth - 28 - 8) / 3;
  const boxHeight = 22;

  // Box 1: Monthly Savings
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(204, 251, 241);
  doc.roundedRect(14, cursorY, boxWidth, boxHeight, 2, 2, "FD");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 118, 110);
  doc.text("EST. MONTHLY SAVINGS", 14 + boxWidth / 2, cursorY + 7, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 148, 136);
  doc.text(`~${money(metrics.monthlySavings)}`, 14 + boxWidth / 2, cursorY + 15, { align: "center" });

  // Box 2: Payback Period
  const box2X = 14 + boxWidth + 4;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(box2X, cursorY, boxWidth, boxHeight, 2, 2, "FD");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(161, 98, 7);
  doc.text("EST. PAYBACK PERIOD", box2X + boxWidth / 2, cursorY + 7, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 83, 9);
  doc.text(`${metrics.paybackYears} Years`, box2X + boxWidth / 2, cursorY + 15, { align: "center" });

  // Box 3: 25-Year Net Benefit
  const box3X = box2X + boxWidth + 4;
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  doc.roundedRect(box3X, cursorY, boxWidth, boxHeight, 2, 2, "FD");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(3, 105, 161);
  doc.text("25-YEAR NET PROFIT", box3X + boxWidth / 2, cursorY + 7, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(2, 132, 199);
  doc.text(`~${money(metrics.lifetimeNetProfit)}`, box3X + boxWidth / 2, cursorY + 15, { align: "center" });

  cursorY += boxHeight + 6;

  // Warranties & Terms Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, cursorY, pageWidth - 28, 26, 2, 2, "D");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("WARRANTY & ECHONIX ASSURANCE", 18, cursorY + 6);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text("[x] 25 Years Linear Performance Warranty on Solar PV Modules (Tier-1 Quality)", 18, cursorY + 11);
  doc.text("[x] 5 to 8 Years Standard Manufacturer Warranty on Solar Grid-Tied Inverter", 18, cursorY + 15);
  doc.text("[x] 5 Years Free Comprehensive Maintenance & On-Call System Health Support", 18, cursorY + 19);
  doc.text("[x] Full liasoning for KSEB approvals, Feasibility Certificate & Subsidy release", 18, cursorY + 23);

  cursorY += 32;

  // Signatures / Contact footer
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Prepared by Sales Executive:", 18, cursorY);
  doc.text("Customer Acceptance:", pageWidth - 65, cursorY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`${executiveName || "Shanis"} (ECHONIX Solar)`, 18, cursorY + 5);
  if (executivePhone) doc.text(`Ph: ${executivePhone}`, 18, cursorY + 9);

  doc.text("Signature: _______________________", pageWidth - 65, cursorY + 8);

  // Bottom note
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "*Official ECHONIX booking specification. Valid for site shadow analysis & KSEB transformer capacity.",
    14,
    288
  );

  const cleanName = (customerName || "Customer").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `ECHONIX_Booking_${cleanName}_${metrics.systemKw}kW.pdf`;

  return {
    doc,
    fileName,
    save: () => doc.save(fileName),
  };
}
