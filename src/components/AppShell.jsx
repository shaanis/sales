import React, { useEffect, useState, useCallback, useMemo } from "react";
import { NavLink, useNavigate, Link, useLocation } from "react-router-dom";
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
  MoreHorizontal,
  ChevronRight,
  Download,
  Smartphone,
  Share,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useAuth } from "../features/auth/AuthProvider";
import { listRecords, updateRecord } from "../lib/data";
import {
  scheduleExactAlarms,
  formatTime,
  generateCustomerWhatsAppUrl,
  playAlarmChime,
} from "../features/followups/notificationHelper";
import NetworkStatusBadge from "./NetworkStatusBadge";
import { useNetworkStatus, usePwaInstallPrompt } from "../pwa/registerServiceWorker";

export default function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [todayFollowupsCount, setTodayFollowupsCount] = useState(0);
  const [pendingLeadsCount, setPendingLeadsCount] = useState(0);
  const [activeAlarmItem, setActiveAlarmItem] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { isOnline } = useNetworkStatus();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstallPrompt();

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  // Full desktop navigation list
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

  // Secondary items shown inside the "More" mobile bottom sheet
  const secondaryNavigation = [
    {
      path: "/expenses",
      label: "Travel & Expenses",
      desc: "Log daily route kilometres and food bills",
      Icon: CarFront,
      color: "bg-teal-50 text-teal-700",
    },
    {
      path: "/expense-history",
      label: "Expense Log & Claims",
      desc: "View past submissions & download office PDF",
      Icon: ReceiptText,
      color: "bg-blue-50 text-blue-700",
    },
    {
      path: "/history",
      label: "Daily Report History",
      desc: "Browse and review previous days' reports",
      Icon: CalendarDays,
      color: "bg-amber-50 text-amber-700",
    },
    {
      path: "/settlements",
      label: "Cash Settlements",
      desc: "Track office advances and pending amounts",
      Icon: Wallet,
      color: "bg-emerald-50 text-emerald-700",
    },
  ];

  // Check if current route is in secondary navigation
  const isSecondaryActive = useMemo(() => {
    return ["/expenses", "/expense-history", "/history", "/settlements"].includes(
      location.pathname
    );
  }, [location.pathname]);

  // Active page title for the mobile top bar
  const activePageTitle = useMemo(() => {
    switch (location.pathname) {
      case "/":
        return "Overview";
      case "/leads":
        return "Solar Leads CRM";
      case "/followups":
        return "Visits & Appointments";
      case "/report":
        return "Daily Sales Report";
      case "/expenses":
        return "Travel & Expenses";
      case "/expense-history":
        return "Expense Log";
      case "/history":
        return "Report History";
      case "/settlements":
        return "Cash Settlements";
      default:
        return "ECHONIX Sales";
    }
  }, [location.pathname]);

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

  const isIos =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.MSStream;

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
      {/* Real-Time Exact Alarm Modal Popup */}
      {activeAlarmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border-2 border-rose-500 animate-bounce-short">
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
                  <span>{activeAlarmItem.requirement}</span>
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                {activeAlarmItem.phone && (
                  <>
                    <a
                      href={`tel:${activeAlarmItem.phone}`}
                      className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-95"
                    >
                      <Phone size={15} />
                      <span>Call Now</span>
                    </a>
                    <a
                      href={generateCustomerWhatsAppUrl(
                        activeAlarmItem.phone,
                        activeAlarmItem.name,
                        activeAlarmItem.time
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-95"
                    >
                      <MessageCircle size={15} />
                      <span>WhatsApp</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => completeAlarmItem(activeAlarmItem)}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition"
                  title="Mark as completed"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (visible on screens >= 1024px) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#2b494e] bg-[#102b32] text-[#d7e6e7] lg:flex">
        {/* Brand */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#2b494e] px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-[41px] w-[41px] shrink-0 items-center justify-center rounded-xl bg-[#12a594] font-['Manrope'] text-sm font-extrabold text-white shadow-md">
              ES
            </div>

            <div className="min-w-0">
              <h1 className="font-['Manrope'] text-sm font-extrabold tracking-[1px] text-white">
                ECHONIX
              </h1>
              <p className="mt-0.5 text-[10px] text-[#8ea9ac]">
                Solar Sales CRM
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

        {/* PWA & Network Status Badge */}
        <div className="px-4 pb-3">
          <NetworkStatusBadge variant="badge" />
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

      {/* Main Workspace Area */}
      <div className="min-h-screen min-w-0 lg:pl-60">
        {/* Offline / Online Top Banner */}
        <NetworkStatusBadge variant="banner" />

        {/* Modern Mobile App Header (Native App Bar) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0f766e] to-[#14b8a6] font-['Manrope'] text-xs font-black text-white shadow-sm">
              ES
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-slate-900 truncate tracking-tight">
                {activePageTitle}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isOnline ? "bg-emerald-500" : "bg-amber-500 animate-ping"
                  }`}
                />
                <span className="truncate">
                  {isOnline ? "Cloud Synced" : "Offline Mode"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {todayFollowupsCount > 0 && (
              <Link
                to="/followups"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 transition active:scale-95"
                title={`${todayFollowupsCount} site visit(s) due today`}
              >
                <Bell size={18} />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-slate-950 shadow-sm">
                  {todayFollowupsCount}
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition active:scale-95 hover:bg-slate-200"
              aria-label="Open App Menu"
            >
              <span className="font-extrabold text-xs text-[#0f766e]">
                {avatar}
              </span>
            </button>
          </div>
        </header>

        {/* Page Content with safe padding for bottom tab bar */}
        <main className="mx-auto min-h-[calc(100vh-65px)] w-full max-w-[1600px] px-3.5 py-4 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>

        {/* Desktop Footer */}
        <footer className="hidden lg:flex mt-auto flex-col gap-1 border-t border-[#e3eaec] bg-white px-5 py-4 text-[9px] text-[#93a3a6] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>ECHONIX · Solar Field Sales Workspace</span>
          <span>PWA Offline Enabled · Firebase Cloud</span>
        </footer>
      </div>

      {/* ========================================================== */}
      {/* NATIVE MOBILE BOTTOM NAVIGATION BAR (Thumb-friendly 5 tabs) */}
      {/* ========================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200/90 bg-white/95 px-2 py-1.5 backdrop-blur-lg bottom-nav-safe shadow-[0_-4px_25px_rgba(0,0,0,0.06)] lg:hidden">
        {/* Tab 1: Overview */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center py-1 transition-transform active:scale-90 ${
              isActive
                ? "text-teal-700 font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`relative p-1 rounded-xl transition ${
                  isActive ? "bg-teal-50" : ""
                }`}
              >
                <LayoutDashboard
                  size={20}
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none">
                Overview
              </span>
            </>
          )}
        </NavLink>

        {/* Tab 2: Leads */}
        <NavLink
          to="/leads"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center py-1 transition-transform active:scale-90 relative ${
              isActive
                ? "text-teal-700 font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`relative p-1 rounded-xl transition ${
                  isActive ? "bg-teal-50" : ""
                }`}
              >
                <Users size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                {pendingLeadsCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-slate-950 shadow-sm">
                    {pendingLeadsCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none">
                Leads
              </span>
            </>
          )}
        </NavLink>

        {/* Tab 3: Visits & Appointments */}
        <NavLink
          to="/followups"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center py-1 transition-transform active:scale-90 relative ${
              isActive
                ? "text-teal-700 font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`relative p-1 rounded-xl transition ${
                  isActive ? "bg-teal-50" : ""
                }`}
              >
                <CalendarClock
                  size={20}
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
                {todayFollowupsCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-slate-950 shadow-sm animate-pulse">
                    {todayFollowupsCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none">
                Visits
              </span>
            </>
          )}
        </NavLink>

        {/* Tab 4: Daily Sales Report */}
        <NavLink
          to="/report"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center py-1 transition-transform active:scale-90 ${
              isActive
                ? "text-teal-700 font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`relative p-1 rounded-xl transition ${
                  isActive ? "bg-teal-50" : ""
                }`}
              >
                <ClipboardList
                  size={20}
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none">
                Report
              </span>
            </>
          )}
        </NavLink>

        {/* Tab 5: More (App Drawer toggle) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-transform active:scale-90 relative ${
            isSecondaryActive || mobileMenuOpen
              ? "text-teal-700 font-bold"
              : "text-slate-500 hover:text-slate-700"
          }`}
          aria-label="More Features"
        >
          <div
            className={`relative p-1 rounded-xl transition ${
              isSecondaryActive || mobileMenuOpen ? "bg-teal-50" : ""
            }`}
          >
            <MoreHorizontal
              size={20}
              strokeWidth={isSecondaryActive || mobileMenuOpen ? 2.4 : 1.8}
            />
            {isSecondaryActive && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full bg-teal-600" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight leading-none">
            More
          </span>
        </button>
      </nav>

      {/* ========================================================== */}
      {/* MOBILE ACTION SHEET / BOTTOM DRAWER                       */}
      {/* ========================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/60 backdrop-blur-sm transition-all lg:hidden animate-fade-in">
          {/* Backdrop tap to close */}
          <div
            className="flex-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe shadow-2xl animate-slide-up border-t border-slate-100">
            {/* Grab Handle */}
            <div className="mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-slate-200" />

            {/* Profile Header */}
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f766e] text-base font-black text-white shadow-md">
                  {avatar}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 truncate">
                    {displayName}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    {email}
                  </p>
                  <span className="inline-block mt-0.5 text-[9px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    ECHONIX Solar Sales
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Secondary Services Grid */}
            <div className="space-y-2 mb-5">
              <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400 px-1">
                Field Sales Tools
              </p>

              <div className="grid grid-cols-1 gap-2">
                {secondaryNavigation.map(({ path, label, desc, Icon, color }) => {
                  const isActive = location.pathname === path;
                  return (
                    <NavLink
                      key={path}
                      to={path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition active:scale-[0.98] ${
                        isActive
                          ? "bg-teal-50/80 border-teal-200 text-teal-900"
                          : "bg-slate-50/70 border-slate-100 text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} shadow-sm`}
                        >
                          <Icon size={19} />
                        </div>
                        <div className="min-w-0">
                          <strong className="block text-xs font-bold truncate">
                            {label}
                          </strong>
                          <span className="block text-[10px] text-slate-500 truncate">
                            {desc}
                          </span>
                        </div>
                      </div>

                      <ChevronRight
                        size={16}
                        className="text-slate-400 shrink-0"
                      />
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* PWA App Installation & Offline Status */}
            <div className="mb-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Smartphone size={16} className="text-teal-400" />
                  <span className="text-xs font-bold tracking-wide">
                    ECHONIX Mobile App
                  </span>
                </div>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isOnline
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {isOnline ? "Online Sync" : "Offline Storage"}
                </span>
              </div>

              {isInstallable && !isInstalled ? (
                <button
                  type="button"
                  onClick={async () => {
                    await promptInstall();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full mt-2 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-95"
                >
                  <Download size={15} />
                  <span>Install App on this Phone</span>
                </button>
              ) : isIos && !isInstalled ? (
                <div className="text-[11px] text-slate-300 bg-white/10 p-2.5 rounded-xl flex items-center gap-2 mt-2">
                  <Share size={15} className="text-teal-400 shrink-0" />
                  <span>
                    Tap <strong>Share</strong> in Safari, then select{" "}
                    <strong>'Add to Home Screen'</strong> to use full screen!
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-300 mt-1">
                  App is ready with offline storage. All records automatically sync when connected.
                </p>
              )}
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/70 py-3 text-xs font-bold text-red-600 transition hover:bg-red-100 active:scale-98"
            >
              <LogOut size={16} />
              <span>Sign Out of Sales Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
