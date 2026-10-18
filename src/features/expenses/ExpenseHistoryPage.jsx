import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CarFront,
  Search,
  Trash2,
  Utensils,
  Smartphone,
  ReceiptText,
  Route,
  RefreshCw,
  Download,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { useAuth } from "../auth/AuthProvider";
import { listRecords, deleteRecord } from "../../lib/data";

const TA_RATE = 3;

const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const money = (value) =>
  "₹" +
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const getAmount = (item) =>
  item.type === "TA"
    ? Number(item.km || 0) * TA_RATE
    : Number(item.amount || 0);

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

const formatDate = (dateString) =>
  new Date(`${dateString}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const categoryStyle = {
  TA: {
    icon: CarFront,
    color: "bg-[#d9f5ef] text-[#087d70]",
  },
  Food: {
    icon: Utensils,
    color: "bg-amber-50 text-amber-700",
  },
  "SIM / recharge": {
    icon: Smartphone,
    color: "bg-violet-50 text-violet-700",
  },
  Other: {
    icon: ReceiptText,
    color: "bg-blue-50 text-blue-700",
  },
};

export default function ExpenseHistoryPage() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("week");
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    if (!user?.uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const records = await listRecords(user.uid, "expenses");
      setItems(records || []);
    } catch (error) {
      console.error("Failed to load expenses:", error);
      setMessage("Could not load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const filteredItems = useMemo(() => {
    const today = localDate();
    const currentMonth = today.slice(0, 7);
    const selectedWeek = getWeekStart(selectedDate);
    const query = search.trim().toLowerCase();

    return items
      .filter((item) => {
        if (!item.date) return false;

        if (filter === "day" && item.date !== selectedDate) {
          return false;
        }

        if (
          filter === "week" &&
          getWeekStart(item.date) !== selectedWeek
        ) {
          return false;
        }

        if (
          filter === "month" &&
          !item.date.startsWith(currentMonth)
        ) {
          return false;
        }

        if (category !== "All" && item.type !== category) {
          return false;
        }

        if (query) {
          const searchable = [
            item.date,
            item.type,
            item.route,
            item.note,
            String(getAmount(item)),
            String(item.km || ""),
          ]
            .join(" ")
            .toLowerCase();

          if (!searchable.includes(query)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }

        return String(b.createdAt || "").localeCompare(
          String(a.createdAt || "")
        );
      });
  }, [items, filter, selectedDate, search, category]);

  const groupedItems = useMemo(
    () =>
      filteredItems.reduce((groups, item) => {
        if (!groups[item.date]) groups[item.date] = [];
        groups[item.date].push(item);
        return groups;
      }, {}),
    [filteredItems]
  );

  const totalAmount = filteredItems.reduce(
    (sum, item) => sum + getAmount(item),
    0
  );

  const totalKm = filteredItems.reduce(
    (sum, item) =>
      sum + (item.type === "TA" ? Number(item.km || 0) : 0),
    0
  );

  // PDF ജനറേറ്റ് ചെയ്യുന്ന ഫംഗ്ഷൻ (Sub-totals & Grand Total ഉൾപ്പെടെ)
  const downloadWeeklyReportPDF = () => {
    const weekStart = getWeekStart(selectedDate);
    const weekEnd = getWeekEnd(selectedDate);

    // ആ ആഴ്ചയിലെ മുഴുവൻ എൻട്രികളും ഫിൽട്ടർ ചെയ്യുന്നു
    const weeklyRecords = items
      .filter(
        (item) => item.date && getWeekStart(item.date) === weekStart
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const taRecords = weeklyRecords.filter((item) => item.type === "TA");
    const otherRecords = weeklyRecords.filter((item) => item.type !== "TA");

    // തുകകൾ കണക്കാക്കുന്നു
    const totalTaAmount = taRecords.reduce(
      (sum, item) => sum + Number(item.km || 0) * TA_RATE,
      0
    );
    const totalOtherAmount = otherRecords.reduce(
      (sum, item) => sum + Number(item.amount || 0),
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
    const contentWidth = pageWidth - margin * 2;

    // 1. Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("EXPENSE ALLOWANCE FORM", pageWidth / 2, 20, { align: "center" });

    // 2. Top Meta Information Box
    const boxY = 26;
    const boxHeight = 27;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, boxY, contentWidth, boxHeight);

    doc.line(margin, boxY + 9, margin + contentWidth, boxY + 9);
    doc.line(margin, boxY + 18, margin + contentWidth, boxY + 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    const staffName = user?.displayName || user?.email?.split("@")[0] || "";
    doc.text(`Name of Staff: ${staffName}`, margin + 3, boxY + 6.5);
    doc.text(`From Date: ${weekStart}`, margin + 3, boxY + 15.5);
    doc.text(`To Date: ${weekEnd}`, margin + contentWidth / 2, boxY + 15.5);
    doc.text(`Submit Date: ${localDate()}`, margin + 3, boxY + 24.5);

    // 3. Table 1: Travel Allowance
    const taRows = taRecords.map((item) => {
      let fromLoc = "-";
      let toLoc = "-";
      if (item.route) {
        const parts = item.route.split(" to ");
        if (parts.length === 2) {
          fromLoc = parts[0];
          toLoc = parts[1];
        } else {
          fromLoc = item.route;
        }
      }
      const km = Number(item.km || 0);
      const total = km * TA_RATE;
      return [
        item.date,
        fromLoc,
        toLoc,
        item.mode || "Two Wheeler",
        km.toString(),
        TA_RATE.toString(),
        total.toFixed(2),
      ];
    });

    // ടേബിൾ വലുപ്പത്തിനായി മിനിമം 4 വരികൾ എങ്കിലും നൽകുന്നു
    while (taRows.length < 4) {
      taRows.push(["", "", "", "", "", "", ""]);
    }

    autoTable(doc, {
      startY: boxY + boxHeight + 6,
      margin: { left: margin, right: margin },
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
          "From",
          "To",
          "Mode of Travel",
          "Distance (km)",
          "Rate per km",
          "Total",
        ],
      ],
      body: taRows,
      // TA ടോട്ടൽ തുക ഫൂട്ടർ വരിയായി ചേർക്കുന്നു
      foot: [
        [
          {
            content: "Total Travel Allowance:",
            colSpan: 6,
            styles: { halign: "right", fontStyle: "bold" },
          },
          {
            content: `Rs. ${totalTaAmount.toFixed(2)}`,
            styles: { halign: "right", fontStyle: "bold" },
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
        fontSize: 9,
        valign: "middle",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        3: { halign: "center" },
        4: { halign: "center", cellWidth: 24 },
        5: { halign: "center", cellWidth: 22 },
        6: { halign: "right", cellWidth: 24 },
      },
    });

    // 4. Table 2: Food & Other Expenses
    const otherRows = otherRecords.map((item) => [
      item.date,
      item.note || item.route || "-",
      item.type,
      Number(item.amount || 0).toFixed(2),
    ]);

    while (otherRows.length < 4) {
      otherRows.push(["", "", "", ""]);
    }

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      margin: { left: margin, right: margin },
      head: [
        [
          {
            content: "FOOD & OTHER EXPENSES",
            colSpan: 4,
            styles: {
              halign: "center",
              fillColor: [240, 240, 240],
              textColor: [0, 0, 0],
              fontStyle: "bold",
            },
          },
        ],
        ["Date", "Details / Description", "Category (Food/Other)", "Amount"],
      ],
      body: otherRows,
      // ഫുഡ് & മറ്റ് ചിലവുകളുടെ ടോട്ടൽ
      foot: [
        [
          {
            content: "Total Other Expenses:",
            colSpan: 3,
            styles: { halign: "right", fontStyle: "bold" },
          },
          {
            content: `Rs. ${totalOtherAmount.toFixed(2)}`,
            styles: { halign: "right", fontStyle: "bold" },
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
        fontSize: 9,
        valign: "middle",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 26 },
        2: { halign: "center", cellWidth: 42 },
        3: { halign: "right", cellWidth: 32 },
      },
    });

    // 5. Grand Total Summary Box
    let summaryY = doc.lastAutoTable.finalY + 5;
    doc.setDrawColor(0);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, summaryY, contentWidth, 8, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("GRAND TOTAL CLAIMED AMOUNT:", margin + 4, summaryY + 5.5);
    doc.text(
      `Rs. ${grandTotal.toFixed(2)}`,
      margin + contentWidth - 4,
      summaryY + 5.5,
      { align: "right" }
    );

    // 6. Signatures Section
    let signY = summaryY + 18;
    if (signY > 265) {
      doc.addPage();
      signY = 30;
    }

    doc.text("Employee Signature: ___________________", margin, signY);
    doc.text("Date: ___________________", margin, signY + 10);

    const rightCol = margin + contentWidth / 2 + 5;
    doc.text("Approved By: ___________________", rightCol, signY);
    doc.text("Date: ___________________", rightCol, signY + 10);

    doc.save(`Expense_Allowance_${weekStart}_to_${weekEnd}.pdf`);
  };

  async function removeEntry(id) {
    if (!user?.uid || !id) return;

    if (!window.confirm("Delete this expense entry permanently?")) {
      return;
    }

    setDeletingId(id);
    setMessage("");

    try {
      await deleteRecord(user.uid, "expenses", id);

      setItems((previous) =>
        previous.filter((item) => item.id !== id)
      );

      setMessage("Expense deleted successfully.");
    } catch (error) {
      console.error("Failed to delete expense:", error);
      setMessage("Could not delete this expense. Please try again.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-[10px] font-extrabold tracking-[2px] text-[#0d9b8b]">
            EXPENSE MANAGEMENT
          </div>

          <h1 className="mt-2 text-2xl font-extrabold text-[#19363e] sm:text-3xl">
            Expense log
          </h1>

          <p className="mt-2 text-sm text-[#82949a]">
            Search, filter and manage your field expenses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Weekly PDF Download Button */}
          <button
            type="button"
            onClick={downloadWeeklyReportPDF}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087d70] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#06655b]"
            title="Download Weekly Form PDF"
          >
            <Download size={16} />
            Download Weekly PDF
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe8e8] bg-white px-4 py-3 text-sm font-bold text-[#19363e] transition hover:border-[#12a594] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      {message && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#d8eee8] bg-[#edf8f5] px-4 py-3 text-sm text-[#087d70]"
        >
          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage("")}
            className="font-bold"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#d8eee8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#82949a]">
              Total expenses
            </span>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9f5ef] text-[#087d70]">
              <ReceiptText size={20} />
            </span>
          </div>

          <div className="mt-3 text-2xl font-extrabold text-[#087d70]">
            {money(totalAmount)}
          </div>

          <p className="mt-1 text-xs text-[#82949a]">
            {filteredItems.length} matching entries
          </p>
        </div>

        <div className="rounded-2xl border border-[#e3eaf0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#82949a]">
              Travel distance
            </span>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Route size={20} />
            </span>
          </div>

          <div className="mt-3 text-2xl font-extrabold text-[#19363e]">
            {totalKm.toLocaleString("en-IN")} km
          </div>

          <p className="mt-1 text-xs text-[#82949a]">
            TA rate: ₹{TA_RATE} per km
          </p>
        </div>

        <div className="rounded-2xl border border-[#e3eaf0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#82949a]">
              Days with expenses
            </span>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <CalendarDays size={20} />
            </span>
          </div>

          <div className="mt-3 text-2xl font-extrabold text-[#19363e]">
            {Object.keys(groupedItems).length}
          </div>

          <p className="mt-1 text-xs text-[#82949a]">
            In the selected period
          </p>
        </div>
      </div>

      {/* Filters and results */}
      <section className="overflow-hidden rounded-2xl border border-[#e2ebeb] bg-white shadow-sm">
        <div className="border-b border-[#eaf0ef] p-4 sm:p-6">
          {/* Date filters */}
          <div className="flex flex-wrap gap-2">
            {[
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Current month"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={[
                  "rounded-xl px-4 py-2.5 text-xs font-bold transition",
                  filter === value
                    ? "bg-[#102b32] text-white"
                    : "border border-[#e2ebeb] bg-white text-[#587078] hover:border-[#12a594]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {filter !== "month" && (
            <div className="mt-4 max-w-xs">
              <label className="mb-2 block text-xs font-bold text-[#526a70]">
                {filter === "day"
                  ? "Select date"
                  : "Select any date in the week"}
              </label>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(event.target.value)
                }
                className="w-full rounded-xl border border-[#dfe8e8] bg-white px-3 py-3 text-sm text-[#19363e] outline-none focus:border-[#12a594] focus:ring-2 focus:ring-[#12a594]/10"
              />

              {filter === "week" && (
                <p className="mt-2 text-xs text-[#82949a]">
                  {getWeekStart(selectedDate)} —{" "}
                  {getWeekEnd(selectedDate)}
                </p>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative mt-4">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a4a6]"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search route, note, category or amount..."
              className="w-full rounded-xl border border-[#dfe8e8] bg-[#fbfdfc] py-3 pl-10 pr-4 text-sm text-[#19363e] outline-none placeholder:text-[#9aabad] focus:border-[#12a594] focus:bg-white"
            />
          </div>

          {/* Category filters */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "All",
              "TA",
              "Food",
              "SIM / recharge",
              "Other",
            ].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={[
                  "rounded-full border px-3 py-2 text-[11px] font-bold transition",
                  category === value
                    ? "border-[#12a594] bg-[#d9f5ef] text-[#087d70]"
                    : "border-[#e2ebeb] bg-white text-[#70868a] hover:border-[#a8dcd1]",
                ].join(" ")}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Expense records */}
        <div className="p-3 sm:p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-[#82949a]">
              Loading expenses...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d9f5ef] text-[#087d70]">
                <ReceiptText size={25} />
              </div>

              <h3 className="mt-4 text-base font-extrabold text-[#19363e]">
                No expenses found
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-[#82949a]">
                Try another date or category, or clear the search to see
                more entries.
              </p>

              {(search || category !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategory("All");
                  }}
                  className="mt-4 rounded-xl bg-[#102b32] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#21464b]"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedItems)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, dateItems]) => {
                  const dayTotal = dateItems.reduce(
                    (sum, item) => sum + getAmount(item),
                    0
                  );

                  const dayKm = dateItems.reduce(
                    (sum, item) =>
                      sum +
                      (item.type === "TA"
                        ? Number(item.km || 0)
                        : 0),
                    0
                  );

                  return (
                    <div
                      key={date}
                      className="overflow-hidden rounded-2xl border border-[#e2ebeb]"
                    >
                      {/* Date summary */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f4f8f7] px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0d9b8b] shadow-sm">
                            <CalendarDays size={18} />
                          </div>

                          <div>
                            <h3 className="text-sm font-extrabold text-[#19363e]">
                              {formatDate(date)}
                            </h3>

                            <p className="mt-1 text-[11px] text-[#82949a]">
                              {dateItems.length} entries
                              {dayKm > 0 ? ` · ${dayKm} km` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#82949a]">
                            Daily total
                          </p>

                          <p className="mt-1 text-base font-extrabold text-[#087d70]">
                            {money(dayTotal)}
                          </p>
                        </div>
                      </div>

                      {/* Individual expenses */}
                      <div className="divide-y divide-[#edf1f0]">
                        {dateItems.map((item) => {
                          const style =
                            categoryStyle[item.type] ||
                            categoryStyle.Other;

                          const Icon = style.icon;

                          return (
                            <div
                              key={item.id}
                              className="group flex items-start gap-3 px-3 py-4 transition hover:bg-[#fbfdfc] sm:items-center sm:px-4"
                            >
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.color}`}
                              >
                                <Icon size={18} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="break-words text-sm font-bold text-[#19363e]">
                                    {item.route ||
                                      item.note ||
                                      item.type}
                                  </span>

                                  <span
                                    className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${style.color}`}
                                  >
                                    {item.type}
                                  </span>
                                </div>

                                {item.route && item.note && (
                                  <p className="mt-1 break-words text-xs text-[#82949a]">
                                    {item.note}
                                  </p>
                                )}

                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#82949a]">
                                  {item.type === "TA" && (
                                    <>
                                      <span>
                                        {Number(item.km || 0)} km
                                      </span>
                                      <span>₹{TA_RATE}/km</span>
                                    </>
                                  )}

                                  {!item.route && item.note && (
                                    <span>{item.note}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <span className="whitespace-nowrap text-sm font-extrabold text-[#087d70]">
                                  {money(getAmount(item))}
                                </span>

                                <button
                                  type="button"
                                  title="Delete expense"
                                  aria-label={`Delete ${item.type} expense`}
                                  disabled={deletingId === item.id}
                                  onClick={() => removeEntry(item.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94a6a7] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 sm:opacity-60 sm:group-hover:opacity-100"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Bottom total */}
        {!loading && filteredItems.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eaf0ef] bg-[#f4f8f7] px-4 py-4 sm:px-6">
            <div>
              <p className="text-sm font-bold text-[#19363e]">
                Total for selected period
              </p>

              <p className="mt-1 text-xs text-[#82949a]">
                {filteredItems.length} matching entries
              </p>
            </div>

            <p className="text-xl font-extrabold text-[#087d70]">
              {money(totalAmount)}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}