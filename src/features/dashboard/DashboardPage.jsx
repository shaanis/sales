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
  Users,
  MapPin,
  Sparkles,
  RotateCw,
  Sun,
  Banknote,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { listRecords, updateRecord } from "../../lib/data";
import RescheduleModal from "../../components/RescheduleModal";
import { TA_RATE_PER_KM } from "../reports/model";
import {
  formatTime,
  generateCustomerWhatsAppUrl,
  checkAndNotifyFollowups,
} from "../followups/notificationHelper";
import {
  generateLeadWhatsAppUrl,
  isLeadDormant,
  generateDormantLeadWhatsAppUrl,
  getDaysInactive,
} from "../leads/leadsModel";

export default function DashboardPage() {
  const { user } = useAuth();

  const [reports, setReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user?.uid) return;

    let active = true;

    Promise.all([
      listRecords(user.uid, "reports"),
      listRecords(user.uid, "expenses"),
      listRecords(user.uid, "followups"),
      listRecords(user.uid, "leads").catch(() => []),
    ])
      .then(([reportRecords, expenseRecords, followupRecords, leadRecords]) => {
        if (!active) return;

        setReports(reportRecords);
        setExpenses(expenseRecords);
        setFollowups(followupRecords);
        setLeads(leadRecords || []);
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

  // Today's scheduled followups / visits (Unified from followups + leads)
  const todayFollowups = useMemo(() => {
    const list = [];

    // 1. From followups collection for today
    followups.forEach((f) => {
      if (
        f.date === today &&
        f.status !== "Completed" &&
        f.status !== "Cancelled"
      ) {
        list.push({
          ...f,
          isFollowupRecord: true,
          followupId: f.id,
          leadId: f.leadId,
        });
      }
    });

    // 2. From leads with siteVisitDate === today
    leads.forEach((l) => {
      if (
        l.siteVisitDate === today &&
        l.status !== "Lost" &&
        l.visitStatus !== "Completed" &&
        !list.some(
          (p) => p.leadId === l.id || (p.phone && l.phone && p.phone === l.phone)
        )
      ) {
        list.push({
          id: "lead_visit_" + l.id,
          isFollowupRecord: false,
          leadId: l.id,
          name: l.name,
          phone: l.phone,
          area: l.section,
          time: l.siteVisitTime || "11:00",
          type: "Site Visit",
          status: l.visitStatus === "Completed" ? "Completed" : "Scheduled",
          notes: l.siteVisitNotes || l.currentUpdate || "",
          requirement: l.requirement || "",
        });
      }
    });

    return list.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [followups, leads, today]);

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

  // Leads pending first call
  const pendingLeads = useMemo(() => {
    return leads.filter((l) => l.callStatus === "Pending");
  }, [leads]);

  // Dormant leads needing revival (14+ days inactive)
  const dormantLeads = useMemo(() => {
    return leads.filter((l) => isLeadDormant(l, 14));
  }, [leads]);

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
      if (item.isFollowupRecord && item.followupId) {
        await updateRecord(user.uid, "followups", item.followupId, {
          status: "Completed",
          completedAt: new Date().toISOString(),
        });
        setFollowups((prev) =>
          prev.map((f) =>
            f.id === item.followupId ? { ...f, status: "Completed" } : f
          )
        );
      } else if (item.leadId) {
        await updateRecord(user.uid, "leads", item.leadId, {
          visitStatus: "Completed",
          status: "Visited",
        });
        setLeads((prev) =>
          prev.map((l) =>
            l.id === item.leadId
              ? { ...l, visitStatus: "Completed", status: "Visited" }
              : l
          )
        );
      }
    } catch (err) {
      console.error("Failed to complete:", err);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header (Responsive mobile layout) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-2 border-b border-slate-200/60 lg:border-none">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-teal-700">
            FIELD SALES WORKSPACE
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Welcome back, {name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your field activity, leads and visit reminders at a glance.
          </p>
        </div>

        {/* Quick Shortcut Buttons (Thumb-friendly row on mobile) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto sm:flex sm:items-center">
          <Link
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition"
            to="/leads"
          >
            <Users size={15} className="text-teal-600 shrink-0" />
            <span className="truncate">Leads {pendingLeads.length > 0 ? `(${pendingLeads.length})` : ""}</span>
          </Link>

          <Link
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition"
            to="/followups"
          >
            <CalendarClock size={15} className="text-amber-500 shrink-0" />
            <span className="truncate">Visits {todayFollowups.length > 0 ? `(${todayFollowups.length})` : ""}</span>
          </Link>

          <Link
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 active:scale-95 transition"
            to="/calculator"
            title="Solar Sizer & Quotation"
          >
            <Sun size={15} className="text-amber-600 shrink-0" />
            <span className="truncate">Solar Quote</span>
          </Link>

          <Link
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 shadow-xs hover:bg-emerald-100 active:scale-95 transition"
            to="/solar-loan"
            title="PM Surya Ghar Diminishing Loan & Subsidy Calculator"
          >
            <Banknote size={15} className="text-emerald-600 shrink-0" />
            <span className="truncate">Solar Loan</span>
          </Link>

          <Link
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-bold text-white shadow-sm active:scale-95 transition"
            to="/report"
          >
            <Plus size={15} className="shrink-0" />
            <span className="truncate">Report</span>
          </Link>
        </div>
      </header>

      {note && <div className="notice">{note}</div>}

      {/* Fresh Incoming Leads Alert Banner */}
      {pendingLeads.length > 0 && (
        <section className="rounded-2xl border border-teal-300 bg-teal-50/90 p-3.5 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-teal-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Users size={17} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-black text-teal-950 truncate">
                  ⚡ New Leads Pending Call ({pendingLeads.length})
                </h2>
                <p className="text-[11px] text-teal-800 truncate">
                  Customer inquiries waiting for first contact
                </p>
              </div>
            </div>

            <Link
              to="/leads"
              className="text-xs font-black text-teal-950 bg-teal-200 hover:bg-teal-300 px-3 py-1.5 rounded-xl transition text-center shrink-0 self-start sm:self-auto"
            >
              Open Leads CRM →
            </Link>
          </div>

          <div className="mt-2.5 divide-y divide-teal-100">
            {pendingLeads.slice(0, 4).map((lead) => {
              const waUrl = generateLeadWhatsAppUrl(lead, user?.displayName);

              return (
                <div
                  key={lead.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {lead.name}
                      </strong>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-teal-100 text-teal-800">
                        {lead.source || "WhatsApp"}
                      </span>
                      {lead.section && (
                        <span className="text-[11px] text-slate-600 flex items-center gap-0.5 font-medium">
                          <MapPin size={11} className="text-teal-600 shrink-0" />
                          <span className="truncate">{lead.section}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                    <a
                      href={`tel:${lead.phone}`}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95"
                    >
                      <Phone size={13} />
                      <span>Call</span>
                    </a>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-white text-teal-800 hover:bg-teal-50 flex items-center justify-center gap-1.5 transition border border-teal-200 active:scale-95"
                    >
                      <MessageCircle size={13} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reminder Notification Banner if visits are due today */}
      {todayFollowups.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-amber-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Bell size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-black text-amber-950 truncate">
                  🔔 Today&apos;s Site Visits & Reminders ({todayFollowups.length})
                </h2>
                <p className="text-[11px] text-amber-800 truncate">
                  Visits scheduled for today. Call or mark complete:
                </p>
              </div>
            </div>

            <Link
              to="/followups"
              className="text-xs font-black text-amber-950 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-xl transition text-center shrink-0 self-start sm:self-auto"
            >
              All Follow-ups →
            </Link>
          </div>

          <div className="mt-2.5 divide-y divide-amber-100">
            {todayFollowups.map((item) => {
              const waUrl = generateCustomerWhatsAppUrl(item, user?.displayName);

              return (
                <div
                  key={item.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.name}
                      </strong>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        {item.type || "Site Visit"}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                      {item.time && (
                        <span className="font-bold text-teal-800 mr-1.5">
                          ⏰ {formatTime(item.time)}
                        </span>
                      )}
                      📍 {item.area || "Location not set"}
                      {item.requirement && ` · ⚡ ${item.requirement}`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                    {item.phone && (
                      <a
                        href={`tel:${item.phone}`}
                        className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-1 transition active:scale-95"
                      >
                        <Phone size={12} />
                        <span>Call</span>
                      </a>
                    )}

                    {item.phone && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl text-xs font-bold bg-white text-teal-800 border border-teal-200 hover:bg-teal-50 flex items-center justify-center gap-1 transition active:scale-95"
                      >
                        <MessageCircle size={12} />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setRescheduleItem(item)}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 flex items-center justify-center gap-1 transition active:scale-95"
                      title="Customer not home / busy / reschedule date"
                    >
                      <RotateCw size={12} className="text-amber-700" />
                      <span>Reschedule</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => markFollowupComplete(item)}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 flex items-center justify-center gap-1 transition active:scale-95"
                    >
                      <CheckCircle2 size={13} />
                      <span>Done</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dormant Leads Reviver Banner (Radar Widget) */}
      {dormantLeads.length > 0 && (
        <section className="rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/50 p-3.5 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-amber-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
                <RotateCw size={17} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                    Dormant Leads Reviver ({dormantLeads.length})
                  </h2>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    14+ Days Inactive
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Re-engage stale solar inquiries with 1-click WhatsApp subsidy updates
                </p>
              </div>
            </div>

            <Link
              to="/leads?filter=dormant"
              className="text-xs font-black text-amber-950 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-xl transition text-center shrink-0 self-start sm:self-auto"
            >
              Open Revive Radar →
            </Link>
          </div>

          <div className="mt-2.5 divide-y divide-amber-100/70">
            {dormantLeads.slice(0, 3).map((lead) => {
              const waReviveUrl = generateDormantLeadWhatsAppUrl(
                lead,
                user?.displayName
              );
              const daysInactive = getDaysInactive(lead);

              return (
                <div
                  key={lead.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {lead.name}
                      </strong>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-700">
                        {lead.status}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100/80 text-amber-900 border border-amber-200">
                        ⏳ {daysInactive}d cold
                      </span>
                      {lead.section && (
                        <span className="text-[11px] text-slate-600 flex items-center gap-0.5 font-medium">
                          <MapPin size={11} className="text-teal-600 shrink-0" />
                          <span className="truncate">{lead.section}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {lead.currentUpdate || "No recent activity logged"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                    <a
                      href={`tel:${lead.phone}`}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95"
                    >
                      <Phone size={13} />
                      <span>Call</span>
                    </a>
                    <a
                      href={waReviveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95"
                    >
                      <MessageCircle size={13} />
                      <span className="whitespace-nowrap">WhatsApp Revive</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI Stats (Mobile Responsive Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <ClipboardList size={22} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">
              Reports this month
            </span>
            <strong className="text-xl sm:text-2xl font-black text-slate-900 block leading-tight">
              {uniqueMonthlyReports.length} <span className="text-xs font-bold text-slate-400">Days</span>
            </strong>
            <small className="text-[10px] text-slate-500 block truncate">Logged in {month}</small>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <CarFront size={22} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">
              Travel Distance
            </span>
            <strong className="text-xl sm:text-2xl font-black text-slate-900 block leading-tight">
              {km.toLocaleString("en-IN")} <span className="text-xs font-bold text-slate-400">km</span>
            </strong>
            <small className="text-[10px] text-slate-500 block truncate">Logged this month</small>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <ReceiptText size={22} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">
              Expenses Logged
            </span>
            <strong className="text-xl sm:text-2xl font-black text-slate-900 block leading-tight">
              {money(total)}
            </strong>
            <small className="text-[10px] text-slate-500 block truncate">TA + other expenses</small>
          </div>
        </div>
      </div>

      {/* Quick Actions (Mobile Responsive Grid) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-3.5">
          <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Quick Actions
          </h2>
          <p className="text-xs text-slate-500">Jump directly into your daily field tasks.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Link
            to="/followups"
            className="group flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-amber-50/80 hover:border-amber-200 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
                <CalendarClock size={20} />
              </div>
              <div className="min-w-0">
                <strong className="block text-xs font-bold text-slate-900 truncate group-hover:text-amber-900">
                  Site Visits & Follow-ups
                </strong>
                <span className="block text-[10px] text-slate-500 truncate">
                  Reminders & schedule
                </span>
              </div>
            </div>
            <ArrowUpRight size={16} className="text-slate-400 group-hover:text-amber-700 shrink-0" />
          </Link>

          <Link
            to="/report"
            className="group flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-teal-50/80 hover:border-teal-200 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 shadow-xs">
                <ClipboardList size={20} />
              </div>
              <div className="min-w-0">
                <strong className="block text-xs font-bold text-slate-900 truncate group-hover:text-teal-900">
                  Create Daily Report
                </strong>
                <span className="block text-[10px] text-slate-500 truncate">
                  WhatsApp report + MTD
                </span>
              </div>
            </div>
            <ArrowUpRight size={16} className="text-slate-400 group-hover:text-teal-700 shrink-0" />
          </Link>

          <Link
            to="/expenses"
            className="group flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
                <CarFront size={20} />
              </div>
              <div className="min-w-0">
                <strong className="block text-xs font-bold text-slate-900 truncate group-hover:text-blue-900">
                  Log Travel & Expenses
                </strong>
                <span className="block text-[10px] text-slate-500 truncate">
                  TA route & food claims
                </span>
              </div>
            </div>
            <ArrowUpRight size={16} className="text-slate-400 group-hover:text-blue-700 shrink-0" />
          </Link>
        </div>
      </section>

      {/* Recent Reports Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Recent Daily Reports
            </h2>
            <p className="text-xs text-slate-500">Tap any report to view or edit.</p>
          </div>

          <Link
            className="text-xs font-black text-teal-700 hover:text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl transition"
            to="/history"
          >
            View all →
          </Link>
        </div>

        {!reports.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            No reports saved yet. Create your first report above!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {[...reports]
              .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
              .slice(0, 5)
              .map((report) => (
                <Link
                  to={`/report?date=${report.date}&id=${report.id}`}
                  className="py-3 flex items-center justify-between gap-3 group hover:bg-slate-50/80 px-2 rounded-xl transition active:scale-[0.99]"
                  key={report.id}
                  title="Click to view and edit this report"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex flex-col items-center justify-center shrink-0 border border-slate-200/80 font-bold text-slate-800">
                      <span className="text-xs leading-none">
                        {report.date?.slice(8, 10) || "—"}
                      </span>
                      <span className="text-[9px] text-slate-500 leading-none mt-0.5">
                        {report.date?.slice(5, 7) || ""}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <strong className="block text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-teal-700">
                        {report.area || "Daily sales report"}
                      </strong>
                      <span className="block text-[11px] text-slate-500 truncate mt-0.5">
                        {report.date || "No date"} · {report.poCount || "0"} PO · {report.siteSurvey || "0"} Surveys
                      </span>
                    </div>
                  </div>

                  <div className="text-slate-400 group-hover:text-teal-700 transition shrink-0">
                    <ChevronRight size={18} />
                  </div>
                </Link>
              ))}
          </div>
        )}
      </section>

      {/* Reschedule Visit Modal */}
      {rescheduleItem && (
        <RescheduleModal
          isOpen={Boolean(rescheduleItem)}
          item={rescheduleItem}
          onClose={() => setRescheduleItem(null)}
          onSuccess={() => {
            if (user?.uid) {
              Promise.all([
                listRecords(user.uid, "followups"),
                listRecords(user.uid, "leads").catch(() => []),
              ]).then(([f, l]) => {
                setFollowups(f || []);
                setLeads(l || []);
              });
            }
          }}
        />
      )}
    </div>
  );
}
