
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
  FileText,
  CheckCircle2,
  Clock3,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import { listRecords, deleteRecord } from "../../lib/data";
import { downloadSubmissionPDF } from "./expensePdf";

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

const formatDate = (dateString) => {
  if (!dateString) return "—";

  return new Date(`${dateString}T12:00:00`).toLocaleDateString(
    "en-IN",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
};

const getSubmissionDate = (submission) => {
  const value = submission.submittedAt || submission.createdAt;

  if (!value) return "—";

  try {
    const date = value?.toDate
      ? value.toDate()
      : new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const getSubmissionTime = (submission) => {
  const value = submission.submittedAt || submission.createdAt;

  if (!value) return "";

  try {
    const date = value?.toDate
      ? value.toDate()
      : new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

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
  const [submissions, setSubmissions] = useState([]);

  const [filter, setFilter] = useState("week");
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [message, setMessage] = useState("");

  // Load expenses and submission history
  async function refresh() {
    if (!user?.uid) {
      setItems([]);
      setSubmissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [expenseRecords, submissionRecords] = await Promise.all([
        listRecords(user.uid, "expenses"),
        listRecords(user.uid, "officeSubmissions"),
      ]);

      setItems(expenseRecords || []);
      setSubmissions(submissionRecords || []);
    } catch (error) {
      console.error("Failed to load expense history:", error);
      setMessage("Could not load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Collect all expense IDs already included in submissions
  const submittedExpenseIds = useMemo(() => {
    const ids = new Set();

    submissions.forEach((submission) => {
      // New submission format
      if (Array.isArray(submission.expenseIds)) {
        submission.expenseIds.forEach((id) => {
          if (id) ids.add(id);
        });
      }

      // Snapshot format
      if (Array.isArray(submission.expenses)) {
        submission.expenses.forEach((expense) => {
          if (expense?.id) {
            ids.add(expense.id);
          }
        });
      }
    });

    return ids;
  }, [submissions]);

  const isSubmitted = (item) =>
    Boolean(item.id && submittedExpenseIds.has(item.id));

  const pendingItems = useMemo(
    () => items.filter((item) => !isSubmitted(item)),
    [items, submittedExpenseIds]
  );

  const submittedItems = useMemo(
    () => items.filter((item) => isSubmitted(item)),
    [items, submittedExpenseIds]
  );

  // Apply date, category and search filters
  const filteredItems = useMemo(() => {
    const today = localDate();
    const currentMonth = today.slice(0, 7);
    const selectedWeek = getWeekStart(selectedDate);
    const searchText = search.trim().toLowerCase();

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

        if (searchText) {
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

          if (!searchable.includes(searchText)) {
            return false;
          }
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
        if (!groups[item.date]) {
          groups[item.date] = [];
        }

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

  const pendingAmount = pendingItems.reduce(
    (sum, item) => sum + getAmount(item),
    0
  );

  const submittedAmount = submittedItems.reduce(
    (sum, item) => sum + getAmount(item),
    0
  );

  // Delete expense
  async function removeEntry(id) {
    if (!user?.uid || !id) return;

    if (
      !window.confirm(
        "Delete this expense entry permanently?"
      )
    ) {
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
      setMessage(
        "Could not delete this expense. Please try again."
      );
    } finally {
      setDeletingId("");
    }
  }

  // Download one particular submission PDF
  async function handleDownloadPDF(submission) {
    if (!submission) return;

    if (
      !Array.isArray(submission.expenses) ||
      submission.expenses.length === 0
    ) {
      setMessage(
        "This submission does not contain a saved expense snapshot. Its PDF cannot be generated."
      );
      return;
    }

    setDownloadingId(submission.id);
    setMessage("");

    try {
      await downloadSubmissionPDF({
        submission,
        user,
      });
    } catch (error) {
      console.error("PDF download failed:", error);
      setMessage("Could not generate the PDF. Please try again.");
    } finally {
      setDownloadingId("");
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

        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#82949a]">
              Not submitted
            </span>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Clock3 size={20} />
            </span>
          </div>

          <div className="mt-3 text-2xl font-extrabold text-amber-700">
            {money(pendingAmount)}
          </div>

          <p className="mt-1 text-xs text-[#82949a]">
            {pendingItems.length} pending entries
          </p>
        </div>

        <div className="rounded-2xl border border-[#e3eaf0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#82949a]">
              Submitted
            </span>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9f5ef] text-[#087d70]">
              <CheckCircle2 size={20} />
            </span>
          </div>

          <div className="mt-3 text-2xl font-extrabold text-[#19363e]">
            {money(submittedAmount)}
          </div>

          <p className="mt-1 text-xs text-[#82949a]">
            {submittedItems.length} submitted entries
          </p>
        </div>
      </div>

      {/* Submission history */}
      <section className="overflow-hidden rounded-2xl border border-[#e2ebeb] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaf0ef] p-4 sm:p-5">
          <div>
            <h2 className="text-base font-extrabold text-[#19363e]">
              Submission history
            </h2>

            <p className="mt-1 text-xs text-[#82949a]">
              Each submission has its own saved expense snapshot and PDF.
            </p>
          </div>

          <span className="rounded-full bg-[#d9f5ef] px-3 py-1.5 text-xs font-bold text-[#087d70]">
            {submissions.length} submissions
          </span>
        </div>

        <div className="divide-y divide-[#edf1f0]">
          {loading ? (
            <div className="py-10 text-center text-sm text-[#82949a]">
              Loading submission history...
            </div>
          ) : submissions.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileText
                size={30}
                className="mx-auto text-[#a6b7b8]"
              />

              <p className="mt-3 text-sm font-bold text-[#19363e]">
                No submissions yet
              </p>

              <p className="mt-1 text-xs text-[#82949a]">
                Your submitted expense reports will appear here.
              </p>
            </div>
          ) : (
            [...submissions]
              .sort((a, b) => {
                const dateA = a.submittedAt?.toDate
                  ? a.submittedAt.toDate().getTime()
                  : new Date(a.submittedAt || a.createdAt || 0).getTime();

                const dateB = b.submittedAt?.toDate
                  ? b.submittedAt.toDate().getTime()
                  : new Date(b.submittedAt || b.createdAt || 0).getTime();

                return dateB - dateA;
              })
              .map((submission, index) => {
                const snapshot = Array.isArray(submission.expenses)
                  ? submission.expenses
                  : [];

                const snapshotAmount =
                  submission.submittedAmount ??
                  snapshot.reduce(
                    (sum, item) => sum + getAmount(item),
                    0
                  );

                return (
                  <div
                    key={submission.id || index}
                    className="flex flex-col justify-between gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d9f5ef] text-[#087d70]">
                        <FileText size={20} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-extrabold text-[#19363e]">
                            Expense submission #{index + 1}
                          </h3>

                          <span className="rounded-full bg-[#d9f5ef] px-2 py-1 text-[9px] font-extrabold text-[#087d70]">
                            SUBMITTED
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-[#82949a]">
                          Submitted on {getSubmissionDate(submission)}
                          {getSubmissionTime(submission)
                            ? ` · ${getSubmissionTime(submission)}`
                            : ""}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#70868a]">
                          <span>
                            {submission.expenseCount ??
                              snapshot.length}{" "}
                            expenses
                          </span>

                          <span className="font-bold text-[#087d70]">
                            {money(snapshotAmount)}
                          </span>
                        </div>

                        {submission.note && (
                          <p className="mt-2 break-words text-xs text-[#82949a]">
                            {submission.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadPDF(submission)}
                      disabled={
                        downloadingId === submission.id ||
                        snapshot.length === 0
                      }
                      title={
                        snapshot.length === 0
                          ? "No saved expense snapshot available"
                          : "Download this submission PDF"
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#087d70] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#06655b] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Download size={15} />

                      {downloadingId === submission.id
                        ? "Generating..."
                        : "Download PDF"}
                    </button>
                  </div>
                );
              })
          )}
        </div>
      </section>

      {/* Filters and expense records */}
      <section className="overflow-hidden rounded-2xl border border-[#e2ebeb] bg-white shadow-sm">
        <div className="border-b border-[#eaf0ef] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#19363e]">
                All expenses
              </h2>

              <p className="mt-1 text-xs text-[#82949a]">
                View submitted and pending expense entries.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">
                {pendingItems.length} pending
              </span>

              <span className="rounded-full bg-[#d9f5ef] px-3 py-1.5 text-[10px] font-bold text-[#087d70]">
                {submittedItems.length} submitted
              </span>
            </div>
          </div>

          {/* Date filters */}
          <div className="mt-4 flex flex-wrap gap-2">
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
                          const submitted = isSubmitted(item);

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

                                  <span
                                    className={
                                      submitted
                                        ? "rounded-full bg-[#d9f5ef] px-2 py-1 text-[9px] font-extrabold text-[#087d70]"
                                        : "rounded-full bg-amber-50 px-2 py-1 text-[9px] font-extrabold text-amber-700"
                                    }
                                  >
                                    {submitted
                                      ? "SUBMITTED"
                                      : "NOT SUBMITTED"}
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

                                      <span>
                                        ₹{TA_RATE}/km
                                      </span>
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
