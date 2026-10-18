
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
  } from "react";
  import {
    CalendarDays,
    Wallet,
    CheckCircle2,
    Clock3,
    CircleDollarSign,
    History,
    Pencil,
    ChevronDown,
    ChevronUp,
    Plus,
    X,
    Save,
    LoaderCircle,
    ReceiptText,
  } from "lucide-react";
  
  import { useAuth } from "../auth/AuthProvider";
  import {
    addRecord,
    listRecords,
    updateRecord,
  } from "../../lib/data";
  
  const COLLECTION = "expenseClaims";
  
  const today = () => new Date().toLocaleDateString("en-CA");
  
  const money = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  
  const initialForm = () => ({
    meetingDate: today(),
    periodStart: today(),
    periodEnd: today(),
    submittedAmount: "",
    approvedAmount: "",
    initialDisbursement: "",
    status: "Pending",
    remarks: "",
  });
  
  const totalDisbursed = (claim) =>
    (claim.disbursementHistory || []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
  
  const amountValue = (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
  
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  };
  
  const statusStyles = {
    Pending: "bg-amber-50 text-amber-700 ring-amber-200",
    Approved: "bg-blue-50 text-blue-700 ring-blue-200",
    "Partially disbursed":
      "bg-violet-50 text-violet-700 ring-violet-200",
    "Fully disbursed":
      "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Rejected: "bg-red-50 text-red-700 ring-red-200",
  };
  
  const inputClass =
    "mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
  
  const labelClass =
    "block text-sm font-medium text-slate-700";
  
  const buttonPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60";
  
  const buttonSecondary =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
  
  function SummaryCard({ icon: Icon, label, amount, tone }) {
    const tones = {
      blue: "bg-blue-50 text-blue-600",
      violet: "bg-violet-50 text-violet-600",
      green: "bg-emerald-50 text-emerald-600",
      amber: "bg-amber-50 text-amber-600",
    };
  
    return (
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
          >
            <Icon size={20} />
          </div>
          <p className="text-xs font-medium leading-5 text-slate-500 sm:text-sm">
            {label}
          </p>
        </div>
  
        <p className="mt-4 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {money(amount)}
        </p>
      </div>
    );
  }
  
  function FormField({ label, children }) {
    return (
      <label className={labelClass}>
        {label}
        {children}
      </label>
    );
  }
  
  export default function WeeklyClaims() {
    const { user } = useAuth();
  
    const [claims, setClaims] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [editingId, setEditingId] = useState(null);
    const [newPayment, setNewPayment] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [expandedId, setExpandedId] = useState(null);
  
    const loadClaims = useCallback(async () => {
      if (!user?.uid) {
        setClaims([]);
        setLoading(false);
        return;
      }
  
      setLoading(true);
      setError("");
  
      try {
        const records = await listRecords(user.uid, COLLECTION);
  
        setClaims(
          (records || [])
            .filter((item) => item.ownerUid === user.uid)
            .sort((a, b) =>
              String(b.meetingDate || "").localeCompare(
                String(a.meetingDate || "")
              )
            )
        );
      } catch {
        setError("Could not load claims. Please check Firebase settings.");
      } finally {
        setLoading(false);
      }
    }, [user?.uid]);
  
    useEffect(() => {
      loadClaims();
    }, [loadClaims]);
  
    const setField = (key, value) => {
      setForm((previous) => ({
        ...previous,
        [key]: value,
      }));
    };
  
    const resetForm = () => {
      setForm(initialForm());
      setEditingId(null);
      setNewPayment("");
      setError("");
      setMessage("");
    };
  
    const editingClaim = claims.find(
      (item) => item.id === editingId
    );
  
    const currentDisbursed = editingClaim
      ? totalDisbursed(editingClaim)
      : 0;
  
    const submitted = amountValue(form.submittedAmount);
    const approved = amountValue(form.approvedAmount);
  
    const payment = amountValue(
      editingId ? newPayment : form.initialDisbursement
    );
  
    const projectedDisbursed =
      currentDisbursed + (payment !== null ? payment : 0);
  
    const remaining = Math.max(
      0,
      (approved || 0) - projectedDisbursed
    );
  
    const validate = () => {
      if (!user?.uid) return "Please log in first.";
  
      if (
        !form.meetingDate ||
        !form.periodStart ||
        !form.periodEnd
      ) {
        return "Enter the meeting date and expense period.";
      }
  
      if (form.periodEnd < form.periodStart) {
        return "Expense period end cannot be before the start date.";
      }
  
      if (submitted === null || submitted < 0) {
        return "Enter a valid submitted amount.";
      }
  
      if (approved === null || approved < 0) {
        return "Enter a valid approved amount.";
      }
  
      if (approved > submitted) {
        return "Approved amount cannot exceed the submitted amount.";
      }
  
      if (editingId && currentDisbursed > approved) {
        return "Approved amount cannot be less than the amount already received.";
      }
  
      if (payment !== null && payment < 0) {
        return "Payment amount cannot be negative.";
      }
  
      if (
        payment !== null &&
        payment >
          Math.max(0, (approved || 0) - currentDisbursed)
      ) {
        return "Payment cannot exceed the remaining approved balance.";
      }
  
      if (!form.status) return "Select a payment status.";
  
      return "";
    };
  
    const saveClaim = async (event) => {
      event.preventDefault();
      setError("");
      setMessage("");
  
      const validationError = validate();
  
      if (validationError) {
        setError(validationError);
        return;
      }
  
      setSaving(true);
  
      try {
        const now = new Date().toISOString();
        const existing = claims.find(
          (item) => item.id === editingId
        );
  
        const previousHistory =
          existing?.disbursementHistory || [];
  
        const enteredPayment =
          payment !== null && payment > 0 ? payment : 0;
  
        const paymentEntry =
          enteredPayment > 0
            ? [
                {
                  id: crypto.randomUUID(),
                  amount: enteredPayment,
                  date: today(),
                  recordedAt: now,
                  note: existing
                    ? "Additional disbursement"
                    : "Initial disbursement",
                },
              ]
            : [];
  
        const data = {
          meetingDate: form.meetingDate,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          submittedAmount: submitted,
          approvedAmount: approved,
          status: form.status,
          remarks: form.remarks.trim(),
          ownerUid: user.uid,
          disbursementHistory: [
            ...previousHistory,
            ...paymentEntry,
          ],
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
  
        if (editingId) {
          await updateRecord(
            user.uid,
            COLLECTION,
            editingId,
            data
          );
          setMessage("Claim updated successfully.");
        } else {
          await addRecord(user.uid, COLLECTION, data);
          setMessage("Weekly claim saved successfully.");
        }
  
        resetForm();
        await loadClaims();
      } catch (err) {
        setError(
          `Could not save claim: ${
            err.code || err.message || "Unknown error"
          }`
        );
      } finally {
        setSaving(false);
      }
    };
  
    const editClaim = (claim) => {
      setEditingId(claim.id);
  
      setForm({
        meetingDate: claim.meetingDate || today(),
        periodStart: claim.periodStart || today(),
        periodEnd:
          claim.periodEnd ||
          claim.periodStart ||
          today(),
        submittedAmount: String(claim.submittedAmount ?? ""),
        approvedAmount: String(claim.approvedAmount ?? ""),
        initialDisbursement: "",
        status: claim.status || "Pending",
        remarks: claim.remarks || "",
      });
  
      setNewPayment("");
      setError("");
      setMessage("");
  
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };
  
    const summary = useMemo(
      () =>
        claims.reduce(
          (result, claim) => {
            result.submitted += Number(
              claim.submittedAmount || 0
            );
            result.approved += Number(
              claim.approvedAmount || 0
            );
            result.disbursed += totalDisbursed(claim);
            return result;
          },
          { submitted: 0, approved: 0, disbursed: 0 }
        ),
      [claims]
    );
  
    const balance = Math.max(
      0,
      summary.approved - summary.disbursed
    );
  
    return (
      <section className="mt-8 space-y-6 text-slate-800">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <ReceiptText size={24} />
            </div>
  
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Weekly Expense Claims
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Track submitted expenses, company approvals and payments.
              </p>
            </div>
          </div>
  
          <button
            type="button"
            className={buttonPrimary}
            onClick={resetForm}
          >
            <Plus size={17} />
            New claim
          </button>
        </div>
  
        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <X size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}
  
        {message && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />
            {message}
          </div>
        )}
  
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Wallet}
            label="Total submitted"
            amount={summary.submitted}
            tone="blue"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Total approved"
            amount={summary.approved}
            tone="green"
          />
          <SummaryCard
            icon={CircleDollarSign}
            label="Total received"
            amount={summary.disbursed}
            tone="violet"
          />
          <SummaryCard
            icon={Clock3}
            label="Approved balance"
            amount={balance}
            tone="amber"
          />
        </div>
  
        {/* Form */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h3 className="font-bold text-slate-900">
              {editingId ? "Edit expense claim" : "Create expense claim"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Enter your weekly meeting and expense details.
            </p>
          </div>
  
          <form onSubmit={saveClaim} className="space-y-6 p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <FormField label="Meeting date">
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={form.meetingDate}
                  onChange={(e) =>
                    setField("meetingDate", e.target.value)
                  }
                />
              </FormField>
  
              <FormField label="Expense period start">
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={form.periodStart}
                  onChange={(e) =>
                    setField("periodStart", e.target.value)
                  }
                />
              </FormField>
  
              <FormField label="Expense period end">
                <input
                  type="date"
                  required
                  min={form.periodStart}
                  className={inputClass}
                  value={form.periodEnd}
                  onChange={(e) =>
                    setField("periodEnd", e.target.value)
                  }
                />
              </FormField>
  
              <FormField label="Submitted amount (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className={inputClass}
                  value={form.submittedAmount}
                  onChange={(e) =>
                    setField("submittedAmount", e.target.value)
                  }
                  placeholder="1500"
                />
              </FormField>
  
              <FormField label="Approved amount (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className={inputClass}
                  value={form.approvedAmount}
                  onChange={(e) =>
                    setField("approvedAmount", e.target.value)
                  }
                  placeholder="1500"
                />
              </FormField>
  
              <FormField label="Payment status">
                <select
                  required
                  className={inputClass}
                  value={form.status}
                  onChange={(e) =>
                    setField("status", e.target.value)
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">
                    Approved — payment pending
                  </option>
                  <option value="Partially disbursed">
                    Partially disbursed
                  </option>
                  <option value="Fully disbursed">
                    Fully disbursed
                  </option>
                  <option value="Rejected">Rejected</option>
                </select>
              </FormField>
            </div>
  
            <FormField label="Remarks / expense details">
              <textarea
                rows={3}
                className={`${inputClass} resize-y`}
                value={form.remarks}
                onChange={(e) =>
                  setField("remarks", e.target.value)
                }
                placeholder="TA, food, SIM recharge..."
              />
            </FormField>
  
            {editingId ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
                <h4 className="font-semibold text-slate-900">
                  Record a new payment
                </h4>
  
                <p className="mt-2 text-sm text-slate-600">
                  Already received:{" "}
                  <strong>{money(currentDisbursed)}</strong>
                </p>
  
                <p className="mt-1 text-sm text-slate-600">
                  Remaining before payment:{" "}
                  <strong>
                    {money(
                      Math.max(
                        0,
                        (approved || 0) - currentDisbursed
                      )
                    )}
                  </strong>
                </p>
  
                <div className="mt-4 max-w-md">
                  <FormField label="Additional payment received (₹)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={newPayment}
                      onChange={(e) =>
                        setNewPayment(e.target.value)
                      }
                      placeholder="Enter only the new payment"
                    />
                  </FormField>
                </div>
              </div>
            ) : (
              <div className="max-w-md">
                <FormField label="Initial payment received (₹)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={form.initialDisbursement}
                    onChange={(e) =>
                      setField(
                        "initialDisbursement",
                        e.target.value
                      )
                    }
                    placeholder="1000"
                  />
                </FormField>
              </div>
            )}
  
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Balance after this payment
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Approved amount minus total payments.
                </p>
              </div>
  
              <strong className="text-2xl font-bold tracking-tight text-slate-900">
                {money(remaining)}
              </strong>
            </div>
  
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              {editingId && (
                <button
                  type="button"
                  className={buttonSecondary}
                  onClick={resetForm}
                  disabled={saving}
                >
                  <X size={16} />
                  Cancel
                </button>
              )}
  
              <button
                type="submit"
                className={buttonPrimary}
                disabled={saving || loading}
              >
                {saving ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={17} />
                )}
  
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update claim"
                    : "Save claim"}
              </button>
            </div>
          </form>
        </div>
  
        {/* Claim history */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <History size={20} />
            </div>
  
            <div>
              <h3 className="font-bold text-slate-900">
                Claim history
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {claims.length} saved{" "}
                {claims.length === 1 ? "claim" : "claims"}
              </p>
            </div>
          </div>
  
          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
              <LoaderCircle
                size={20}
                className="animate-spin"
              />
              Loading claims...
            </div>
          ) : claims.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <ReceiptText size={26} />
              </div>
              <h4 className="mt-4 font-semibold text-slate-900">
                No claims yet
              </h4>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Create your first weekly expense claim to track
                approvals and payments here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {claims.map((claim) => {
                const received = totalDisbursed(claim);
                const due = Math.max(
                  0,
                  Number(claim.approvedAmount || 0) - received
                );
                const expanded = expandedId === claim.id;
  
                return (
                  <article
                    key={claim.id}
                    className="p-5 transition hover:bg-slate-50/70 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CalendarDays
                            size={17}
                            className="text-slate-400"
                          />
  
                          <h4 className="font-semibold text-slate-900">
                            Meeting: {claim.meetingDate}
                          </h4>
  
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                              statusStyles[claim.status] ||
                              "bg-slate-100 text-slate-600 ring-slate-200"
                            }`}
                          >
                            {claim.status}
                          </span>
                        </div>
  
                        <p className="mt-2 text-sm text-slate-500">
                          Expense period: {claim.periodStart} –{" "}
                          {claim.periodEnd}
                        </p>
  
                        {claim.remarks && (
                          <p className="mt-2 break-words text-sm text-slate-600">
                            {claim.remarks}
                          </p>
                        )}
                      </div>
  
                      <button
                        type="button"
                        className={buttonSecondary}
                        onClick={() => {
                          setExpandedId(expanded ? null : claim.id);
                        }}
                      >
                        {expanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                        {expanded ? "Hide details" : "View details"}
                      </button>
                    </div>
  
                    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Submitted
                        </p>
                        <p className="mt-1 break-words font-bold text-slate-900">
                          {money(claim.submittedAmount)}
                        </p>
                      </div>
  
                      <div className="rounded-xl bg-blue-50/70 p-3">
                        <p className="text-xs text-slate-500">
                          Approved
                        </p>
                        <p className="mt-1 break-words font-bold text-slate-900">
                          {money(claim.approvedAmount)}
                        </p>
                      </div>
  
                      <div className="rounded-xl bg-emerald-50/70 p-3">
                        <p className="text-xs text-slate-500">
                          Received
                        </p>
                        <p className="mt-1 break-words font-bold text-emerald-700">
                          {money(received)}
                        </p>
                      </div>
  
                      <div className="rounded-xl bg-amber-50/70 p-3">
                        <p className="text-xs text-slate-500">
                          Balance
                        </p>
                        <p className="mt-1 break-words font-bold text-amber-700">
                          {money(due)}
                        </p>
                      </div>
                    </div>
  
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={buttonSecondary}
                        onClick={() => editClaim(claim)}
                      >
                        <Pencil size={15} />
                        Edit claim
                      </button>
                    </div>
  
                    {expanded && (
                      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h5 className="font-semibold text-slate-800">
                          Disbursement history
                        </h5>
  
                        {(claim.disbursementHistory || []).length ===
                        0 ? (
                          <p className="mt-3 text-sm text-slate-500">
                            No payments recorded yet.
                          </p>
                        ) : (
                          <ul className="mt-3 divide-y divide-slate-200">
                            {claim.disbursementHistory.map(
                              (entry, index) => (
                                <li
                                  key={entry.id || index}
                                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                                >
                                  <div>
                                    <p className="font-medium text-slate-800">
                                      {entry.date || "Date not recorded"}
                                    </p>
                                    {entry.note && (
                                      <p className="mt-1 text-xs text-slate-500">
                                        {entry.note}
                                      </p>
                                    )}
                                  </div>
  
                                  <strong className="text-slate-900">
                                    {money(entry.amount)}
                                  </strong>
                                </li>
                              )
                            )}
                          </ul>
                        )}
  
                        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm">
                          <span className="text-slate-600">
                            Total received
                          </span>
                          <strong>{money(received)}</strong>
                        </div>
  
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-slate-600">
                            Remaining approved balance
                          </span>
                          <strong>{money(due)}</strong>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }
  