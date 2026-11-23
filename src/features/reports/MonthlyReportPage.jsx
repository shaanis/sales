import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Share2,
  Printer,
  BarChart3,
  TrendingUp,
  Award,
  Users,
  MapPin,
  Building2,
  Banknote,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Pencil,
  Info,
  CalendarDays,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import { listRecords } from "../../lib/data";
import {
  calculateMonthlyMetrics,
  formatMonthlyReport,
  parseCount,
} from "./model";

const currentMonthKey = () => new Date().toLocaleDateString("en-CA").slice(0, 7);

export default function MonthlyReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryMonth = searchParams.get("month") || currentMonthKey();
  const [selectedMonth, setSelectedMonth] = useState(queryMonth);
  const [selectedExecutive, setSelectedExecutive] = useState("All");

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(null);
  const [chartMetric, setChartMetric] = useState("all"); // "all" | "surveys" | "revisits" | "b2b" | "closures"

  // Fetch all reports for the user from Firestore
  const loadReports = useCallback(async () => {
    if (!user?.uid) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const records = await listRecords(user.uid, "reports");
      setReports(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error("Failed to load monthly reports:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Sync state with URL search params
  useEffect(() => {
    if (searchParams.get("month") && searchParams.get("month") !== selectedMonth) {
      setSelectedMonth(searchParams.get("month"));
    }
  }, [searchParams, selectedMonth]);

  function handleMonthChange(newMonth) {
    setSelectedMonth(newMonth);
    setSearchParams({ month: newMonth });
    setActiveDayIndex(null);
  }

  function handlePrevMonth() {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = prevDate.toLocaleDateString("en-CA").slice(0, 7);
    handleMonthChange(prevMonthStr);
  }

  function handleNextMonth() {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    const nextMonthStr = nextDate.toLocaleDateString("en-CA").slice(0, 7);
    handleMonthChange(nextMonthStr);
  }

  function handleThisMonth() {
    handleMonthChange(currentMonthKey());
  }

  // Extract distinct executives who have reports
  const distinctExecutives = useMemo(() => {
    const set = new Set();
    reports.forEach((r) => {
      if (r.executive && r.executive.trim()) {
        set.add(r.executive.trim());
      }
    });
    return Array.from(set);
  }, [reports]);

  // Compute all metrics, diagrams data, funnel and series for the month
  const metrics = useMemo(() => {
    return calculateMonthlyMetrics({
      monthKey: selectedMonth,
      allReports: reports,
      executive: selectedExecutive,
    });
  }, [selectedMonth, reports, selectedExecutive]);

  // Generated WhatsApp text for monthly summary
  const whatsappMonthlyText = useMemo(() => {
    return formatMonthlyReport({
      monthName: metrics.monthName,
      executive: selectedExecutive === "All" ? (user?.displayName || "All") : selectedExecutive,
      totals: metrics.totals,
      conversionRates: metrics.conversionRates,
    });
  }, [metrics, selectedExecutive, user?.displayName]);

  // Copy monthly report WhatsApp text
  async function copyWhatsAppText() {
    try {
      await navigator.clipboard.writeText(whatsappMonthlyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      alert("Clipboard access not available. Please copy manually.");
    }
  }

  // Share via WhatsApp
  function shareWhatsApp() {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMonthlyText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Print Report
  function printReport() {
    window.print();
  }

  // Max value in daily series for scaling bar heights
  const maxDayVisits = useMemo(() => {
    let max = 1;
    metrics.dailySeries.forEach((d) => {
      let val = d.totalVisits;
      if (chartMetric === "surveys") val = d.siteSurvey;
      if (chartMetric === "revisits") val = d.revisits;
      if (chartMetric === "b2b") val = d.dealerVisits;
      if (chartMetric === "closures") val = d.closure;
      if (val > max) max = val;
    });
    return max;
  }, [metrics.dailySeries, chartMetric]);

  // Active day details (selected or hovered)
  const activeDay = useMemo(() => {
    if (activeDayIndex === null) return null;
    return metrics.dailySeries[activeDayIndex] || null;
  }, [metrics.dailySeries, activeDayIndex]);

  // Donut chart calculations
  const donutData = useMemo(() => {
    const { activityMix, totalActions } = metrics;
    if (!totalActions || totalActions === 0) return null;

    let cumulativePercent = 0;
    const slices = activityMix.map((item) => {
      const startPercent = cumulativePercent;
      cumulativePercent += item.percentage;
      return {
        ...item,
        startPercent,
        endPercent: cumulativePercent,
      };
    });

    return { slices, totalActions };
  }, [metrics]);

  return (
    <div className="space-y-6 pb-12 print:p-0">
      {/* Top Navigation Tabs: Daily vs Monthly */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 print:hidden">
        <div>
          <div className="eyebrow flex items-center gap-1.5 text-teal-700 font-bold tracking-wider">
            <BarChart3 size={14} /> FIELD SALES ANALYTICS
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Monthly Performance Report
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Interactive charts, conversion funnels, and territory analytics for {metrics.monthName}.
          </p>
        </div>

        {/* View Switcher: Daily Report vs Monthly Report */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl w-fit shadow-inner">
          <button
            type="button"
            onClick={() => navigate("/report")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            📝 Daily Report
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-black bg-white text-teal-900 shadow-sm cursor-default"
          >
            📊 Monthly Report & Charts
          </button>
        </div>
      </div>

      {/* Month & Executive Selector Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 print:hidden">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title="Previous month"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar size={16} className="text-teal-700" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-transparent text-sm font-black text-slate-800 outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title="Next month"
          >
            <ChevronRight size={18} />
          </button>

          {selectedMonth !== currentMonthKey() && (
            <button
              type="button"
              onClick={handleThisMonth}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 transition cursor-pointer"
            >
              Current Month
            </button>
          )}
        </div>

        {/* Executive Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {distinctExecutives.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 font-medium">Executive:</span>
              <select
                value={selectedExecutive}
                onChange={(e) => setSelectedExecutive(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="All">All Executives</option>
                {distinctExecutives.map((exec) => (
                  <option key={exec} value={exec}>
                    {exec}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={copyWhatsAppText}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 size={15} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <ClipboardCopy size={15} />
                <span>Copy WhatsApp Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={shareWhatsApp}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Share Monthly Report on WhatsApp"
          >
            <Share2 size={15} />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={printReport}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Print or Save PDF"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Print-Only Title Banner */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-2xl font-black text-slate-900">
          Monthly Sales Performance Report
        </h1>
        <p className="text-sm text-slate-600">
          Month: {metrics.monthName} | Executive: {selectedExecutive === "All" ? (user?.displayName || "All") : selectedExecutive}
        </p>
      </div>

      {/* SECTION 1: 8 Key Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Closed Deals / POs */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 p-4 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100/90">
              Total Closures
            </span>
            <span className="p-1.5 rounded-lg bg-white/20">
              <Award size={16} className="text-emerald-100" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
            {metrics.totals.closure}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-100 font-semibold">
            <span>{metrics.conversionRates.surveyToClosure}</span>
            <span className="text-white/70">survey to close</span>
          </div>
        </div>

        {/* Metric 2: Site Surveys Done */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Site Surveys Done
            </span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <Building2 size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {metrics.totals.siteSurvey}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Initial feasibility checks
          </div>
        </div>

        {/* Metric 3: Re-visits Done */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Re-visits Done
            </span>
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
              <RefreshCw size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {metrics.totals.revisits}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Follow-up & negotiations
          </div>
        </div>

        {/* Metric 4: B2B Visits */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              B2B / Dealer Visits
            </span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
              <Users size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {metrics.totals.dealerVisits}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Commercial channel visits
          </div>
        </div>

        {/* Metric 5: New Leads Collected */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              New Leads Captured
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Sparkles size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {metrics.totals.newLeads}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            {metrics.conversionRates.leadToSurvey} qualified to survey
          </div>
        </div>

        {/* Metric 6: Documents to Bank */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Docs to Bank
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <FileCheck size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {metrics.totals.docsBank}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Loan & subsidy files
          </div>
        </div>

        {/* Metric 7: Payment Collected */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Payment Collected
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Banknote size={16} />
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            ₹{metrics.totals.paymentSum.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-semibold">
            Advance & closures
          </div>
        </div>

        {/* Metric 8: Active Field Days */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Active Field Days
            </span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <CalendarDays size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {metrics.activeDays}
            <span className="text-xs font-normal text-slate-400 ml-1">
              / {metrics.daysInMonth}d
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Avg {metrics.conversionRates.avgVisitsPerDay} visits / day
          </div>
        </div>
      </div>

      {/* SECTION 2: Chart Diagram 1 - Daily Activity Progression Chart */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-teal-50 text-teal-700">
                <BarChart3 size={16} />
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                Daily Field Activity Progression Diagram
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Day-by-day distribution of surveys, re-visits, B2B meetings, and closures across {metrics.monthName}. Click any day to inspect.
            </p>
          </div>

          {/* Metric Selector Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setChartMetric("all")}
              className={`px-2.5 py-1 rounded-lg transition ${
                chartMetric === "all"
                  ? "bg-white text-teal-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Visits
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("surveys")}
              className={`px-2.5 py-1 rounded-lg transition ${
                chartMetric === "surveys"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Surveys
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("revisits")}
              className={`px-2.5 py-1 rounded-lg transition ${
                chartMetric === "revisits"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Re-visits
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("b2b")}
              className={`px-2.5 py-1 rounded-lg transition ${
                chartMetric === "b2b"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              B2B
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("closures")}
              className={`px-2.5 py-1 rounded-lg transition ${
                chartMetric === "closures"
                  ? "bg-amber-500 text-slate-950 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Closures
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 mt-4 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-600" />
            <span>Site Surveys</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-sky-500" />
            <span>Re-visits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-purple-500" />
            <span>B2B Visits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500" />
            <span>Closures / PO</span>
          </div>
        </div>

        {/* Interactive SVG Bar Chart Container */}
        <div className="mt-5 overflow-x-auto pb-2">
          <div className="min-w-[650px] sm:min-w-full">
            <div className="h-48 sm:h-56 flex items-end gap-1.5 pt-6 pb-2 border-b border-slate-200">
              {metrics.dailySeries.map((d, index) => {
                let barValue = d.totalVisits;
                if (chartMetric === "surveys") barValue = d.siteSurvey;
                if (chartMetric === "revisits") barValue = d.revisits;
                if (chartMetric === "b2b") barValue = d.dealerVisits;
                if (chartMetric === "closures") barValue = d.closure;

                const heightPercent = maxDayVisits > 0 ? Math.max(4, Math.round((barValue / maxDayVisits) * 100)) : 4;
                const isSelected = activeDayIndex === index;

                return (
                  <div
                    key={d.date}
                    onClick={() => setActiveDayIndex(isSelected ? null : index)}
                    className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 z-20 pointer-events-none bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-md whitespace-nowrap shadow-md">
                      {d.dayStr}: {d.totalVisits} visits {d.closure > 0 ? `(${d.closure} PO)` : ""}
                    </div>

                    {/* Bar visualization */}
                    <div
                      style={{ height: barValue > 0 ? `${heightPercent}%` : "4px" }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all flex flex-col justify-end overflow-hidden ${
                        isSelected ? "ring-2 ring-teal-500 scale-105" : "hover:brightness-110"
                      } ${barValue === 0 ? "bg-slate-100" : ""}`}
                    >
                      {chartMetric === "all" ? (
                        <>
                          {/* Closures */}
                          {d.closure > 0 && (
                            <div
                              style={{ flex: d.closure }}
                              className="bg-amber-500 w-full"
                              title={`${d.closure} closures`}
                            />
                          )}
                          {/* B2B */}
                          {d.dealerVisits > 0 && (
                            <div
                              style={{ flex: d.dealerVisits }}
                              className="bg-purple-500 w-full"
                              title={`${d.dealerVisits} B2B visits`}
                            />
                          )}
                          {/* Re-visits */}
                          {d.revisits > 0 && (
                            <div
                              style={{ flex: d.revisits }}
                              className="bg-sky-500 w-full"
                              title={`${d.revisits} revisits`}
                            />
                          )}
                          {/* Surveys */}
                          {d.siteSurvey > 0 && (
                            <div
                              style={{ flex: d.siteSurvey }}
                              className="bg-emerald-600 w-full"
                              title={`${d.siteSurvey} surveys`}
                            />
                          )}
                        </>
                      ) : (
                        <div
                          className={`w-full h-full ${
                            chartMetric === "surveys"
                              ? "bg-emerald-600"
                              : chartMetric === "revisits"
                              ? "bg-sky-500"
                              : chartMetric === "b2b"
                              ? "bg-purple-500"
                              : "bg-amber-500"
                          }`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Day Numbers */}
            <div className="flex items-center gap-1.5 pt-2 text-[10px] font-mono font-bold text-slate-400">
              {metrics.dailySeries.map((d, index) => (
                <div
                  key={d.date}
                  onClick={() => setActiveDayIndex(index)}
                  className={`flex-1 text-center cursor-pointer transition ${
                    activeDayIndex === index
                      ? "text-teal-800 font-black scale-110"
                      : "hover:text-slate-800"
                  }`}
                >
                  {d.day}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Day Breakdown Card */}
        {activeDay && (
          <div className="mt-4 p-3.5 rounded-xl bg-teal-50/70 border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-teal-950">
                  Day Details: {activeDay.date.split("-").reverse().join("/")}
                </span>
                {activeDay.area && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-teal-800 font-semibold text-[10px]">
                    <MapPin size={10} /> {activeDay.area}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-slate-700">
                <span>Surveys: <strong>{activeDay.siteSurvey}</strong></span>
                <span>Re-visits: <strong>{activeDay.revisits}</strong></span>
                <span>B2B: <strong>{activeDay.dealerVisits}</strong></span>
                <span>Leads: <strong>{activeDay.newLeads}</strong></span>
                <span>Closures: <strong>{activeDay.closure}</strong></span>
                <span>Payment: <strong>₹{activeDay.payment.toLocaleString("en-IN")}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/report?date=${activeDay.date}`)}
              className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <span>Edit Day Report</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </section>

      {/* SECTION 3: Conversion Funnel & Activity Mix Diagrams (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Diagram 2: Sales Conversion Funnel */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="p-1 rounded-lg bg-indigo-50 text-indigo-700">
                <TrendingUp size={16} />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Sales Conversion Funnel Diagram
                </h2>
                <p className="text-xs text-slate-500">
                  Pipeline efficiency from Lead Capture to Deal Closure
                </p>
              </div>
            </div>

            {/* Funnel Stages */}
            <div className="mt-5 space-y-3">
              {metrics.funnelStages.map((stage, idx) => {
                const widthPercent = Math.max(16, stage.percentage);

                return (
                  <div key={stage.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black">
                          {idx + 1}
                        </span>
                        {stage.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">
                          {stage.count}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          ({stage.percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Funnel horizontal bar */}
                    <div className="h-4 w-full bg-slate-100 rounded-lg overflow-hidden flex items-center">
                      <div
                        style={{ width: `${widthPercent}%` }}
                        className={`h-full rounded-lg bg-gradient-to-r ${stage.color} transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <div className="text-[10px] font-bold uppercase text-slate-400">
                Lead-to-Survey Rate
              </div>
              <div className="text-base font-black text-teal-800 mt-0.5">
                {metrics.conversionRates.leadToSurvey}
              </div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <div className="text-[10px] font-bold uppercase text-slate-400">
                Survey-to-Close Rate
              </div>
              <div className="text-base font-black text-emerald-700 mt-0.5">
                {metrics.conversionRates.surveyToClosure}
              </div>
            </div>
          </div>
        </section>

        {/* Diagram 3: Activity Mix Donut Diagram */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="p-1 rounded-lg bg-amber-50 text-amber-700">
                <Sparkles size={16} />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Field Activity Mix Diagram
                </h2>
                <p className="text-xs text-slate-500">
                  Ratio of surveys, re-visits, commercial meetings, and leads
                </p>
              </div>
            </div>

            {/* Visual Donut representation */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-around gap-6">
              {/* SVG Donut */}
              <div className="relative w-40 h-40 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {/* Background Circle */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="3.8"
                  />

                  {/* Slices */}
                  {donutData?.slices.map((slice) => (
                    <circle
                      key={slice.name}
                      cx="18"
                      cy="18"
                      r="15.91549430918954"
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="3.8"
                      strokeDasharray={`${slice.percentage} ${100 - slice.percentage}`}
                      strokeDashoffset={100 - slice.startPercent}
                      className="transition-all duration-700"
                    />
                  ))}
                </svg>

                {/* Donut Center Count */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {metrics.totalActions}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                    Field Actions
                  </span>
                </div>
              </div>

              {/* Legend with counts and percentages */}
              <div className="space-y-2.5 w-full sm:w-auto">
                {metrics.activityMix.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{ backgroundColor: item.color }}
                        className="w-3 h-3 rounded-full"
                      />
                      <span className="font-semibold text-slate-700">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">
                        {item.count}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Territories worked */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              Top Areas / Territories Worked
            </div>
            {metrics.topTerritories.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {metrics.topTerritories.map((t) => (
                  <span
                    key={t.area}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold"
                  >
                    <MapPin size={11} className="text-teal-700" />
                    <span>{t.area}</span>
                    <strong className="text-teal-900 font-extrabold">
                      ({t.count})
                    </strong>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No territory areas recorded this month.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* SECTION 4: WhatsApp Monthly Formatted Text Preview */}
      <section className="bg-slate-900 text-emerald-400 rounded-2xl p-5 shadow-md print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-white/10 text-emerald-300">
                <Share2 size={16} />
              </span>
              <h2 className="text-base font-extrabold text-white">
                WhatsApp Monthly Report Preview
              </h2>
            </div>
            <p className="text-xs text-emerald-200/70 mt-0.5">
              Ready to send to group chats or reporting managers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyWhatsAppText}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <ClipboardCopy size={15} />
              <span>{copied ? "Copied!" : "Copy Report Text"}</span>
            </button>
            <button
              type="button"
              onClick={shareWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Share2 size={15} />
              <span>Open WhatsApp</span>
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={whatsappMonthlyText}
          className="w-full mt-4 min-h-[220px] font-mono text-xs p-3 rounded-xl bg-slate-950/80 border border-white/10 text-emerald-300 outline-none leading-relaxed"
        />
      </section>

      {/* SECTION 5: Monthly Day-by-Day Audit Table */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Monthly Log Entries ({metrics.rawReports.length} days recorded)
            </h2>
            <p className="text-xs text-slate-500">
              Detailed breakdown of each daily entry submitted in {metrics.monthName}
            </p>
          </div>
        </div>

        {metrics.rawReports.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Area Worked</th>
                  <th className="py-2.5 px-3 text-center">Surveys</th>
                  <th className="py-2.5 px-3 text-center">Re-visits</th>
                  <th className="py-2.5 px-3 text-center">B2B</th>
                  <th className="py-2.5 px-3 text-center">Leads</th>
                  <th className="py-2.5 px-3 text-center">POs</th>
                  <th className="py-2.5 px-3 text-center">Bank</th>
                  <th className="py-2.5 px-3 text-right">Payment</th>
                  <th className="py-2.5 px-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {metrics.rawReports.map((r) => {
                  const dateFormatted = r.date ? r.date.split("-").reverse().join("/") : "";
                  const closures = r.closure !== undefined && r.closure !== "" ? r.closure : r.poCount;

                  return (
                    <tr key={r.id || r.date} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {dateFormatted}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-[150px] truncate">
                        {r.area || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-800">
                        {r.siteSurvey || 0}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-sky-800">
                        {r.revisits || 0}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-purple-800">
                        {r.dealerVisits ?? r.b2bVisits ?? 0}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-amber-800">
                        {r.newLeads || 0}
                      </td>
                      <td className="py-2.5 px-3 text-center font-extrabold text-slate-900">
                        {closures || 0}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {r.docsBank || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {r.paymentCollected && r.paymentCollected !== "0"
                          ? r.paymentCollected.startsWith("₹")
                            ? r.paymentCollected
                            : `₹${r.paymentCollected}`
                          : "₹0"}
                      </td>
                      <td className="py-2.5 px-3 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => navigate(`/report?date=${r.date}`)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
                        >
                          <Pencil size={11} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400">
            <Calendar size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold text-slate-600">
              No sales reports found for {metrics.monthName}.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Log daily sales reports to view charts, diagrams, and monthly analytics.
            </p>
            <button
              type="button"
              onClick={() => navigate("/report")}
              className="mt-4 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
            >
              <Pencil size={14} />
              <span>Create Daily Report</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
