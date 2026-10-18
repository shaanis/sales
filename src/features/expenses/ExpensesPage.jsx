
import React, { useEffect, useMemo, useState } from "react";
import { Plus, CalendarDays, ReceiptText, CheckCircle2 } from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
  updateRecord,
} from "../../lib/data";
import { Field, Input } from "../../components/Field";

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

export default function ExpensesPage() {
  const { user } = useAuth();

  const [form, setForm] = useState(freshEntry);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState([]);
  const [officeSubmissions, setOfficeSubmissions] = useState([]);
  const [submissionNote, setSubmissionNote] = useState("");
  const [submissionBusy, setSubmissionBusy] = useState(false);

  const currentWeekStart = getWeekStart(localDate());
  const currentWeekEnd = getWeekEnd(localDate());

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

      const savedSubmission = (submissions || []).find(
        (item) =>
          item.periodStart === currentWeekStart &&
          item.periodEnd === currentWeekEnd
      );

      setSubmissionNote(savedSubmission?.note || "");
    } catch (error) {
      console.error("Could not load expense data:", error);
      setNote("Could not load entries. Please check your connection.");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const calculatedAmount =
    form.type === "TA"
      ? Number(form.km || 0) * TA_RATE
      : Number(form.amount || 0);

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

  const currentWeekExpenses = useMemo(
    () =>
      items.filter(
        (item) =>
          item.date >= currentWeekStart &&
          item.date <= currentWeekEnd
      ),
    [items, currentWeekStart, currentWeekEnd]
  );

  const currentWeekTotal = currentWeekExpenses.reduce(
    (sum, item) => sum + getAmount(item),
    0
  );

  const currentSubmission = officeSubmissions.find(
    (item) =>
      item.periodStart === currentWeekStart &&
      item.periodEnd === currentWeekEnd
  );

  const sortedSubmissions = [...officeSubmissions].sort((a, b) =>
    String(b.periodStart || "").localeCompare(
      String(a.periodStart || "")
    )
  );

  async function markOfficeSubmitted() {
    if (!user?.uid) {
      setNote("Please log in first.");
      return;
    }

    if (currentWeekExpenses.length === 0) {
      setNote("There are no expenses for the current week.");
      return;
    }

    const confirmMessage = currentSubmission
      ? "Update this week's office submission record?"
      : `Mark ${money(currentWeekTotal)} as submitted to the office?`;

    if (!window.confirm(confirmMessage)) return;

    setSubmissionBusy(true);
    setNote("");

    try {
      const now = new Date().toISOString();

      const submissionData = {
        ownerUid: user.uid,
        periodStart: currentWeekStart,
        periodEnd: currentWeekEnd,
        submittedAmount: currentWeekTotal,
        submitted: true,
        submittedAt: currentSubmission?.submittedAt || now,
        note: submissionNote.trim(),
        updatedAt: now,
      };

      if (currentSubmission?.id) {
        await updateRecord(
          user.uid,
          "officeSubmissions",
          currentSubmission.id,
          submissionData
        );
      } else {
        await addRecord(
          user.uid,
          "officeSubmissions",
          submissionData
        );
      }

      await refresh();
      setNote("Office submission record saved successfully.");
    } catch (error) {
      console.error("Submission save failed:", error);
      setNote(
        `Could not save submission: ${error.code || error.message}`
      );
    } finally {
      setSubmissionBusy(false);
    }
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

      {/* Current week's office submission */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Weekly meeting
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Office expense submission
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Record that this week's expenses were submitted to the
              office. This does not track approval or payment.
            </p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {formatDate(currentWeekStart)} –{" "}
              {formatDate(currentWeekEnd)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 sm:min-w-44">
            <div className="text-sm text-slate-500">
              This week's expenses
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {money(currentWeekTotal)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {currentWeekExpenses.length} entries · Mon–Sun
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
              onChange={(event) => setSubmissionNote(event.target.value)}
              rows={2}
              placeholder="e.g. Submitted during Monday weekly meeting"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="flex flex-col gap-2">
            {currentSubmission?.submitted && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} />
                Submitted
                {currentSubmission.submittedAt
                  ? ` on ${new Date(
                      currentSubmission.submittedAt
                    ).toLocaleDateString("en-IN")}`
                  : ""}
              </div>
            )}

            <button
              type="button"
              onClick={markOfficeSubmitted}
              disabled={
                submissionBusy || currentWeekExpenses.length === 0
              }
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submissionBusy
                ? "Saving..."
                : currentSubmission
                ? "Update submission record"
                : "Mark as submitted to office"}
            </button>
          </div>
        </div>
      </section>

      {/* Previous office submissions */}
      {sortedSubmissions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-slate-500" />
            <h2 className="text-lg font-bold text-slate-900">
              Previous office submissions
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Weekly amounts you marked as submitted.
          </p>

          <div className="mt-4 space-y-3">
            {sortedSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {submission.periodStart} – {submission.periodEnd}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {submission.submittedAt
                      ? `Submitted ${new Date(
                          submission.submittedAt
                        ).toLocaleDateString("en-IN")}`
                      : "Submission date not recorded"}
                    {submission.note ? ` · ${submission.note}` : ""}
                  </div>
                </div>

                <div className="text-lg font-bold text-slate-900">
                  {money(submission.submittedAmount)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
