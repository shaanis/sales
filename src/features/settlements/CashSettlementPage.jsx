import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  deleteRecord,
  listRecords,
  updateRecord,
} from "../../lib/data";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Search,
  CheckCircle2,
  Clock3,
  History,
  Trash2,
} from "lucide-react";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const money = (value) =>
  "₹" +
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const remaining = (item) =>
  Math.max(0, Number(item.amount || 0) - Number(item.paidAmount || 0));

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";

export default function CashSettlementPage() {
  const { user } = useAuth();

  const [settlements, setSettlements] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("open");
  const [paymentAmounts, setPaymentAmounts] = useState({});

  const [form, setForm] = useState({
    person: "",
    direction: "i_owe",
    amount: "",
    date: today(),
    note: "",
  });

  const loadData = async () => {
    if (!user?.uid) {
      setSettlements([]);
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [settlementData, paymentData] = await Promise.all([
        listRecords(user.uid, "settlements"),
        listRecords(user.uid, "settlementPayments"),
      ]);

      setSettlements(Array.isArray(settlementData) ? settlementData : []);
      setPayments(
        (Array.isArray(paymentData) ? paymentData : []).sort((a, b) =>
          String(b.date || "").localeCompare(String(a.date || ""))
        )
      );
    } catch (err) {
      console.error("Failed to load settlement data:", err);
      setError("Unable to load settlement data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const totalToPay = useMemo(
    () =>
      settlements.reduce((total, item) => {
        if ((item.direction || "i_owe") === "i_owe") {
          return total + remaining(item);
        }
        return total;
      }, 0),
    [settlements]
  );

  const filteredSettlements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return settlements
      .filter((item) => {
        const matchesSearch =
          !query ||
          String(item.person || "").toLowerCase().includes(query) ||
          String(item.note || "").toLowerCase().includes(query);

        const due = remaining(item);

        const matchesFilter =
          filter === "all" ||
          (filter === "open" && due > 0) ||
          (filter === "settled" && due === 0);

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      );
  }, [settlements, search, filter]);

  // സെറ്റിൽമെന്റ് ചേർക്കൽ (Firebase: users/{uid}/settlements)
  const handleAddSettlement = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!user?.uid) {
      setError("Please sign in to add a settlement.");
      return;
    }

    const amount = Number(form.amount);
    const person = form.person.trim();

    if (!person) {
      setError("Please enter the person's name.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!form.date) {
      setError("Please select a date.");
      return;
    }

    setSaving(true);

    try {
      await addRecord(user.uid, "settlements", {
        person,
        direction: form.direction,
        amount,
        paidAmount: 0,
        date: form.date,
        note: form.note.trim(),
      });

      setForm({
        person: "",
        direction: "i_owe",
        amount: "",
        date: today(),
        note: "",
      });

      setSuccess("Settlement entry added successfully.");
      await loadData();
    } catch (err) {
      console.error("Failed to add settlement:", err);
      setError("Unable to save the settlement. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // സെറ്റിൽമെന്റ് റെക്കോർഡ് ഡിലീറ്റ് ചെയ്യൽ
  const handleDeleteSettlement = async (item) => {
    if (!user?.uid || !item.id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the settlement record for "${item.person}"? This will also remove associated payment records.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // 1. സെറ്റിൽമെന്റ് റെക്കോർഡ് നീക്കം ചെയ്യുന്നു
      await deleteRecord(user.uid, "settlements", item.id);

      // 2. ഈ സെറ്റിൽമെന്റുമായി ബന്ധപ്പെട്ട പേയ്മെന്റുകൾ ഉണ്ടെങ്കിൽ അവയും നീക്കം ചെയ്യുന്നു
      const relatedPayments = payments.filter((p) => p.settlementId === item.id);
      await Promise.all(
        relatedPayments.map((p) =>
          deleteRecord(user.uid, "settlementPayments", p.id)
        )
      );

      setSuccess("Settlement record deleted successfully.");
      await loadData();
    } catch (err) {
      console.error("Failed to delete settlement:", err);
      setError("Unable to delete the record. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // പേയ്മെന്റ് രേഖപ്പെടുത്തൽ (Firebase: users/{uid}/settlementPayments)
  const handlePayment = async (item) => {
    setError("");
    setSuccess("");

    if (!user?.uid) {
      setError("Please sign in to record a payment.");
      return;
    }

    if (!item.id) {
      setError("Settlement ID is missing.");
      return;
    }

    const due = remaining(item);
    const inputValue = paymentAmounts[item.id];

    const paymentAmount =
      inputValue === undefined || inputValue === ""
        ? due
        : Number(inputValue);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    if (paymentAmount > due) {
      setError(`The outstanding balance is only ${money(due)}.`);
      return;
    }

    const newPaidAmount = Number(item.paidAmount || 0) + paymentAmount;
    setSaving(true);

    try {
      await addRecord(user.uid, "settlementPayments", {
        settlementId: item.id,
        person: item.person,
        direction: item.direction || "i_owe",
        amount: paymentAmount,
        date: today(),
        note:
          item.direction === "i_owe"
            ? "Payment made"
            : "Payment received",
      });

      await updateRecord(user.uid, "settlements", item.id, {
        paidAmount: newPaidAmount,
      });

      setPaymentAmounts((previous) => ({
        ...previous,
        [item.id]: "",
      }));

      setSuccess(
        newPaidAmount >= Number(item.amount)
          ? "Settlement completed successfully."
          : "Payment recorded. Outstanding balance updated."
      );

      await loadData();
    } catch (err) {
      console.error("Failed to record payment:", err);
      setError("Unable to update payment. Please try again.");
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  // പേയ്മെന്റ് ഹിസ്റ്ററിയിൽ നിന്ന് സിംഗിൾ പേയ്മെന്റ് ഡിലീറ്റ് ചെയ്യൽ (റീഫണ്ട്/റിവേർട്ട്)
  const handleDeletePayment = async (payment) => {
    if (!user?.uid || !payment.id) return;

    const confirmed = window.confirm(
      `Delete payment record of ${money(payment.amount)} for "${payment.person}"? This will restore the balance.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // 1. പേയ്മെന്റ് രേഖ നീക്കം ചെയ്യുക
      await deleteRecord(user.uid, "settlementPayments", payment.id);

      // 2. ആ സെറ്റിൽമെന്റിലെ paidAmount കുറയ്ക്കുക
      const parentSettlement = settlements.find((s) => s.id === payment.settlementId);
      if (parentSettlement) {
        const updatedPaid = Math.max(
          0,
          Number(parentSettlement.paidAmount || 0) - Number(payment.amount || 0)
        );
        await updateRecord(user.uid, "settlements", parentSettlement.id, {
          paidAmount: updatedPaid,
        });
      }

      setSuccess("Payment entry deleted and balance restored.");
      await loadData();
    } catch (err) {
      console.error("Failed to delete payment:", err);
      setError("Could not delete payment entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Please sign in to view settlements.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            FINANCIAL ACCOUNTS
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Cash settlement
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track payments you need to make and outstanding personal balances.
          </p>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {success}
        </div>
      )}

      {/* Summary Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Summary
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Pending obligations
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Total outstanding balance you currently owe to others.
            </p>
          </div>

          <div className="rounded-xl bg-amber-50/70 border border-amber-200/50 px-5 py-4 sm:min-w-52">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-amber-800">
              <span>I Need to Pay</span>
              <ArrowUpRight size={16} />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-900">
              {money(totalToPay)}
            </div>
          </div>
        </div>
      </section>

      {/* Add Settlement Form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">Add an entry</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Save a personal loan or debt entry.
          </p>
        </div>

        <form onSubmit={handleAddSettlement} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="cs-person" className={labelClass}>
                Person Name
              </label>
              <input
                id="cs-person"
                value={form.person}
                onChange={(e) =>
                  setForm({ ...form, person: e.target.value })
                }
                placeholder="Enter person's name"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="cs-direction" className={labelClass}>
                Settlement Type
              </label>
              <select
                id="cs-direction"
                value={form.direction}
                onChange={(e) =>
                  setForm({ ...form, direction: e.target.value })
                }
                className={inputClass}
              >
                <option value="i_owe">I Owe Them</option>
                <option value="they_owe">They Owe Me</option>
              </select>
            </div>

            <div>
              <label htmlFor="cs-amount" className={labelClass}>
                Amount (₹)
              </label>
              <input
                id="cs-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value })
                }
                placeholder="0.00"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="cs-date" className={labelClass}>
                Date
              </label>
              <input
                id="cs-date"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm({ ...form, date: e.target.value })
                }
                required
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="cs-note" className={labelClass}>
                Notes (Optional)
              </label>
              <input
                id="cs-note"
                value={form.note}
                onChange={(e) =>
                  setForm({ ...form, note: e.target.value })
                }
                placeholder="Additional details"
                className={inputClass}
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              {saving ? "Saving..." : "Save settlement"}
            </button>
          </div>
        </form>
      </section>

      {/* Settlement Records */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Settlement records
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Active and completed accounts.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className={`${inputClass} py-2 pl-9 text-xs sm:w-56`}
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`${inputClass} py-2 text-xs sm:w-36`}
            >
              <option value="open">Outstanding</option>
              <option value="settled">Completed</option>
              <option value="all">All Records</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Loading settlement records...
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No settlement records found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredSettlements.map((item) => {
              const due = remaining(item);
              const settled = due === 0;
              const direction = item.direction || "i_owe";

              return (
                <article
                  key={item.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/40 p-4 transition hover:border-slate-300 sm:p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {item.person || "Unknown Person"}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.date || "Date not specified"} ·{" "}
                          <span className="font-medium">
                            {direction === "i_owe"
                              ? "You owe them"
                              : "They owe you"}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            settled
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {settled ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <Clock3 size={12} />
                          )}
                          {settled ? "Completed" : "Outstanding"}
                        </span>

                        {/* Settlement Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteSettlement(item)}
                          disabled={saving}
                          aria-label={`Delete record for ${item.person}`}
                          title="Delete Settlement Record"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="my-3 grid grid-cols-2 gap-3 rounded-lg border border-slate-200/60 bg-white p-3">
                      <div>
                        <span className="text-[11px] font-medium text-slate-500">
                          Original Amount
                        </span>
                        <div className="mt-0.5 font-bold text-slate-900">
                          {money(item.amount)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-slate-500">
                          Balance Due
                        </span>
                        <div
                          className={`mt-0.5 font-bold ${
                            settled ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {money(due)}
                        </div>
                      </div>
                    </div>

                    {item.note && (
                      <p className="mb-3 text-xs text-slate-600">
                        {item.note}
                      </p>
                    )}
                  </div>

                  {!settled && (
                    <div className="mt-2 border-t border-slate-200/60 pt-3">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0.01"
                          max={due}
                          step="0.01"
                          placeholder={`Balance: ${money(due)}`}
                          value={paymentAmounts[item.id] ?? ""}
                          onChange={(e) =>
                            setPaymentAmounts((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className={`${inputClass} py-1.5 text-xs`}
                        />

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handlePayment(item)}
                          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 ${
                            direction === "they_owe"
                              ? "bg-emerald-700 hover:bg-emerald-800"
                              : "bg-slate-900 hover:bg-slate-700"
                          }`}
                        >
                          <CheckCircle2 size={14} />
                          {direction === "i_owe" ? "Mark Paid" : "Mark Received"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Payment History */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <History size={18} className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">
            Payment history
          </h2>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Loading payment history...
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No payments have been recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.slice(0, 30).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      payment.direction === "i_owe"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {payment.direction === "i_owe" ? (
                      <ArrowUpRight size={17} />
                    ) : (
                      <ArrowDownLeft size={17} />
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {payment.person || "Unknown Person"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {payment.date || "Date not specified"} ·{" "}
                      {payment.direction === "i_owe"
                        ? "Payment Made"
                        : "Payment Received"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`text-sm font-bold ${
                      payment.direction === "i_owe"
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {money(payment.amount)}
                  </div>

                  {/* Payment Delete / Revert Button */}
                  <button
                    type="button"
                    onClick={() => handleDeletePayment(payment)}
                    disabled={saving}
                    aria-label={`Delete payment for ${payment.person}`}
                    title="Delete Payment and Revert Due"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 size={13} />
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