
import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CarFront,
  ClipboardList,
  Plus,
  ReceiptText,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { listRecords } from "../../lib/data";
import { TA_RATE_PER_KM } from "../reports/model";

export default function DashboardPage() {
  const { user } = useAuth();

  const [reports, setReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user?.uid) return;

    let active = true;

    Promise.all([
      listRecords(user.uid, "reports"),
      listRecords(user.uid, "expenses"),
    ])
      .then(([reportRecords, expenseRecords]) => {
        if (!active) return;

        setReports(reportRecords);
        setExpenses(expenseRecords);
        setNote("");
      })
      .catch(() => {
        if (active) {
          setNote("Could not load dashboard data. Please check your connection.");
        }
      });

    return () => {
      active = false;
    };
  }, [user?.uid]);

  const month = new Date().toLocaleDateString("en-CA").slice(0, 7);

  const monthlyReports = reports.filter((report) =>
    report.date?.startsWith(month)
  );

  const monthlyExpenses = expenses.filter((expense) =>
    expense.date?.startsWith(month)
  );

  // Add kilometres only from TA entries
  const km = monthlyExpenses.reduce((sum, expense) => {
    if (expense.type !== "TA") return sum;

    return sum + Number(expense.km || 0);
  }, 0);

  // TA = km × ₹3; all other expenses use their entered amount
  const total = monthlyExpenses.reduce((sum, expense) => {
    if (expense.type === "TA") {
      return sum + Number(expense.km || 0) * TA_RATE_PER_KM;
    }

    return sum + Number(expense.amount || 0);
  }, 0);

  const name = user?.displayName?.split(" ")[0] || "there";

  const money = (amount) =>
    "₹" + Number(amount || 0).toLocaleString("en-IN");

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">FIELD SALES WORKSPACE</div>
          <h1>Welcome back, {name}</h1>
          <p>Your field activity at a glance.</p>
        </div>

        <Link className="btn primary" to="/report">
          <Plus size={16} />
          Create report
        </Link>
      </header>

      {note && <div className="notice">{note}</div>}

      <div className="stats">
        <div className="stat">
          <span>
            <ClipboardList size={16} /> Reports this month
          </span>
          <strong>{monthlyReports.length}</strong>
          <small>Saved daily reports</small>
        </div>

        <div className="stat">
          <span>
            <CarFront size={16} /> Travel distance
          </span>
          <strong>{km.toLocaleString("en-IN")} km</strong>
          <small>Logged this month</small>
        </div>

        <div className="stat">
          <span>
            <ReceiptText size={16} /> Expenses logged
          </span>
          <strong>{money(total)}</strong>
          <small>TA allowance + other expenses this month</small>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quick actions</h2>
            <p>Jump into your most common tasks.</p>
          </div>
        </div>

        <div className="quick-grid">
          <Link to="/report" className="quick-card">
            <div className="quick-icon">
              <ClipboardList />
            </div>
            <strong>Create daily report</strong>
            <span>Build a WhatsApp-ready update</span>
            <ArrowUpRight size={16} />
          </Link>

          <Link to="/expenses" className="quick-card">
            <div className="quick-icon">
              <CarFront />
            </div>
            <strong>Log travel or expenses</strong>
            <span>Save routes, kilometres and costs</span>
            <ArrowUpRight size={16} />
          </Link>

          <Link to="/history" className="quick-card">
            <div className="quick-icon">
              <ReceiptText />
            </div>
            <strong>Report history</strong>
            <span>Find and share previous reports</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>

      <section className="panel recent">
        <div className="panel-heading">
          <div>
            <h2>Recent reports</h2>
            <p>Latest saved updates</p>
          </div>

          <Link className="text-link" to="/history">
            View all →
          </Link>
        </div>

        {!reports.length ? (
          <div className="empty">
            Your saved reports will appear here. Create your first report.
          </div>
        ) : (
          [...reports]
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .slice(0, 5)
            .map((report) => (
              <div className="recent-row" key={report.id}>
                <div className="date-square">
                  {report.date?.slice(8, 10) || "—"}
                  <small>{report.date?.slice(5, 7) || ""}</small>
                </div>

                <div className="recent-info">
                  <b>{report.area || "Daily sales report"}</b>
                  <small>
                    {report.date || "No date"} ·{" "}
                    {report.executive || "Sales executive"} ·{" "}
                    {report.poCount || "—"} PO
                  </small>
                </div>
              </div>
            ))
        )}
      </section>
    </>
  );
}
