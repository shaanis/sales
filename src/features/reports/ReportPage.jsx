
import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardCopy,
  Download,
  Save,
  Share2,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
  updateRecord,
} from "../../lib/data";
import { Field, Input, Area } from "../../components/Field";
import {
  blankReport,
  todayFields,
  mtdFields,
  formatReport,
} from "./model";

export default function ReportPage() {
  const { user } = useAuth();

  const [report, setReport] = useState(() => blankReport(user));
  const [expenses, setExpenses] = useState([]);
  const [reportId, setReportId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // Load expenses from Firebase
  useEffect(() => {
    if (!user?.uid) return;

    listRecords(user.uid, "expenses")
      .then(setExpenses)
      .catch(() =>
        setNote(
          "Could not load expenses. Check Firebase settings."
        )
      );
  }, [user?.uid]);

  // Generate live report text
  const output = useMemo(
    () => formatReport(report, expenses),
    [report, expenses]
  );

  // Update report fields
  function set(key, value) {
    setReport((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  // Save report to Firebase
  async function save() {
    if (!user?.uid) {
      setNote("Please log in to save your report.");
      return;
    }

    setBusy(true);
    setNote("");

    try {
      const data = {
        ...report,
        ownerUid: user.uid,
      };

      if (reportId) {
        await updateRecord(
          user.uid,
          "reports",
          reportId,
          data
        );
      } else {
        const result = await addRecord(
          user.uid,
          "reports",
          data
        );

        setReportId(result.id);
      }

      setNote("Report saved successfully.");
    } catch (error) {
      setNote(
        `Save failed: ${error.code || error.message}`
      );
    } finally {
      setBusy(false);
    }
  }

  // Copy report text
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(output);

      setNote(
        "Copied! Paste the report into your WhatsApp group."
      );
    } catch {
      setNote(
        "Clipboard unavailable. Select and copy the preview manually."
      );
    }
  }

  // Share report through WhatsApp
  function shareWhatsApp() {
    const whatsappUrl =
      `https://api.whatsapp.com/send?text=${encodeURIComponent(output)}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // Download report as TXT
  function downloadReport() {
    const blob = new Blob([output], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sales-report-${report.date}.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  // Render form field
  function renderField([key, label, placeholder]) {
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
            onChange={(value) => set(key, value)}
            placeholder={placeholder || "Add details..."}
          />
        ) : (
          <Input
            value={report[key] ?? ""}
            onChange={(value) => set(key, value)}
            placeholder={
              placeholder || "Enter current total"
            }
          />
        )}
      </Field>
    );
  }

  // Start a fresh report
  function newReport() {
    setReport(blankReport(user));
    setReportId(null);
    setNote("Started a new report. Saved reports are unchanged.");
  }

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">
            FIELD SALES WORKSPACE
          </div>

          <h1>Daily sales report</h1>

          <p>
            Enter today's work once. Your WhatsApp report
            updates automatically.
          </p>
        </div>

        <button
          className="btn primary"
          onClick={save}
          disabled={busy}
        >
          <Save size={16} />
          {busy ? "Saving..." : "Save report"}
        </button>
      </header>

      {note && (
        <div className="notice" role="status">
          {note}
        </div>
      )}

      <div className="report-layout">
        {/* Report form */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Report details</h2>
              <p>
                Complete the relevant fields for today.
              </p>
            </div>

            <span className="pill">DAILY UPDATE</span>
          </div>

          <div className="form-grid">
            <Field label="Report date">
              <Input
                type="date"
                value={report.date}
                onChange={(value) => set("date", value)}
              />
            </Field>

            <Field label="Executive name">
              <Input
                value={report.executive}
                onChange={(value) =>
                  set("executive", value)
                }
                placeholder="Your name"
              />
            </Field>
          </div>

          <h3 className="section-title">
            Today's activity
          </h3>

          <div className="form-grid">
            {todayFields.map(renderField)}
          </div>

          <h3 className="section-title">
            Month-to-date (MTD)
          </h3>

          <p className="hint intro">
            Enter cumulative figures from your official
            sales records.
          </p>

          <div className="form-grid">
            {mtdFields.map(([key, label]) =>
              renderField([
                key,
                label,
                "Enter current total",
              ])
            )}
          </div>

          <h3 className="section-title">
            Tomorrow's top 3 focus
          </h3>

          <div className="form-grid">
            {[
              [
                "focus1",
                "Priority 1",
                "First task to complete",
              ],
              [
                "focus2",
                "Priority 2",
                "Second task",
              ],
              [
                "focus3",
                "Priority 3",
                "Third task",
              ],
            ].map(renderField)}
          </div>

          <div className="form-actions">
            <button
              className="btn secondary"
              onClick={newReport}
            >
              New report
            </button>

            <button
              className="btn primary"
              onClick={save}
              disabled={busy}
            >
              <Save size={16} />
              {busy ? "Saving..." : "Save to cloud"}
            </button>
          </div>
        </section>

        {/* WhatsApp preview and actions */}
        <aside className="panel preview-panel">
          <div className="panel-heading">
            <div>
              <h2>WhatsApp preview</h2>
              <p>Ready to copy and share.</p>
            </div>

            <span className="pill">LIVE</span>
          </div>

          <div className="preview-tip">
            Preview updates as you type.
          </div>

          <textarea
            className="report-output"
            value={output}
            readOnly
            aria-label="WhatsApp report preview"
          />

          <button
            className="btn primary full"
            onClick={copyReport}
          >
            <ClipboardCopy size={16} />
            Copy WhatsApp report
          </button>

          <button
            className="btn primary full"
            onClick={shareWhatsApp}
          >
            <Share2 size={16} />
            Share on WhatsApp
          </button>

          <button
            className="btn secondary full"
            onClick={downloadReport}
          >
            <Download size={16} />
            Download text file
          </button>
        </aside>
      </div>
    </>
  );
}
