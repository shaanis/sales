import React, { useEffect, useState, useCallback } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CarFront,
  CalendarDays,
  ReceiptText,
  LogOut,
  Zap,
  Wallet,
  CalendarClock,
  Bell,
  Phone,
  MessageCircle,
  X,
  MapPin,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";

import { useAuth } from "../features/auth/AuthProvider";
import { listRecords, updateRecord } from "../lib/data";
import {
  scheduleExactAlarms,
  formatTime,
  generateCustomerWhatsAppUrl,
  playAlarmChime,
} from "../features/followups/notificationHelper";

export default function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [todayFollowupsCount, setTodayFollowupsCount] = useState(0);
  const [pendingLeadsCount, setPendingLeadsCount] = useState(0);
  const [activeAlarmItem, setActiveAlarmItem] = useState(null);

  // Load alarms and lead notifications
  const setupAlarms = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const [records, leadRecords] = await Promise.all([
        listRecords(user.uid, "followups"),
        listRecords(user.uid, "leads").catch(() => []),
      ]);
      const list = Array.isArray(records) ? records : [];
      const leadsList = Array.isArray(leadRecords) ? leadRecords : [];
      const todayStr = new Date().toLocaleDateString("en-CA");

      const count = list.filter(
        (r) =>
          r.date === todayStr &&
          r.status !== "Completed" &&
          r.status !== "Cancelled"
      ).length;
      setTodayFollowupsCount(count);

      const uncalledCount = leadsList.filter(
        (l) => l.callStatus === "Pending"
      ).length;
      setPendingLeadsCount(uncalledCount);

      // Register exact-second timer across the entire app
      scheduleExactAlarms(list, (alarmItem) => {
        setActiveAlarmItem(alarmItem);
      });
    } catch (err) {
      console.error("Failed to load alarms in AppShell:", err);
    }
  }, [user?.uid]);

  useEffect(() => {
    setupAlarms();
  }, [setupAlarms]);

  // Navigation routes
  const navigation = [
    { path: "/", label: "Overview", Icon: LayoutDashboard },
    {
      path: "/leads",
      label: "Leads & CRM",
      Icon: Users,
      badge: pendingLeadsCount > 0 ? pendingLeadsCount : null,
    },
    {
      path: "/followups",
      label: "Visits & Follow-ups",
      Icon: CalendarClock,
      badge: todayFollowupsCount > 0 ? todayFollowupsCount : null,
    },
    { path: "/report", label: "Daily report", Icon: ClipboardList },
    { path: "/expenses", label: "Travel & expenses", Icon: CarFront },
    {
      path: "/expense-history",
      label: "Expense log",
      Icon: ReceiptText,
    },
    { path: "/history", label: "Report history", Icon: CalendarDays },
    { path: "/settlements", label: "Settlements", Icon: Wallet },
  ];

  async function logout() {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  // Dismiss active alarm
  function dismissAlarm() {
    setActiveAlarmItem(null);
  }

  // Mark alarm followup completed
  async function completeAlarmItem(item) {
    if (!user?.uid || !item?.id) return;
    try {
      await updateRecord(user.uid, "followups", item.id, {
        status: "Completed",
        completedAt: new Date().toISOString(),
      });
      dismissAlarm();
      setupAlarms();
    } catch (err) {
      console.error("Could not complete:", err);
    }
  }

  const displayName = user?.displayName || "Sales executive";
  const email = user?.email || "";
  const avatar = (user?.displayName || user?.email || "S")
    .charAt(0)
    .toUpperCase();

  const linkClass = ({ isActive }) =>
    [
      "flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-semibold",
      "transition-all duration-200",
      isActive
        ? "bg-[#21464b] text-white [&_svg]:text-[#51d8c6]"
        : "text-[#b6cbcd] hover:bg-[#193a40] hover:text-white",
    ].join(" ");

  return (
    <div className="min-h-screen bg-[#f4f7f8] text-[#19363e]">
      {/* Real-Time Exact Alarm Modal Popup (Fires on the exact second anywhere in the app) */}
      {activeAlarmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border-2 border-rose-500 animate-bounce-short">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-600 to-amber-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner animate-pulse">
                  <Bell size={26} className="text-white" />
                </div>
                <div>
                  <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-white/25 text-white">
                    EXACT TIME REACHED
                  </div>
                  <h3 className="text-xl font-black tracking-tight leading-tight mt-0.5">
                    {formatTime(activeAlarmItem.time)} Appointment Alarm!
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={dismissAlarm}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  {activeAlarmItem.type || "Site Visit"} with
                </span>
                <h4 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {activeAlarmItem.name}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock size={15} className="text-rose-500 shrink-0" />
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">
                      Scheduled Time
                    </span>
                    <strong className="text-slate-900">
                      {formatTime(activeAlarmItem.time)} Today
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin size={15} className="text-teal-600 shrink-0" />
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">
                      Location
                    </span>
                    <strong className="text-slate-900 truncate block">
                      {activeAlarmItem.area || "Site location"}
                    </strong>
                  </div>
                </div>
              </div>

              {activeAlarmItem.requirement && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5 bg-amber-50/70 text-amber-900 p-2.5 rounded-xl border border-amber-200/80">
                  <Sparkles size={14} className="text-amber-600 shrink-0" />
                  <span>
                    <strong>Requirement:</strong> {activeAlarmItem.requirement}
                  </span>
                </p>
              )}

              {activeAlarmItem.notes && (
                <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  &quot;{activeAlarmItem.notes}&quot;
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                {activeAlarmItem.phone && (
                  <a
                    href={`tel:${activeAlarmItem.phone}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-md shadow-emerald-600/20"
                  >
                    <Phone size={16} />
                    Call {activeAlarmItem.phone}
                  </a>
                )}

                {activeAlarmItem.phone && (
                  <a
                    href={generateCustomerWhatsAppUrl(
                      activeAlarmItem,
                      user?.displayName
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => completeAlarmItem(activeAlarmItem)}
                  className="py-3 px-4 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Mark Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#2b494e] bg-[#102b32] text-[#d7e6e7] lg:flex">
        {/* Brand */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#2b494e] px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-[41px] w-[41px] shrink-0 items-center justify-center rounded-xl bg-[#12a594] font-['Manrope'] text-sm font-extrabold text-white">
              ES
            </div>

            <div className="min-w-0">
              <h1 className="font-['Manrope'] text-sm font-extrabold tracking-[1px] text-white">
                ECHONIX
              </h1>
              <p className="mt-1 text-[10px] text-[#8ea9ac]">
                Sales workspace
              </p>
            </div>
          </div>

          {todayFollowupsCount > 0 && (
            <Link
              to="/followups"
              title={`${todayFollowupsCount} site visit(s) due today!`}
              className="relative p-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition animate-pulse"
            >
              <Bell size={16} />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-extrabold text-slate-950">
                {todayFollowupsCount}
              </span>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold tracking-[1.5px] text-[#8ba7aa]">
            WORKSPACE
          </p>

          <nav className="grid gap-1">
            {navigation.map(({ path, label, Icon, badge }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={linkClass}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} strokeWidth={1.9} />
                  <span>{label}</span>
                </div>

                {badge && (
                  <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-extrabold text-slate-950">
                    {badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Profile and logout */}
        <div className="shrink-0 border-t border-[#2b494e] p-4">
          <button
            type="button"
            onClick={logout}
            className="group flex w-full items-center gap-2 rounded-lg border-t border-[#2b494e] px-1 py-4 text-left transition hover:bg-[#193a40]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d5f3ed] text-sm font-extrabold text-[#087d70]">
              {avatar}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold text-[#c7d9da]">
                {displayName}
              </span>
              <span className="mt-1 block truncate text-[9px] text-[#8fa9ac]">
                {email}
              </span>
            </span>

            <LogOut
              size={15}
              className="shrink-0 text-[#8fa9ac] transition group-hover:text-[#51d8c6]"
            />
          </button>
        </div>
      </aside>

      {/* Main workspace */}
      <div className="min-h-screen min-w-0 lg:pl-60">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-[#e3eaec] bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#12a594] font-['Manrope'] text-sm font-extrabold text-white">
              ES
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-['Manrope'] text-sm font-extrabold text-[#16353d]">
                ECHONIX Sales
              </p>
              <p className="truncate text-[10px] text-[#82949a]">
                {displayName}
              </p>
            </div>

            {todayFollowupsCount > 0 && (
              <Link
                to="/followups"
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"
              >
                <Bell size={17} />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-extrabold text-white">
                  {todayFollowupsCount}
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#82949a] transition hover:bg-[#fff0ee] hover:text-red-600"
            >
              <LogOut size={17} />
            </button>
          </div>

          {/* Mobile navigation */}
          <nav className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {navigation.map(({ path, label, Icon, badge }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={({ isActive }) =>
                  [
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-semibold transition relative",
                    isActive
                      ? "bg-[#21464b] text-white [&_svg]:text-[#51d8c6]"
                      : "bg-[#f4f7f8] text-[#49636a] hover:bg-[#e7eeee]",
                  ].join(" ")
                }
              >
                <Icon size={15} />
                <span>{label}</span>
                {badge && (
                  <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] font-extrabold text-slate-950">
                    {badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </header>

        {/* Page content */}
        <main className="mx-auto min-h-[calc(100vh-65px)] w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto flex flex-col gap-1 border-t border-[#e3eaec] bg-white px-5 py-4 text-[9px] text-[#93a3a6] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>ECHONIX · Sales workspace</span>
          <span>Cloud data · Firebase</span>
        </footer>
      </div>
    </div>
  );
}
