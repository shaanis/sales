import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowUpRight,
  CarFront,
  ClipboardList,
  Plus,
  ReceiptText,
  ChevronRight,
  CalendarClock,
  Clock,
  Phone,
  MessageCircle,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { listRecords, updateRecord } from "../../lib/data";
import { TA_RATE_PER_KM } from "../reports/model";
import {
  formatTime,
  generateCustomerWhatsAppUrl,
  checkAndNotifyFollowups,
} from "../followups/notificationHelper";

export default function DashboardPage() {
  const { user } = useAuth();

  const [reports, setReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user?.uid) return;

    let active = true;

    Promise.all([
      listRecords(user.uid, "reports"),
      listRecords(user.uid, "expenses"),
      listRecords(user.uid, "followups"),
    ])
      .then(([reportRecords, expenseRecords, followupRecords]) => {
        if (!active) return;

        setReports(reportRecords);
        setExpenses(expenseRecords);
        setFollowups(followupRecords);
        setNote("");

        // Trigger browser notification if permissions exist
        checkAndNotifyFollowups(followupRecords);
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

  const today = new Date().toLocaleDateString("en-CA");
  const month = today.slice(0, 7);

  // Today's scheduled followups / visits
  const todayFollowups = useMemo(() => {
    return followups.filter(
      (f) =>
        f.date === today &&
        f.status !== "Completed" &&
        f.status !== "Cancelled"
    );
  }, [followups, today]);

  // Distinct days logged this month
  const uniqueMonthlyReports = useMemo(() => {
    const map = new Map();
    reports
      .filter((r) => r.date?.startsWith(month))
      .forEach((r) => {
        if (!map.has(r.date)) map.set(r.date, r);
      });
    return Array.from(map.values());
  }, [reports, month]);

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

  // Mark followup as complete directly from dashboard
  async function markFollowupComplete(item) {
    if (!user?.uid) return;
    try {
      await updateRecord(user.uid, "followups", item.id, {
        status: "Completed",
        completedAt: new Date().toISOString(),
      });
      setFollowups((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: "Completed" } : f))
      );
    } catch (err) {
      console.error("Failed to complete:", err);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">FIELD SALES WORKSPACE</div>
          <h1>Welcome back, {name}</h1>
          <p>Your field activity and visit reminders at a glance.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link className="btn secondary" to="/followups">
            <CalendarClock size={16} />
            Schedule Visit
          </Link>

          <Link className="btn primary" to="/report">
            <Plus size={16} />
            Create report
          </Link>
        </div>
      </header>

      {note && <div className="notice">{note}</div>}

      {/* Reminder Notification Banner if visits are due today */}
      {todayFollowups.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5 shadow-sm mb-6">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Bell size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-amber-950">
                  🔔 Today&apos;s Follow-up & Site Visit Reminder ({todayFollowups.length} Due)
                </h2>
                <p className="text-xs text-amber-800">
                  You have appointments scheduled for today. Call or complete them below:
                </p>
              </div>
            </div>

            <Link
              to="/followups"
              className="text-xs font-bold text-amber-900 bg-amber-200/90 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition"
            >
              All Follow-ups →
            </Link>
          </div>

          <div className="mt-3 divide-y divide-amber-100">
            {todayFollowups.map((item) => {
              const waUrl = generateCustomerWhatsAppUrl(item, user?.displayName);

              return (
                <div
                  key={item.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-slate-900">
                        {item.name}
                      </strong>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        {item.type || "Site Visit"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-0.5">
                      {item.time && (
                        <span className="font-semibold text-teal-800 mr-2">
                          ⏰ {formatTime(item.time)}
                        </span>
                      )}
                      📍 {item.area || "Location not set"}
                      {item.requirement && ` · ⚡ ${item.requirement}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    {item.phone && (
                      <a
                        href={`tel:${item.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                      >
                        <Phone size={12} />
                        Call
                      </a>
                    )}

                    {item.phone && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-teal-800 border border-teal-200 hover:bg-teal-50 transition"
                      >
                        <MessageCircle size={12} />
                        WhatsApp
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => markFollowupComplete(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition"
                    >
                      <CheckCircle2 size={13} />
                      Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI Stats */}
      <div className="stats">
        <div className="stat">
          <span>
            <ClipboardList size={16} /> Reports this month
          </span>
          <strong>{uniqueMonthlyReports.length}</strong>
          <small>Days logged in {month}</small>
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

      {/* Quick Actions */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quick actions</h2>
            <p>Jump into your most common tasks.</p>
          </div>
        </div>

        <div className="quick-grid">
          <Link to="/followups" className="quick-card">
            <div className="quick-icon bg-amber-50 text-amber-600">
              <CalendarClock />
            </div>
            <strong>Site visits & Follow-ups</strong>
            <span>Schedule lead visits and track call reminders</span>
            <ArrowUpRight size={16} />
          </Link>

          <Link to="/report" className="quick-card">
            <div className="quick-icon">
              <ClipboardList />
            </div>
            <strong>Create daily report</strong>
            <span>Build a WhatsApp-ready update with dynamic MTD</span>
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
        </div>
      </section>

      {/* Recent Reports */}
      <section className="panel recent">
        <div className="panel-heading">
          <div>
            <h2>Recent reports</h2>
            <p>Latest saved updates (click to edit)</p>
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
              <Link
                to={`/report?date=${report.date}&id=${report.id}`}
                className="recent-row group hover:bg-slate-50/80 p-2.5 -mx-2.5 rounded-xl transition flex items-center justify-between"
                key={report.id}
                title="Click to view and edit this report"
              >
                <div className="flex items-center gap-3">
                  <div className="date-square">
                    {report.date?.slice(8, 10) || "—"}
                    <small>{report.date?.slice(5, 7) || ""}</small>
                  </div>

                  <div className="recent-info">
                    <b className="group-hover:text-teal-700 transition">
                      {report.area || "Daily sales report"}
                    </b>
                    <small>
                      {report.date || "No date"} ·{" "}
                      {report.executive || "Sales executive"} ·{" "}
                      {report.poCount || "0"} PO ·{" "}
                      {report.siteSurvey || "0"} Surveys
                    </small>
                  </div>
                </div>

                <div className="text-slate-400 group-hover:text-teal-700 transition pr-2">
                  <ChevronRight size={18} />
                </div>
              </Link>
            ))
        )}
      </section>
    </>
  );
}
