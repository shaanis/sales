import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ClipboardCopy,
  Download,
  Save,
  Share2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Sparkles,
  RotateCcw,
  Plus,
  Zap,
  BarChart3,
  ArrowUpRight,
  ClipboardList,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
  updateRecord,
  deleteRecord,
} from "../../lib/data";
import { Field, Input, Area } from "../../components/Field";
import {
  blankReport,
  todayFields,
  mtdFields,
  formatReport,
  calculateMtd,
  getPreviousReport,
  parseCount,
} from "./model";
import { autoCompileReportFromDailyActivity } from "./autoFillHelper";

const todayString = () => new Date().toLocaleDateString("en-CA");

const formatDisplayDate = (d) => {
  if (!d) return "";
  const parts = String(d).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return d;
};

export default function ReportPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryDate = searchParams.get("date");
  const queryId = searchParams.get("id");

  const [reports, setReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [autoFillSummary, setAutoFillSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ text: "", type: "info" });

  const [report, setReport] = useState(() =>
    blankReport(user, queryDate || todayString())
  );
  const [reportId, setReportId] = useState(null);
  const [autoMtd, setAutoMtd] = useState(true);
  const [mobileTab, setMobileTab] = useState("form"); // "form" | "preview"

  // Load user's saved reports & expenses from Firestore
  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setReports([]);
      setExpenses([]);
      setLeads([]);
      setFollowups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [reportsData, expensesData, leadsData, followupsData] =
        await Promise.all([
          listRecords(user.uid, "reports"),
          listRecords(user.uid, "expenses"),
          listRecords(user.uid, "leads").catch(() => []),
          listRecords(user.uid, "followups").catch(() => []),
        ]);
      setReports(Array.isArray(reportsData) ? reportsData : []);
      setExpenses(Array.isArray(expensesData) ? expensesData : []);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setFollowups(Array.isArray(followupsData) ? followupsData : []);
    } catch (err) {
      console.error("Failed to load records:", err);
      setNote({
        text: "Could not load cloud records. Please check your connection.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Find or initialize report when reports list or target date changes
  const switchReportForDate = useCallback(
    (targetDate, targetId = null, currentReports = reports) => {
      const dateToUse = targetDate || todayString();

      // Look up existing report by ID or by date
      let existing = null;
      if (targetId) {
        existing = currentReports.find((r) => r.id === targetId);
      }
      if (!existing) {
        // Prefer latest updated report for that date
        const matching = currentReports.filter((r) => r.date === dateToUse);
        if (matching.length > 0) {
          existing = matching[0];
        }
      }

      if (existing) {
        setReport({
          ...blankReport(user, existing.date),
          ...existing,
        });
        setReportId(existing.id);
        setNote({
          text: `Loaded saved report for ${formatDisplayDate(existing.date)}.`,
          type: "info",
        });
      } else {
        const previousReport = getPreviousReport(currentReports, dateToUse);
        const fresh = blankReport(user, dateToUse);

        // Smart carry-forward for pipeline values and executive name
        if (previousReport) {
          if (!fresh.executive && previousReport.executive) {
            fresh.executive = previousReport.executive;
          }
          fresh.docsProcess = previousReport.docsProcess || "";
          fresh.docsBank = previousReport.docsBank || "";
          fresh.collectionPending = previousReport.collectionPending || "";
        }

        setReport(fresh);
        setReportId(null);
        setNote({
          text: `New report for ${formatDisplayDate(dateToUse)}.`,
          type: "info",
        });
      }
    },
    [reports, user]
  );

  // Initial report load once reports are fetched
  useEffect(() => {
    if (loading) return;
    const initialTargetDate = queryDate || report.date || todayString();
    switchReportForDate(initialTargetDate, queryId, reports);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Dynamic MTD calculation
  const mtdCalc = useMemo(() => {
    return calculateMtd({
      date: report.date,
      report,
      allReports: reports,
      excludeId: reportId,
    });
  }, [report, reports, reportId]);

  // Combined report with dynamic MTD values
  const reportWithMtd = useMemo(() => {
    if (!autoMtd) return report;
    return {
      ...report,
      mtdSiteSurvey: String(mtdCalc.totals.mtdSiteSurvey),
      mtdRevisits: String(mtdCalc.totals.mtdRevisits),
      mtdPoCount: String(mtdCalc.totals.mtdPoCount),
      mtdDealerVisits: String(mtdCalc.totals.mtdDealerVisits),
      mtdClosure: report.mtdClosure || String(mtdCalc.totals.mtdClosure),
      totalPoCount: report.totalPoCount || String(mtdCalc.totals.totalPoCount),
    };
  }, [report, autoMtd, mtdCalc]);

  // Generate live WhatsApp report text
  const output = useMemo(() => {
    return formatReport(reportWithMtd, expenses, reports);
  }, [reportWithMtd, expenses, reports]);

  // Update report fields
  function setField(key, value) {
    setReport((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  // Handle changing the report date
  function handleDateChange(newDate) {
    if (!newDate) return;
    setSearchParams({ date: newDate });
    switchReportForDate(newDate, null, reports);
  }

  // Quick date jump helpers
  function jumpToToday() {
    handleDateChange(todayString());
  }

  function jumpToYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    handleDateChange(yesterday.toLocaleDateString("en-CA"));
  }

  // 1-Click Auto-Fill from today's field activity
  function handleAutoFillToday() {
    const result = autoCompileReportFromDailyActivity({
      targetDate: report.date,
      currentReport: report,
      leads,
      followups,
      expenses,
      allReports: reports,
    });

    setReport(result.compiledReport);
    setAutoFillSummary(result.breakdown);
    setNote({
      text: "⚡ Auto-filled report using today's field CRM data & tomorrow's schedule!",
      type: "success",
    });
  }

  // Check if multiple duplicate entries exist for current date
  const duplicateReports = useMemo(() => {
    if (!report.date) return [];
    return reports.filter((r) => r.date === report.date);
  }, [reports, report.date]);

  // Save / Update report
  async function save() {
    if (!user?.uid) {
      setNote({
        text: "Please log in to save your report.",
        type: "error",
      });
      return;
    }

    setBusy(true);
    setNote({ text: "", type: "info" });

    try {
      // Ensure dynamic MTD totals and new daily fields are saved into Firestore
      const dataToSave = {
        ...reportWithMtd,
        closure:
          report.closure !== undefined && report.closure !== ""
            ? report.closure
            : report.poCount || "0",
        docsBank: report.docsBank || "0",
        dealerVisits: report.dealerVisits || "0",
        ownerUid: user.uid,
      };

      let activeId = reportId;

      // If reportId was not set, double check if another entry exists for this date
      if (!activeId) {
        const existingSameDate = reports.find((r) => r.date === report.date);
        if (existingSameDate) {
          activeId = existingSameDate.id;
        }
      }

      if (activeId) {
        await updateRecord(user.uid, "reports", activeId, dataToSave);

        // Update local reports list
        setReports((prev) =>
          prev.map((r) =>
            r.id === activeId ? { ...dataToSave, id: activeId } : r
          )
        );
        setReportId(activeId);
        setNote({
          text: `Report for ${formatDisplayDate(report.date)} updated successfully.`,
          type: "success",
        });
      } else {
        const result = await addRecord(user.uid, "reports", dataToSave);

        setReportId(result.id);
        setReports((prev) => [{ ...dataToSave, id: result.id }, ...prev]);
        setNote({
          text: `Report for ${formatDisplayDate(report.date)} saved successfully.`,
          type: "success",
        });
      }
    } catch (error) {
      console.error("Save error:", error);
      setNote({
        text: `Save failed: ${error.code || error.message}`,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  // Delete current report
  async function handleDelete() {
    if (!user?.uid || !reportId) return;

    const confirmed = window.confirm(
      `Delete the sales report for ${formatDisplayDate(report.date)} permanently?`
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await deleteRecord(user.uid, "reports", reportId);
      const remainingReports = reports.filter((r) => r.id !== reportId);
      setReports(remainingReports);
      setReportId(null);
      setReport(blankReport(user, report.date));
      setNote({
        text: `Report for ${formatDisplayDate(report.date)} deleted.`,
        type: "info",
      });
    } catch (err) {
      console.error("Delete error:", err);
      setNote({
        text: "Could not delete this report. Please try again.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  // Copy report to clipboard
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(output);
      setNote({
        text: "Copied! Paste the report into your WhatsApp group.",
        type: "success",
      });
    } catch {
      setNote({
        text: "Clipboard unavailable. Select and copy the preview manually.",
        type: "warning",
      });
    }
  }

  // Share via WhatsApp
  function shareWhatsApp() {
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(output)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  // Download text file
  function downloadReport() {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-report-${report.date}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // Render form field for today's metrics
  function renderTodayField([key, label, placeholder]) {
    const multiline = [
      "area",
      "activityType",
      "documentsCollected",
    ].includes(key);

    return (
      <Field key={key} label={label}>
        {multiline ? (
          <Area
            value={report[key] ?? ""}
            onChange={(value) => setField(key, value)}
            placeholder={placeholder || "Add details..."}
          />
        ) : (
          <Input
            value={report[key] ?? ""}
            onChange={(value) => setField(key, value)}
            placeholder={placeholder || "0"}
          />
        )}
      </Field>
    );
  }

  // Render MTD field with dynamic calculation hint
  function renderMtdField([key, label, isAuto]) {
    const isAutoCalculated = autoMtd && isAuto;
    const value = reportWithMtd[key] ?? "";

    // Calculation explanation hint
    let calcHint = "";
    if (isAuto) {
      if (key === "mtdSiteSurvey") {
        calcHint = `Auto: ${mtdCalc.totals.mtdSiteSurvey} (Past this month: ${mtdCalc.base.siteSurvey} + Today: ${parseCount(report.siteSurvey)})`;
      } else if (key === "mtdRevisits") {
        calcHint = `Auto: ${mtdCalc.totals.mtdRevisits} (Past this month: ${mtdCalc.base.revisits} + Today: ${parseCount(report.revisits)})`;
      } else if (key === "mtdPoCount") {
        calcHint = `Auto: ${mtdCalc.totals.mtdPoCount} (Past this month: ${mtdCalc.base.poCount} + Today: ${parseCount(report.poCount)})`;
      } else if (key === "mtdDealerVisits") {
        calcHint = `Auto: ${mtdCalc.totals.mtdDealerVisits} (Past this month: ${mtdCalc.base.dealerVisits} + Today: ${parseCount(report.dealerVisits)})`;
      } else if (key === "mtdClosure") {
        calcHint = `Auto: ${mtdCalc.totals.mtdClosure} (Equal to MTD POs)`;
      } else if (key === "totalPoCount") {
        calcHint = `Auto: ${mtdCalc.totals.totalPoCount} (All-time POs)`;
      }
    }

    return (
      <Field
        key={key}
        label={
          <span className="flex items-center justify-between gap-1 w-full">
            <span>{label}</span>
            {isAutoCalculated && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                <Sparkles size={11} /> Auto
              </span>
            )}
          </span>
        }
        hint={calcHint}
      >
        <Input
          value={value}
          readOnly={isAutoCalculated}
          onChange={(newVal) => {
            if (isAutoCalculated) {
              setAutoMtd(false);
            }
            setField(key, newVal);
          }}
          placeholder="Enter current total"
          className={
            isAutoCalculated
              ? "bg-emerald-50/40 border-emerald-200/80 font-semibold text-emerald-950"
              : ""
          }
        />
      </Field>
    );
  }

  return (
    <>
      {/* Top View Switcher: Daily Report vs Monthly Report & Charts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-slate-200/80 pb-3">
        <div>
          <div className="eyebrow flex items-center gap-1.5 text-teal-700 font-bold tracking-wider">
            <ClipboardList size={14} /> FIELD SALES WORKSPACE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Daily Sales Report
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Log today&apos;s field work and focus items. Live WhatsApp report formats instantly.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl w-fit shadow-inner">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-black bg-white text-teal-900 shadow-sm cursor-default"
          >
            📝 Daily Report
          </button>
          <button
            type="button"
            onClick={() => navigate("/monthly-report")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer flex items-center gap-1"
          >
            <BarChart3 size={13} className="text-teal-700" />
            <span>Monthly Report & Charts</span>
          </button>
        </div>
      </div>

      <header className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            Target Date: <strong className="text-slate-800">{formatDisplayDate(report.date)}</strong>
          </span>
          {report.executive && (
            <span className="text-xs font-semibold text-slate-500">
              • Executive: <strong className="text-teal-800">{report.executive}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {reportId && (
            <button
              className="btn secondary"
              type="button"
              onClick={handleDelete}
              disabled={busy}
              title="Delete this report"
            >
              <Trash2 size={15} className="text-rose-500" />
              Delete
            </button>
          )}

          <button
            className="btn primary"
            onClick={save}
            disabled={busy || loading}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : reportId ? (
              <>
                <CheckCircle2 size={16} />
                Update report
              </>
            ) : (
              <>
                <Save size={16} />
                Save report
              </>
            )}
          </button>
        </div>
      </header>

      {/* Notifications */}
      {note.text && (
        <div
          className={`notice ${
            note.type === "error"
              ? "error"
              : note.type === "success"
                ? "success"
                : note.type === "warning"
                  ? "warning"
                  : ""
          }`}
          role="status"
        >
          {note.text}
        </div>
      )}

      {/* Duplicate detection warning */}
      {duplicateReports.length > 1 && (
        <div className="notice warning flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>
              Notice: {duplicateReports.length} reports exist for this date in
              cloud records. Saving will update the active entry.
            </span>
          </div>
          <button
            className="link font-bold text-amber-900 underline ml-2"
            onClick={() => navigate("/history")}
          >
            Manage in History
          </button>
        </div>
      )}

      {/* Mobile View Switcher (Report Form vs WhatsApp Preview) */}
      <div className="flex rounded-2xl bg-slate-200/90 p-1 lg:hidden mb-4 shadow-inner">
        <button
          type="button"
          onClick={() => setMobileTab("form")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
            mobileTab === "form"
              ? "bg-white text-teal-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          📝 Report Form
        </button>

        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 relative ${
            mobileTab === "preview"
              ? "bg-white text-teal-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          💬 WhatsApp Preview
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>
      </div>

      <div className="report-layout">
        {/* Report Form */}
        <section className={`panel ${mobileTab === "preview" ? "hidden lg:block" : "block"}`}>
          <div className="panel-heading">
            <div>
              <h2>Report details</h2>
              <p>
                {reportId ? (
                  <span className="text-emerald-700 font-medium">
                    Editing saved entry for {formatDisplayDate(report.date)}.
                  </span>
                ) : (
                  <span>
                    New entry for {formatDisplayDate(report.date)}.
                  </span>
                )}
              </p>
            </div>

            <span
              className={`pill ${
                reportId
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              {reportId ? "SAVED ENTRY" : "NEW ENTRY"}
            </span>
          </div>

          {/* Smart Field Automation Bar: 1-Click Auto-Fill */}
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-[#102b32] p-4 text-white shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-200 text-[10px] font-black uppercase tracking-wider">
                  <Sparkles size={11} className="text-teal-300" /> Smart Field Automation
                </span>
                <h3 className="text-sm font-extrabold text-white mt-1">
                  Save Time on the Road
                </h3>
                <p className="text-[11px] text-teal-200/80">
                  Compile today&apos;s logged visits, leads, and tomorrow&apos;s appointments in 1 click.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAutoFillToday}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  title="Auto-calculate counts from today's leads, visits, and tomorrow's appointments"
                >
                  <Zap size={15} className="fill-slate-950" />
                  <span>1-Click Auto-Fill Report</span>
                </button>
              </div>
            </div>

            {/* Auto-Fill Breakdown summary card if active */}
            {autoFillSummary && (
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-white/10 rounded-lg p-2">
                  <span className="text-teal-200 block text-[9px] font-bold uppercase">New Leads Today</span>
                  <strong className="text-white text-xs">{autoFillSummary.detectedNewLeads} leads</strong>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <span className="text-teal-200 block text-[9px] font-bold uppercase">Surveys Done</span>
                  <strong className="text-white text-xs">{autoFillSummary.detectedSurveys} surveys</strong>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <span className="text-teal-200 block text-[9px] font-bold uppercase">Payment Recorded</span>
                  <strong className="text-emerald-300 text-xs">₹{autoFillSummary.detectedPaymentSum.toLocaleString('en-IN')}</strong>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <span className="text-teal-200 block text-[9px] font-bold uppercase">Tomorrow Focus</span>
                  <strong className="text-white text-xs">{autoFillSummary.detectedFocusItems.length} planned</strong>
                </div>
              </div>
            )}
          </div>

          {/* Date and Executive selector */}
          <div className="form-grid">
            <Field label="Report date">
              <div className="space-y-1.5">
                <Input
                  type="date"
                  value={report.date}
                  onChange={handleDateChange}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={jumpToToday}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={jumpToYesterday}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Yesterday
                  </button>
                </div>
              </div>
            </Field>

            <Field label="Executive name">
              <Input
                value={report.executive}
                onChange={(value) => setField("executive", value)}
                placeholder="Your name"
              />
            </Field>
          </div>

          {/* Today's Activity */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
            <h3 className="section-title m-0 p-0 border-0">
              Today&apos;s activity
            </h3>
            <span className="text-xs text-slate-400">
              Counts feed into MTD totals
            </span>
          </div>

          <div className="form-grid mt-3">
            {todayFields.map(renderTodayField)}
          </div>

          {/* Tomorrow's Top 3 Focus */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
            <h3 className="section-title m-0 p-0 border-0 flex items-center gap-2">
              🎯 Tomorrow&apos;s top 3 focus
            </h3>
            <span className="text-xs text-slate-400">
              Key action items planned for tomorrow
            </span>
          </div>

          <div className="form-grid mt-3">
            {[
              ["focus1", "Priority 1", "First task to complete tomorrow"],
              ["focus2", "Priority 2", "Second task"],
              ["focus3", "Priority 3", "Third task"],
            ].map(renderTodayField)}
          </div>

          {/* Monthly Performance & Charts Teaser Banner */}
          <div className="mt-8 pt-5 border-t border-slate-100">
            <div className="rounded-2xl bg-gradient-to-r from-teal-50 via-slate-50 to-indigo-50/60 border border-teal-200/80 p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-teal-800 text-xs font-black uppercase tracking-wider">
                    <BarChart3 size={15} />
                    <span>Monthly Sales Report & Charts</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Month-to-Date Progress ({mtdCalc.daysLoggedThisMonth}{" "}
                    {mtdCalc.daysLoggedThisMonth === 1 ? "day" : "days"} logged this month)
                  </h4>
                  <p className="text-xs text-slate-600">
                    Surveys: <strong className="text-emerald-700">{mtdCalc.totals.mtdSiteSurvey}</strong> • Revisits: <strong className="text-sky-700">{mtdCalc.totals.mtdRevisits}</strong> • B2B: <strong className="text-purple-700">{mtdCalc.totals.mtdDealerVisits}</strong> • Total Closures: <strong className="text-amber-800">{mtdCalc.totals.mtdClosure}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/monthly-report")}
                  className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <span>Open Monthly Diagrams</span>
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick jump to preview on mobile */}
          <div className="mt-6 pt-4 border-t border-slate-100 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab("preview")}
              className="w-full py-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-98 transition"
            >
              <Share2 size={15} className="text-teal-700" />
              <span>Preview WhatsApp Report & Copy →</span>
            </button>
          </div>

          <div className="form-actions flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                className="btn secondary w-full sm:w-auto justify-center"
                onClick={() => {
                  const pickDate = window.prompt(
                    "Enter date for new report (YYYY-MM-DD):",
                    todayString()
                  );
                  if (pickDate) handleDateChange(pickDate);
                }}
              >
                <Plus size={15} />
                New date report
              </button>
            </div>

            <button
              className="btn primary w-full sm:w-auto justify-center"
              onClick={save}
              disabled={busy || loading}
            >
              <Save size={16} />
              {busy
                ? "Saving..."
                : reportId
                  ? "Update report"
                  : "Save to cloud"}
            </button>
          </div>
        </section>

        {/* WhatsApp Preview Sidebar */}
        <aside className={`panel preview-panel ${mobileTab === "form" ? "hidden lg:block" : "block"}`}>
          <div className="panel-heading">
            <div>
              <h2>WhatsApp preview</h2>
              <p>Ready to copy and share.</p>
            </div>

            <span className="pill">LIVE</span>
          </div>

          {/* Mobile Back to Edit button */}
          <div className="mb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab("form")}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              ← Back to Edit Form
            </button>
          </div>

          <div className="preview-tip">
            Preview updates live as you enter today&apos;s site visits and
            metrics.
          </div>

          <textarea
            className="report-output w-full min-h-[300px] sm:min-h-[360px] font-mono text-xs p-3 rounded-xl border border-slate-200 bg-slate-900 text-emerald-300 leading-relaxed outline-none"
            value={output}
            readOnly
            aria-label="WhatsApp report preview"
          />

          <div className="space-y-2 mt-4">
            <button
              type="button"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95"
              onClick={copyReport}
            >
              <ClipboardCopy size={18} />
              <span>Copy WhatsApp Report</span>
            </button>

            <button
              type="button"
              className="w-full py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
              onClick={shareWhatsApp}
            >
              <Share2 size={16} />
              <span>Share on WhatsApp</span>
            </button>

            <button
              type="button"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition"
              onClick={downloadReport}
            >
              <Download size={15} />
              <span>Download Text File</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
