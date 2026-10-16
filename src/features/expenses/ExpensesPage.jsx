import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, CalendarDays, Route } from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
  deleteRecord,
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
  "₹" + Number(value || 0).toLocaleString("en-IN");

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

const formatDate = (dateString) =>
  new Date(`${dateString}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default function ExpensesPage() {
  const { user } = useAuth();

  const [form, setForm] = useState(freshEntry);
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [filter, setFilter] = useState("month");
  const [selectedDate, setSelectedDate] = useState(localDate());

  async function refresh() {
    try {
      const records = await listRecords(user.uid, "expenses");
      setItems(records);
    } catch {
      setNote("Could not load entries. Please check your database settings.");
    }
  }

  useEffect(() => {
    refresh();
  }, [user.uid]);

  const calculatedAmount =
    form.type === "TA" ? Number(form.km || 0) * TA_RATE : Number(form.amount || 0);

  function set(key, value) {
    setForm((previous) => {
      const next = { ...previous, [key]: value };

      // TA amount is always calculated at ₹3 per kilometre.
      if (next.type === "TA") {
        next.amount = String(Number(next.km || 0) * TA_RATE);
      }

      // Switching away from TA allows manual expense entry.
      if (key === "type" && value !== "TA") {
        next.amount = "";
      }

      return next;
    });
  }

  const filteredItems = useMemo(() => {
    const today = localDate();
    const currentMonth = today.slice(0, 7);
    const currentWeek = getWeekStart(today);
    const selectedWeek = getWeekStart(selectedDate);

    return items
      .filter((item) => {
        if (!item.date) return false;

        if (filter === "day") {
          return item.date === selectedDate;
        }

        if (filter === "week") {
          return getWeekStart(item.date) === selectedWeek;
        }

        return item.date.startsWith(currentMonth);
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return String(b.createdAt || "").localeCompare(
          String(a.createdAt || "")
        );
      });
  }, [items, filter, selectedDate]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce((groups, item) => {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
      return groups;
    }, {});
  }, [filteredItems]);

  const totalKm = filteredItems.reduce(
    (sum, item) =>
      sum + (item.type === "TA" ? Number(item.km || 0) : 0),
    0
  );

  const totalTA = filteredItems.reduce(
    (sum, item) =>
      sum + (item.type === "TA" ? Number(item.km || 0) * TA_RATE : 0),
    0
  );

  const totalExpenses = filteredItems.reduce(
    (sum, item) => sum + getAmount(item),
    0
  );

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNote("");

    try {
      const km = Number(form.km || 0);

      if (form.type === "TA" && km <= 0) {
        setNote("Please enter a distance greater than 0 km.");
        setBusy(false);
        return;
      }

      const amount =
        form.type === "TA" ? km * TA_RATE : Number(form.amount || 0);

      await addRecord(user.uid, "expenses", {
        ...form,
        km: form.type === "TA" ? km : 0,
        amount,
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
    if (!window.confirm("Delete this expense entry?")) return;

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
          <p>
            Same-date entries are grouped together. TA is calculated at ₹3/km.
          </p>
        </div>
      </header>

      {note && <div className="notice">{note}</div>}

      <div className="stats">
        <div className="stat">
          <span>Travel distance</span>
          <strong>{totalKm.toLocaleString("en-IN")} km</strong>
        </div>

        <div className="stat">
          <span>TA allowance</span>
          <strong>{money(totalTA)}</strong>
          <small>₹3 per km</small>
        </div>

        <div className="stat">
          <span>Total expenses</span>
          <strong>{money(totalExpenses)}</strong>
          <small>{filteredItems.length} entries in selected period</small>
        </div>
      </div>

      <div className="expense-layout">
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

              {form.type === "TA" && (
                <Field label="Distance (km)">
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.km}
                    onChange={(v) => set("km", v)}
                    placeholder="e.g. 33"
                    required
                  />
                </Field>
              )}

              <Field label={form.type === "TA" ? "Calculated TA (₹)" : "Amount (₹)"}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.type === "TA" ? calculatedAmount : form.amount}
                  onChange={(v) => {
                    if (form.type !== "TA") set("amount", v);
                  }}
                  placeholder="0"
                  readOnly={form.type === "TA"}
                  required={form.type !== "TA"}
                />
                {form.type === "TA" && (
                  <small className="hint">
                    {form.km || 0} km × ₹3 = {money(calculatedAmount)}
                  </small>
                )}
              </Field>

              <Field label="Route / places visited" className="span-2">
                <Input
                  value={form.route}
                  onChange={(v) => set("route", v)}
                  placeholder="Valanchery → Edappal"
                  required={form.type === "TA"}
                />
              </Field>

              <Field label="Notes" className="span-2">
                <Input
                  value={form.note}
                  onChange={(v) => set("note", v)}
                  placeholder="Additional details"
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
              <p>Entries grouped by date.</p>
            </div>
          </div>

          <div className="filter-bar">
            {[
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Month"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`btn ${filter === value ? "primary" : "secondary"}`}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {filter !== "month" && (
            <Field label={filter === "day" ? "Select day" : "Select a date in the week"}>
              <Input
                type="date"
                value={selectedDate}
                onChange={setSelectedDate}
              />
            </Field>
          )}

          <div className="expense-summary">
            <span>
              {filter === "day"
                ? `Selected day: ${selectedDate}`
                : filter === "week"
                ? `Week starting Monday: ${getWeekStart(selectedDate)}`
                : `Current month: ${localDate().slice(0, 7)}`}
            </span>
            <b>{money(totalExpenses)}</b>
          </div>

          {!Object.keys(groupedItems).length ? (
            <div className="empty">
              No entries found for this period.
            </div>
          ) : (
            <div className="date-groups">
              {Object.entries(groupedItems)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, dateItems]) => {
                  const dayKm = dateItems.reduce(
                    (sum, item) =>
                      sum + (item.type === "TA" ? Number(item.km || 0) : 0),
                    0
                  );

                  const dayTotal = dateItems.reduce(
                    (sum, item) => sum + getAmount(item),
                    0
                  );

                  return (
                    <div className="date-group" key={date}>
                      <div className="date-group-heading">
                        <div>
                          <h3>
                            <CalendarDays size={16} /> {formatDate(date)}
                          </h3>
                          <small>
                            {dateItems.length} entries · {dayKm} km
                          </small>
                        </div>
                        <strong>{money(dayTotal)}</strong>
                      </div>

                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Category / route</th>
                              <th>KM</th>
                              <th>Amount</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dateItems.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <b className="tag">{item.type}</b>
                                  <div className="route">
                                    {item.route || item.note || "—"}
                                  </div>
                                  {item.note && item.route && (
                                    <small>{item.note}</small>
                                  )}
                                </td>
                                <td>
                                  {item.type === "TA"
                                    ? `${Number(item.km || 0)} km`
                                    : "—"}
                                </td>
                                <td>{money(getAmount(item))}</td>
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
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}