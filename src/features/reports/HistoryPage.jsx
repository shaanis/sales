import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardCopy,
  Download,
  Search,
  Trash2,
  MessageCircle,
  FileText,
  CalendarDays,
  MapPin,
  X,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import { listRecords, deleteRecord } from "../../lib/data";
import { formatReport } from "./model";

export default function HistoryPage() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState({ text: "", type: "info" });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const showNotification = (text, type = "info") => {
    setNote({ text, type });
    setTimeout(() => setNote({ text: "", type: "info" }), 3500);
  };

  useEffect(() => {
    let active = true;

    async function loadReports() {
      if (!user?.uid) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const records = await listRecords(user.uid, "reports");

        if (active) {
          setItems(Array.isArray(records) ? records : []);
          setNote({ text: "", type: "info" });
        }
      } catch (error) {
        console.error("Failed to load reports:", error);

        if (active) {
          showNotification(
            "Unable to load reports. Please check your connection and try again.",
            "error"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const searchableValues = [
          item.date,
          item.area,
          item.executive,
          item.activityType,
          item.poCount,
          item.newLeads,
          item.siteSurvey,
          item.proposalSent,
          item.revisits,
          item.dealerVisits,
          item.paymentCollected,
          item.tomorrowFocus,
          item.tomorrowFocus1,
          item.tomorrowFocus2,
          item.tomorrowFocus3,
        ];

        return searchableValues
          .map((value) => String(value ?? ""))
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      );
  }, [items, search]);

  function getReportText(item) {
    return formatReport(item);
  }

  async function copy(item) {
    try {
      const text = getReportText(item);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand("copy");
        textarea.remove();

        if (!copied) {
          throw new Error("Copy failed");
        }
      }

      setCopiedId(item.id);
      showNotification("Report copied successfully. Ready to paste.", "success");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy report:", error);
      showNotification("Could not copy the report. Please try again.", "error");
    }
  }

  function download(item) {
    try {
      const blob = new Blob([getReportText(item)], {
        type: "text/plain;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `sales-report-${item.date || "report"}.txt`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      showNotification("Report downloaded successfully.", "success");
    } catch (error) {
      console.error("Failed to download report:", error);
      showNotification("Could not download the report. Please try again.", "error");
    }
  }

  function shareWhatsApp(item) {
    try {
      const text = getReportText(item);
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to share report:", error);
      showNotification("Could not prepare the WhatsApp message.", "error");
    }
  }

  async function remove(item) {
    if (!user?.uid || !item.id) {
      showNotification("Unable to identify this report. Please refresh.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Delete the sales report for ${item.date || "this date"} permanently?`
    );

    if (!confirmed) return;

    setDeletingId(item.id);

    try {
      await deleteRecord(user.uid, "reports", item.id);
      setItems((previous) => previous.filter((record) => record.id !== item.id));
      showNotification("Report deleted successfully.", "success");
    } catch (error) {
      console.error("Failed to delete report:", error);
      showNotification("Could not delete this report. Please try again.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(date) {
    if (!date) return "Date not set";

    const value = String(date);
    const parts = value.split("-");

    if (parts.length === 3 && parts[0].length === 4 && parts.every(Boolean)) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return value;
  }

  return (
    <main className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50">
              <FileText size={13} />
              Sales Workspace
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
              Report History
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage, search, export and share your saved daily sales records.
            </p>
          </div>

          <div className="flex items-center gap-3.5 bg-white border border-slate-200/80 rounded-xl px-4 py-3 shadow-sm self-start sm:self-auto">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wider text-slate-400">
                Total reports
              </span>
              <strong className="text-xl font-bold text-slate-900 leading-none">
                {items.length}
              </strong>
            </div>
          </div>
        </header>

        {/* Status / Alert Notification */}
        {note.text && (
          <div
            role="status"
            className={`flex items-center justify-between p-3.5 rounded-xl text-sm border shadow-sm transition-all ${
              note.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {note.type === "error" ? (
                <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
              ) : (
                <Check size={18} className="text-emerald-600 flex-shrink-0" />
              )}
              <span>{note.text}</span>
            </div>

            <button
              type="button"
              onClick={() => setNote({ text: "", type: "info" })}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content Panel */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          
          {/* Panel Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-slate-50/40">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Saved Reports</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Loading records..."
                  : `${filtered.length} ${filtered.length === 1 ? "report" : "reports"} found`}
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search date, area, executive..."
                aria-label="Search reports"
                className="w-full pl-9 pr-9 py-2 bg-white text-sm text-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-600 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-sm gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={28} />
              <p>Loading saved reports...</p>
            </div>
          ) : filtered.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                {search ? <Search size={22} /> : <FileText size={22} />}
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                {search ? "No matching reports" : "No reports yet"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {search
                  ? "Try adjusting your search criteria or clear the query to see all records."
                  : "Your submitted daily sales logs will appear here once saved."}
              </p>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-4 inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop / Tablet Table (Hidden on small screens) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/75 text-[11px] uppercase tracking-wider font-semibold text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="py-3.5 px-6">Report Date</th>
                      <th className="py-3.5 px-6">Area / Activity</th>
                      <th className="py-3.5 px-6">Executive</th>
                      <th className="py-3.5 px-6 text-center">PO Count</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 text-slate-800 font-medium">
                            <CalendarDays size={15} className="text-slate-400" />
                            <span>{formatDate(item.date)}</span>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <div className="font-medium text-slate-800">
                            {item.area || "Daily sales report"}
                          </div>
                          {item.activityType && (
                            <div className="inline-flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <MapPin size={12} />
                              <span>{item.activityType}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {item.executive || "Not specified"}
                          </span>
                        </td>

                        <td className="py-4 px-6 text-center font-semibold text-slate-800">
                          {item.poCount || "0"}
                        </td>

                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 justify-end">
                            {/* WhatsApp Button */}
                            <button
                              type="button"
                              title="Share on WhatsApp"
                              aria-label={`Share report for ${item.date || "this date"} on WhatsApp`}
                              onClick={() => shareWhatsApp(item)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <MessageCircle size={17} />
                            </button>

                            {/* Copy Button */}
                            <button
                              type="button"
                              title="Copy report"
                              aria-label="Copy report"
                              onClick={() => copy(item)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              {copiedId === item.id ? (
                                <Check size={16} className="text-emerald-600" />
                              ) : (
                                <ClipboardCopy size={16} />
                              )}
                            </button>

                            {/* Download Button */}
                            <button
                              type="button"
                              title="Download report"
                              aria-label="Download report"
                              onClick={() => download(item)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Download size={16} />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              title="Delete report"
                              aria-label="Delete report"
                              disabled={deletingId === item.id}
                              onClick={() => remove(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (Visible only on mobile screens) */}
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map((item) => (
                  <article key={item.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <CalendarDays size={14} className="text-slate-400" />
                        {formatDate(item.date)}
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        PO: {item.poCount || "0"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {item.area || "Daily sales report"}
                      </h3>
                      {item.activityType && (
                        <p className="inline-flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <MapPin size={12} />
                          {item.activityType}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        Executive: {item.executive || "Not specified"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <button
                        type="button"
                        onClick={() => shareWhatsApp(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-medium transition"
                      >
                        <MessageCircle size={15} />
                        WhatsApp
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => copy(item)}
                          title="Copy report"
                          aria-label="Copy report"
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                        >
                          {copiedId === item.id ? (
                            <Check size={16} className="text-emerald-600" />
                          ) : (
                            <ClipboardCopy size={16} />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => download(item)}
                          title="Download report"
                          aria-label="Download report"
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Download size={16} />
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => remove(item)}
                          title="Delete report"
                          aria-label="Delete report"
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-40"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* Panel Footer */}
          {!loading && items.length > 0 && (
            <footer className="p-3.5 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-400 text-center sm:text-right font-medium">
              Showing {filtered.length} of {items.length} saved reports
            </footer>
          )}
        </section>
      </div>
    </main>
  );
}