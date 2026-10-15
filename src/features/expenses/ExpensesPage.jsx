import React,{ useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
  deleteRecord,
} from "../../lib/data";
import { Field, Input } from "../../components/Field";

const freshEntry = () => ({
  date: new Date().toLocaleDateString("en-CA"),
  type: "TA",
  km: "",
  route: "",
  amount: "",
  note: "",
});

const money = (value) =>
  "₹" + Number(value || 0).toLocaleString("en-IN");

export default function ExpensesPage() {
  const { user } = useAuth();

  const [form, setForm] = useState(freshEntry);
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setItems(await listRecords(user.uid, "expenses"));
    } catch {
      setNote("Could not load entries. Check Firebase configuration.");
    }
  }

  useEffect(() => {
    refresh();
  }, [user.uid]);

  const month = new Date().toLocaleDateString("en-CA").slice(0, 7);

  const monthly = useMemo(
    () => items.filter((item) => item.date?.startsWith(month)),
    [items, month]
  );

  const km = monthly.reduce((sum, item) => sum + Number(item.km || 0), 0);

  const total = monthly.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  function set(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNote("");

    try {
      await addRecord(user.uid, "expenses", {
        ...form,
        km: Number(form.km || 0),
        amount: Number(form.amount || 0),
      });

      setForm(freshEntry());
      await refresh();
      setNote("Entry saved successfully.");
    } catch (error) {
      setNote(`Save failed: ${error.code || error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id) {
    try {
      await deleteRecord(user.uid, "expenses", id);
      setItems((previous) => previous.filter((item) => item.id !== id));
      setNote("Entry deleted.");
    } catch {
      setNote("Could not delete this entry.");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">FIELD ACTIVITY</div>
          <h1>Travel & expenses</h1>
          <p>Record travel routes, TA kilometres, food and other expenses.</p>
        </div>
      </header>

      {note && <div className="notice">{note}</div>}

      <div className="stats">
        <div className="stat">
          <span>Travel this month</span>
          <strong>{km} km</strong>
        </div>

        <div className="stat">
          <span>Expenses this month</span>
          <strong>{money(total)}</strong>
        </div>

        <div className="stat">
          <span>Logged entries</span>
          <strong>{monthly.length}</strong>
        </div>
      </div>

      <div className="expense-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Add an entry</h2>
              <p>One entry per trip or expense.</p>
            </div>
          </div>

          <form onSubmit={submit}>
            <div className="form-grid">
              <Field label="Date">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(v) => set("date", v)}
                  required
                />
              </Field>

              <Field label="Category">
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                >
                  <option>TA</option>
                  <option>Food</option>
                  <option>SIM / recharge</option>
                  <option>Other</option>
                </select>
              </Field>

              <Field label="Distance (km)">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.km}
                  onChange={(v) => set("km", v)}
                  placeholder="e.g. 33"
                />
              </Field>

              <Field label="Amount (₹)">
                <Input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(v) => set("amount", v)}
                  placeholder="e.g. 350"
                />
              </Field>

              <Field label="Route / places visited" className="span-2">
                <Input
                  value={form.route}
                  onChange={(v) => set("route", v)}
                  placeholder="KSEB Kandanakam → SBI Kuttippuram"
                />
              </Field>

              <Field label="Notes" className="span-2">
                <Input
                  value={form.note}
                  onChange={(v) => set("note", v)}
                  placeholder="e.g. Food during site visit"
                />
              </Field>
            </div>

            <button className="btn primary" disabled={busy} type="submit">
              <Plus size={16} />
              {busy ? "Saving..." : "Save entry"}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Expense log</h2>
              <p>Entries for the current month.</p>
            </div>
          </div>

          {!monthly.length ? (
            <div className="empty">
              No entries yet. Add your first trip or expense.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category / route</th>
                    <th>KM</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {monthly.map((item) => (
                    <tr key={item.id}>
                      <td>{item.date}</td>

                      <td>
                        <b className="tag">{item.type}</b>
                        <div className="route">
                          {item.route || item.note || "—"}
                        </div>
                      </td>

                      <td>{item.km || "—"}</td>
                      <td>{item.amount ? money(item.amount) : "—"}</td>

                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Delete entry"
                          onClick={() => removeEntry(item.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}