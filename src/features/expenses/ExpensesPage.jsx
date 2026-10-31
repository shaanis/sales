import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
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

  // Create a snapshot that will be used by BOTH preview and submission.
  function createSubmissionSnapshot(expenses) {
    const expenseSnapshot = expenses.map((item) => ({
      ...item,
    }));

    const dates = expenseSnapshot
      .map((item) => item.date)
      .filter(Boolean)
      .sort();

    const now = new Date().toISOString();

    return {
      submitted: true,
      submittedAt: now,

      expenses: expenseSnapshot,

      expenseIds: expenseSnapshot.map((item) =>
        String(item.id)
      ),

      submittedAmount: expenseSnapshot.reduce(
        (sum, item) => sum + getAmount(item),
        0
      ),

      expenseCount: expenseSnapshot.length,

      periodStart: dates.length ? dates[0] : null,
      periodEnd: dates.length ? dates[dates.length - 1] : null,

      createdAt: now,
      updatedAt: now,
    };
  }

  // Preview the actual PDF using the same PDF generator as Download.
  function handlePreviewPDF() {
    if (!user?.uid) {
      setNote("Please log in first.");
      return;
    }

    if (pendingExpenses.length === 0) {
      setNote("There are no new expenses to preview.");
      return;
    }

    const snapshot = createSubmissionSnapshot(pendingExpenses);

    // Save the exact snapshot currently being previewed.
    setPreviewedSubmission(snapshot);

    setNote("");

    previewSubmissionPDF({
      submission: snapshot,
      user,
    });
  }

  // Submit the exact snapshot that was previewed.
  async function markOfficeSubmitted() {
    if (!user?.uid) {
      setNote("Please log in first.");
      return;
    }

    if (!previewedSubmission?.expenses?.length) {
      setNote("Please preview the PDF before submitting.");
      return;
    }

    const snapshot = previewedSubmission;

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
    <div className="space-y-6">

      <header className="page-header">
        <div>
          <div className="eyebrow">FIELD ACTIVITY</div>
          <h1>Travel &amp; expenses</h1>
          <p>
            Add travel and expense entries. TA is calculated at ₹3 per km.
          </p>
        </div>
      </header>

      {note && (
        <div className="notice" role="status">
          {note}
        </div>
      )}

      {/* Add expense form */}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Add an entry</h2>
            <p>Save one trip or expense at a time.</p>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">

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
                onChange={(event) =>
                  updateForm("type", event.target.value)
                }
              >
                <option value="TA">TA</option>
                <option value="Food">Food</option>
                <option value="SIM / recharge">SIM / recharge</option>
                <option value="Other">Other</option>
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
                  placeholder="e.g. 33"
                  required
                />
              </Field>
            )}

            <Field
              label={
                form.type === "TA"
                  ? "Calculated TA (₹)"
                  : "Amount (₹)"
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
              />

              {form.type === "TA" && (
                <small className="hint">
                  {form.km || 0} km × ₹{TA_RATE} ={" "}
                  {money(calculatedAmount)}
                </small>
              )}
            </Field>

            <Field label="Route / places visited" className="span-2">
              <Input
                value={form.route}
                onChange={(value) => updateForm("route", value)}
                placeholder="Valanchery → Edappal"
                required={form.type === "TA"}
              />
            </Field>

            <Field label="Notes" className="span-2">
              <Input
                value={form.note}
                onChange={(value) => updateForm("note", value)}
                placeholder="Additional details"
              />
            </Field>

          </div>

          <button
            className="btn primary"
            disabled={busy}
            type="submit"
          >
            <Plus size={16} />
            {busy ? "Saving..." : "Save entry"}
          </button>
        </form>
      </section>

      {/* Pending expenses */}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Pending submission
            </div>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Office expense submission
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Only expenses that have not been submitted previously are included.
            </p>

            {pendingExpenses.length > 0 && (
              <p className="mt-2 text-sm font-medium text-slate-500">
                {formatDate(pendingStartDate)} –{" "}
                {formatDate(pendingEndDate)}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 sm:min-w-44">
            <div className="text-sm text-slate-500">
              Pending amount
            </div>

            <div className="mt-1 text-2xl font-bold text-slate-900">
              {money(pendingTotal)}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {pendingExpenses.length} unsubmitted entries
            </div>
          </div>

        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Note (optional)
            </span>

            <textarea
              value={submissionNote}
              onChange={(event) =>
                setSubmissionNote(event.target.value)
              }
              rows={2}
              placeholder="e.g. Submitted during office meeting"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="flex flex-col gap-2">

            {pendingExpenses.length === 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} />
                All expenses submitted
              </div>
            )}

            {/* Preview PDF button */}

            <button
              type="button"
              onClick={handlePreviewPDF}
              disabled={
                submissionBusy || pendingExpenses.length === 0
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eye size={16} />
              Preview PDF
            </button>

            {/* Submit button */}

            <button
              type="button"
              onClick={markOfficeSubmitted}
              disabled={
                submissionBusy ||
                !previewedSubmission?.expenses?.length
              }
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submissionBusy
                ? "Saving..."
                : "Submit previewed expenses"}
            </button>

          </div>
        </div>

        {previewedSubmission?.expenses?.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />

            <div>
              <div className="font-semibold">
                PDF preview prepared
              </div>

              <p className="mt-1">
                {previewedSubmission.expenseCount} entries
                {" · "}
                {money(previewedSubmission.submittedAmount)}
                {" · "}
                Submit will save this exact previewed snapshot.
              </p>
            </div>
          </div>
        )}

        {pendingExpenses.length > 0 &&
          !previewedSubmission && (
            <p className="mt-3 text-xs text-slate-500">
              Preview the PDF first. The Submit button will become available after previewing.
            </p>
          )}

      </section>

      {/* Submission history */}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">

        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-slate-500" />

          <h2 className="text-lg font-bold text-slate-900">
            Submission History
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-600">
          Each submission has its own saved expense snapshot and PDF.
        </p>

        {sortedSubmissions.length === 0 ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            No submission history available.
          </div>
        ) : (
          <div className="mt-4 space-y-3">

            {sortedSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >

                <div>
                  <div className="font-semibold text-slate-900">
                    Submission - {formatDate(
                      submission.submittedAt
                        ? submission.submittedAt.slice(0, 10)
                        : submission.periodStart
                    )}
                  </div>

                  <div className="mt-1 text-sm text-slate-500">
                    {submission.expenseCount ??
                      submission.expenses?.length ??
                      submission.expenseIds?.length ??
                      0} entries

                    {" · "}

                    {submission.periodStart
                      ? `${formatDate(submission.periodStart)} – ${formatDate(submission.periodEnd)}`
                      : "Date range unavailable"}

                    {submission.note
                      ? ` · ${submission.note}`
                      : ""}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {submission.submittedAt
                      ? `Submitted at ${new Date(
                          submission.submittedAt
                        ).toLocaleString("en-IN")}`
                      : "Submission date not recorded"}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">

                  <div className="text-lg font-bold text-slate-900">
                    {money(submission.submittedAmount)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(submission)}
                    disabled={!submission.expenses?.length}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download size={16} />
                    Download PDF
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
