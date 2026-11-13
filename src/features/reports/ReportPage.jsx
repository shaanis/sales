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
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [reportsData, expensesData] = await Promise.all([
        listRecords(user.uid, "reports"),
        listRecords(user.uid, "expenses"),
      ]);
      setReports(Array.isArray(reportsData) ? reportsData : []);
      setExpenses(Array.isArray(expensesData) ? expensesData : []);
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
      // Ensure dynamic MTD totals are saved into Firestore
      const dataToSave = {
        ...reportWithMtd,
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
      <header className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="eyebrow">FIELD SALES WORKSPACE</div>
          <h1>Daily sales report</h1>
          <p>
            Enter today&apos;s field work once. MTD metrics and your WhatsApp
            report update automatically.
          </p>
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

          {/* MTD Section */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
            <div>
              <h3 className="section-title m-0 p-0 border-0 flex items-center gap-2">
                Month-to-date (MTD)
                {autoMtd && (
                  <span className="text-[10px] font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Sparkles size={11} /> AUTO-CALCULATED
                  </span>
                )}
              </h3>
              <p className="hint intro mt-1">
                Calculated dynamically from {mtdCalc.daysLoggedThisMonth}{" "}
                {mtdCalc.daysLoggedThisMonth === 1 ? "day" : "days"} logged this
                month.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoMtd((v) => !v)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition"
            >
              {autoMtd ? "Edit MTD manually" : "Reset to Auto MTD"}
            </button>
          </div>

          <div className="form-grid mt-3">
            {mtdFields.map(renderMtdField)}
          </div>

          {/* Tomorrow's Top 3 Focus */}
          <h3 className="section-title">Tomorrow&apos;s top 3 focus</h3>

          <div className="form-grid">
            {[
              ["focus1", "Priority 1", "First task to complete"],
              ["focus2", "Priority 2", "Second task"],
              ["focus3", "Priority 3", "Third task"],
            ].map(renderTodayField)}
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
