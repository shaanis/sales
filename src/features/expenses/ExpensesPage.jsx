import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  CarFront,
  Sparkles,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
} from "../../lib/data";
import { Field, Input } from "../../components/Field";

import {
  downloadSubmissionPDF,
  previewSubmissionPDF,
} from "../expenses/expensePdf";

const TA_RATE = 3;

const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const freshEntry = () => ({
  date: localDate(),
  type: "TA",
  km: "",
  route: "",
  amount: "",
  note: "",
});

const money = (value) =>
  "₹" +
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const getAmount = (item) =>
  item.type === "TA"
    ? Number(item.km || 0) * TA_RATE
    : Number(item.amount || 0);

const formatDate = (dateString) =>
  dateString
    ? new Date(`${dateString}T12:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

export default function ExpensesPage() {
  const { user } = useAuth();

  const [form, setForm] = useState(freshEntry);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState([]);
  const [officeSubmissions, setOfficeSubmissions] = useState([]);

  const [submissionNote, setSubmissionNote] = useState("");
  const [submissionBusy, setSubmissionBusy] = useState(false);

  // Stores the exact expense snapshot shown in PDF preview.
  const [previewedSubmission, setPreviewedSubmission] = useState(null);

  async function refresh() {
    if (!user?.uid) {
      setItems([]);
      setOfficeSubmissions([]);
      return;
    }

    try {
      const [expenses, submissions] = await Promise.all([
        listRecords(user.uid, "expenses"),
        listRecords(user.uid, "officeSubmissions"),
      ]);

      setItems(expenses || []);
      setOfficeSubmissions(submissions || []);
    } catch (error) {
      console.error("Could not load expense data:", error);
      setNote("Could not load entries. Please check your connection.");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  function updateForm(key, value) {
    setForm((previous) => {
      const next = { ...previous, [key]: value };

      if (next.type === "TA") {
        next.amount = String(Number(next.km || 0) * TA_RATE);
      }

      if (key === "type" && value !== "TA") {
        next.amount = "";
        next.km = "";
      }

      return next;
    });
  }

  const calculatedAmount =
    form.type === "TA"
      ? Number(form.km || 0) * TA_RATE
      : Number(form.amount || 0);

  async function submit(event) {
    event.preventDefault();

    if (!user?.uid) {
      setNote("Please log in before saving an entry.");
      return;
    }

    const km = Number(form.km || 0);
    const amount =
      form.type === "TA" ? km * TA_RATE : Number(form.amount || 0);

    if (form.type === "TA" && km <= 0) {
      setNote("Please enter a distance greater than 0 km.");
      return;
    }

    if (form.type !== "TA" && amount <= 0) {
      setNote("Please enter an amount greater than ₹0.");
      return;
    }

    setBusy(true);
    setNote("");

    try {
      await addRecord(user.uid, "expenses", {
        ...form,
        km: form.type === "TA" ? km : 0,
        amount,
        createdAt: new Date().toISOString(),
      });

      setForm(freshEntry());
      await refresh();

      setNote("Expense entry saved successfully.");
    } catch (error) {
      console.error("Expense save failed:", error);
      setNote(`Save failed: ${error.code || error.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Collect every expense ID already included in an earlier submission.
  const submittedExpenseIds = useMemo(() => {
    const ids = new Set();

    officeSubmissions.forEach((submission) => {
      (submission.expenseIds || []).forEach((id) => {
        ids.add(String(id));
      });

      (submission.expenses || []).forEach((expense) => {
        if (expense.id) {
          ids.add(String(expense.id));
        }
      });
    });

    return ids;
  }, [officeSubmissions]);

  // Only expenses not included in previous submissions.
  const pendingExpenses = useMemo(() => {
    return items
      .filter(
        (item) =>
          item.id &&
          !submittedExpenseIds.has(String(item.id))
      )
      .sort((a, b) =>
        String(a.date || "").localeCompare(String(b.date || ""))
      );
  }, [items, submittedExpenseIds]);

  const pendingTotal = pendingExpenses.reduce(
    (sum, item) => sum + getAmount(item),
    0
  );

  const pendingStartDate = pendingExpenses.length
    ? pendingExpenses[0].date
    : null;

  const pendingEndDate = pendingExpenses.length
    ? pendingExpenses[pendingExpenses.length - 1].date
    : null;

  const sortedSubmissions = useMemo(
    () =>
      [...officeSubmissions].sort((a, b) =>
        String(b.submittedAt || "").localeCompare(
          String(a.submittedAt || "")
        )
      ),
    [officeSubmissions]
  );

  // Preview the PDF from the current pending expenses.
  function handlePreviewPDF() {
    if (!pendingExpenses.length) {
      setNote("No pending expenses are available to preview.");
      return;
    }

    const expensesForPDF = pendingExpenses.map((expense) => ({
      ...expense,
      amount: getAmount(expense),
    }));

    const previewData = {
      periodStart: pendingStartDate,
      periodEnd: pendingEndDate,
      submittedAmount: pendingTotal,
      expenseCount: expensesForPDF.length,
      note: submissionNote.trim(),
      expenses: expensesForPDF,
    };

    setPreviewedSubmission(previewData);

    previewSubmissionPDF({
      submission: previewData,
      user,
    });
  }

  // Save the submission record.
  async function markOfficeSubmitted() {
    if (!user?.uid) {
      setNote("Please log in to submit expenses.");
      return;
    }

    const snapshot = previewedSubmission;

    if (!snapshot || !snapshot.expenses?.length) {
      setNote(
        "Please preview the PDF before submitting to freeze the exact expense list."
      );
      return;
    }

    const confirmMessage =
      `Submit ${snapshot.expenseCount} previewed expense entries ` +
      `amounting to ${money(snapshot.submittedAmount)} to the office?`;

    if (!window.confirm(confirmMessage)) return;

    setSubmissionBusy(true);
    setNote("");

    try {
      const now = new Date().toISOString();

      const submissionData = {
        ...snapshot,
        ownerUid: user.uid,
        note: submissionNote.trim(),
        updatedAt: now,
      };

      await addRecord(
        user.uid,
        "officeSubmissions",
        submissionData
      );

      setSubmissionNote("");
      setPreviewedSubmission(null);

      await refresh();

      setNote(
        "Submission saved successfully. The previewed expenses have been moved to submission history."
      );
    } catch (error) {
      console.error("Submission save failed:", error);

      setNote(
        `Could not save submission: ${error.code || error.message}`
      );
    } finally {
      setSubmissionBusy(false);
    }
  }

  // Download PDF from the saved historical snapshot.
  function handleDownloadPDF(submission) {
    if (!submission.expenses?.length) {
      setNote(
        "This is an older submission without an expense snapshot. Its original PDF cannot be recreated from the saved submission data."
      );
      return;
    }

    downloadSubmissionPDF({
      submission,
      user,
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <header className="pb-2 border-b border-slate-200/60 lg:border-none">
        <div className="text-[10px] font-black uppercase tracking-widest text-teal-700">
          FIELD ACTIVITY
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
          Travel &amp; Expenses
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Log daily travel routes and food bills. TA is calculated at ₹3 per km.
        </p>
      </header>

      {note && (
        <div className="notice" role="status">
          {note}
        </div>
      )}

      {/* Add expense form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Add New Entry
          </h2>
          <p className="text-xs text-slate-500">Record a travel trip or expense voucher.</p>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(value) => updateForm("date", value)}
                required
              />
            </Field>

            <Field label="Category">
              <select
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                <option value="TA">TA (Travel Allowance ₹3/km)</option>
                <option value="Food">Food / Refreshment</option>
                <option value="SIM / recharge">Mobile / SIM Recharge</option>
                <option value="Other">Other Miscellaneous</option>
              </select>
            </Field>

            {form.type === "TA" && (
              <Field label="Distance (km)">
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={form.km}
                  onChange={(value) => updateForm("km", value)}
                  placeholder="e.g. 35"
                  required
                />
              </Field>
            )}

            <Field
              label={
                form.type === "TA"
                  ? "Calculated TA Amount (₹)"
                  : "Amount (₹)"
              }
              hint={
                form.type === "TA" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md mt-1">
                    <Sparkles size={11} /> {form.km || 0} km × ₹{TA_RATE} = {money(calculatedAmount)}
                  </span>
                ) : null
              }
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.type === "TA"
                    ? calculatedAmount
                    : form.amount
                }
                onChange={(value) => updateForm("amount", value)}
                placeholder="0"
                readOnly={form.type === "TA"}
                required={form.type !== "TA"}
                className={
                  form.type === "TA"
                    ? "bg-teal-50/50 font-bold text-teal-950 border-teal-200"
                    : ""
                }
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Route / Places Visited">
                <Input
                  value={form.route}
                  onChange={(value) => updateForm("route", value)}
                  placeholder="e.g. Valanchery ➔ Edappal ➔ Kuttippuram"
                  required={form.type === "TA"}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Notes (Optional)">
                <Input
                  value={form.note}
                  onChange={(value) => updateForm("note", value)}
                  placeholder="e.g. Site survey visit for customer Rahman"
                />
              </Field>
            </div>
          </div>

          <div className="pt-2">
            <button
              className="w-full sm:w-auto py-3 px-6 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              <Plus size={16} />
              <span>{busy ? "Saving..." : "Save Expense Entry"}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Pending Office Submission Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              PENDING SUBMISSION
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
              Office Expense Claim
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate weekly PDF voucher for all unsubmitted travel &amp; food expenses.
            </p>

            {pendingExpenses.length > 0 && (
              <p className="mt-1.5 text-xs font-semibold text-teal-700 bg-teal-50 inline-block px-2 py-0.5 rounded-lg">
                📅 {formatDate(pendingStartDate)} – {formatDate(pendingEndDate)}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 sm:min-w-44 shrink-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Pending Total
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {money(pendingTotal)}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
              {pendingExpenses.length} unsubmitted entries
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-xs font-bold text-slate-700 mb-1">
              Submission Remarks (Optional)
            </span>
            <textarea
              value={submissionNote}
              onChange={(event) => setSubmissionNote(event.target.value)}
              rows={2}
              placeholder="e.g. Weekly claims for review during office meeting"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>

          {pendingExpenses.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 border border-emerald-200">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>All expense entries have been submitted to office.</span>
            </div>
          )}

          {/* Action buttons (full width on mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handlePreviewPDF}
              disabled={submissionBusy || pendingExpenses.length === 0}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition active:scale-98 disabled:opacity-40"
            >
              <Eye size={16} />
              <span>Preview PDF Claim</span>
            </button>

            <button
              type="button"
              onClick={markOfficeSubmitted}
              disabled={submissionBusy || !previewedSubmission?.expenses?.length}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-40"
            >
              <span>{submissionBusy ? "Submitting..." : "Submit to Office"}</span>
            </button>
          </div>
        </div>

        {previewedSubmission?.expenses?.length > 0 && (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <strong className="block font-bold">PDF Snapshot Ready</strong>
              <p className="mt-0.5 text-emerald-800">
                {previewedSubmission.expenseCount} entries · {money(previewedSubmission.submittedAmount)}. Tap "Submit to Office" to freeze this claim.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Submission History Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={18} className="text-slate-500" />
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Submission History
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Previously submitted claims and their downloadable PDF vouchers.
        </p>

        {sortedSubmissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            No past office submissions recorded yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    Submission on {formatDate(
                      submission.submittedAt
                        ? submission.submittedAt.slice(0, 10)
                        : submission.periodStart
                    )}
                  </div>

                  <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                    {submission.expenseCount ?? submission.expenses?.length ?? 0} entries · {submission.periodStart ? `${formatDate(submission.periodStart)} – ${formatDate(submission.periodEnd)}` : "Date range unavailable"}
                    {submission.note ? ` · ${submission.note}` : ""}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-slate-200/60 sm:border-none">
                  <strong className="text-sm sm:text-base font-black text-slate-900">
                    {money(submission.submittedAmount)}
                  </strong>

                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(submission)}
                    disabled={!submission.expenses?.length}
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                  >
                    <Download size={14} />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
