import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Users,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  PhoneIncoming,
  PhoneMissed,
  MessageCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Search,
  Trash2,
  Pencil,
  AlertCircle,
  Sparkles,
  X,
  Loader2,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Copy,
  LayoutGrid,
  Table as TableIcon,
  Send,
  Zap,
  ArrowRight,
  ClipboardPaste,
  FileSpreadsheet,
  Building2,
  CalendarDays,
  Tag,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
  updateRecord,
  deleteRecord,
} from "../../lib/data";
import {
  LEAD_STAGES,
  CALL_STATUSES,
  VISIT_STATUSES,
  LEAD_SOURCES,
  COMMON_SECTIONS,
  QUICK_UPDATE_SNIPPETS,
  blankLead,
  parseLeadsText,
  generateLeadWhatsAppUrl,
} from "./leadsModel";
import {
  generateGoogleCalendarUrl,
  scheduleExactAlarms,
  formatTime,
} from "../followups/notificationHelper";

const COLLECTION = "leads";
const FOLLOWUPS_COLLECTION = "followups";

const todayString = () => new Date().toLocaleDateString("en-CA");

export default function LeadsPage() {
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState({ text: "", type: "info" });

  // View mode: 'table' or 'board'
  const [viewMode, setViewMode] = useState("table");

  // Filters & search
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [callStatusFilter, setCallStatusFilter] = useState("all");

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSource, setImportSource] = useState("WhatsApp");
  const [importAssign, setImportAssign] = useState(user?.displayName || "Ashraf");
  const [parsedLeads, setParsedLeads] = useState([]);

  // Single Lead Edit/Add Modal
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [leadForm, setLeadForm] = useState(() => blankLead(user));

  // Quick Action Modals
  const [callModalLead, setCallModalLead] = useState(null);
  const [callOutcome, setCallOutcome] = useState("Connected");
  const [callNotes, setCallNotes] = useState("");

  const [visitModalLead, setVisitModalLead] = useState(null);
  const [visitDate, setVisitDate] = useState(todayString());
  const [visitTime, setVisitTime] = useState("11:00");
  const [visitNotes, setVisitNotes] = useState("");
  const [syncToFollowups, setSyncToFollowups] = useState(true);

  const [updateModalLead, setUpdateModalLead] = useState(null);
  const [updateText, setUpdateText] = useState("");

  const showNotification = (text, type = "info") => {
    setNote({ text, type });
    setTimeout(() => setNote({ text: "", type: "info" }), 5000);
  };

  // Load leads
  const loadLeads = useCallback(async () => {
    if (!user?.uid) {
      setLeads([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const records = await listRecords(user.uid, COLLECTION);
      setLeads(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error("Failed to load leads:", err);
      showNotification("Could not load leads from cloud.", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Handle parsing text in Import Modal
  useEffect(() => {
    if (importText.trim()) {
      const results = parseLeadsText(importText, importSource, importAssign);
      setParsedLeads(results);
    } else {
      setParsedLeads([]);
    }
  }, [importText, importSource, importAssign]);

  // Bulk Import Confirm
  async function handleConfirmImport() {
    if (!user?.uid || parsedLeads.length === 0) return;

    setSaving(true);
    try {
      let count = 0;
      for (const item of parsedLeads) {
        const payload = {
          name: item.name || "UNNAMED LEAD",
          phone: item.phone || "",
          section: item.section || "",
          source: item.source || importSource,
          status: item.status || "New",
          callStatus: item.callStatus || "Pending",
          firstCallDate: item.firstCallDate || "",
          lastCallDate: item.firstCallDate || "",
          visitStatus: item.visitStatus || "Not_Fixed",
          siteVisitDate: item.siteVisitDate || "",
          siteVisitTime: item.siteVisitTime || "",
          siteVisitAddress: item.section || "",
          currentUpdate: item.currentUpdate || "Imported lead",
          requirement: item.requirement || "5 kW Solar On-Grid",
          assignedTo: item.assignedTo || importAssign,
          generatedMonth:
            item.generatedMonth ||
            new Date().toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            }),
          updates: [
            {
              id: "init",
              text: `Lead imported from ${item.source || importSource}`,
              date: new Date().toISOString(),
              by: user.displayName || "Sales rep",
            },
          ],
        };
        await addRecord(user.uid, COLLECTION, payload);
        count++;
      }

      showNotification(`Successfully imported ${count} lead(s)!`, "success");
      setShowImportModal(false);
      setImportText("");
      setParsedLeads([]);
      loadLeads();
    } catch (err) {
      console.error("Import error:", err);
      showNotification(`Import failed: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  // Save or Update Single Lead
  async function handleSaveLead(e) {
    e.preventDefault();
    if (!user?.uid) return;

    if (!leadForm.name.trim() || !leadForm.phone.trim()) {
      showNotification("Please provide at least Name and Phone number.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: leadForm.name.trim().toUpperCase(),
        phone: leadForm.phone.trim(),
        section: (leadForm.section || "").trim().toUpperCase(),
        source: leadForm.source || "WhatsApp",
        status: leadForm.status || "New",
        callStatus: leadForm.callStatus || "Pending",
        firstCallDate: leadForm.firstCallDate || "",
        lastCallDate: leadForm.lastCallDate || "",
        callNotes: (leadForm.callNotes || "").trim(),
        visitStatus: leadForm.visitStatus || "Not_Fixed",
        siteVisitDate: leadForm.siteVisitDate || "",
        siteVisitTime: leadForm.siteVisitTime || "",
        siteVisitAddress: (leadForm.siteVisitAddress || "").trim(),
        currentUpdate: (leadForm.currentUpdate || "").trim(),
        requirement: (leadForm.requirement || "").trim(),
        assignedTo: leadForm.assignedTo || user.displayName || "Ashraf",
        generatedMonth:
          leadForm.generatedMonth ||
          new Date().toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          }),
        updates: leadForm.updates || [],
      };

      if (editingId) {
        await updateRecord(user.uid, COLLECTION, editingId, payload);
        showNotification("Lead details updated successfully.", "success");
      } else {
        await addRecord(user.uid, COLLECTION, payload);
        showNotification("New lead added successfully.", "success");
      }

      setShowLeadModal(false);
      setEditingId(null);
      setLeadForm(blankLead(user));
      loadLeads();
    } catch (err) {
      console.error("Save lead error:", err);
      showNotification(`Save failed: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  // Quick Action: Log Call
  async function handleLogCallSubmit(e) {
    e.preventDefault();
    if (!user?.uid || !callModalLead) return;

    setSaving(true);
    try {
      const today = todayString();
      const firstDate = callModalLead.firstCallDate || today;

      const newUpdate = `📞 Call: ${callOutcome}${callNotes ? " - " + callNotes : ""}`;
      const updatedHistory = [
        ...(callModalLead.updates || []),
        {
          id: "call_" + Date.now(),
          text: newUpdate,
          date: new Date().toISOString(),
          by: user.displayName || "Sales rep",
        },
      ];

      // Auto update status if connected & was 'New'
      let nextStatus = callModalLead.status;
      if (
        callOutcome === "Connected" &&
        (nextStatus === "New" || !nextStatus)
      ) {
        nextStatus = "Contacted";
      }

      const payload = {
        callStatus: callOutcome,
        firstCallDate: firstDate,
        lastCallDate: today,
        callNotes: callNotes.trim(),
        status: nextStatus,
        currentUpdate: newUpdate,
        updates: updatedHistory,
      };

      await updateRecord(user.uid, COLLECTION, callModalLead.id, payload);

      setLeads((prev) =>
        prev.map((l) =>
          l.id === callModalLead.id ? { ...l, ...payload } : l
        )
      );

      showNotification(`Call logged for ${callModalLead.name}!`, "success");
      setCallModalLead(null);
      setCallNotes("");
    } catch (err) {
      console.error("Log call error:", err);
      showNotification("Could not log call outcome.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Quick Action: Schedule Site Visit
  async function handleScheduleVisitSubmit(e) {
    e.preventDefault();
    if (!user?.uid || !visitModalLead) return;

    if (!visitDate) {
      showNotification("Please select a date for the site visit.", "error");
      return;
    }

    setSaving(true);
    try {
      const formattedTimeStr = visitTime ? ` at ${formatTime(visitTime)}` : "";
      const newUpdate = `📅 Site Visit Scheduled on ${visitDate}${formattedTimeStr} (${visitModalLead.section || "Site"})${visitNotes ? " - " + visitNotes : ""}`;

      const updatedHistory = [
        ...(visitModalLead.updates || []),
        {
          id: "visit_" + Date.now(),
          text: newUpdate,
          date: new Date().toISOString(),
          by: user.displayName || "Sales rep",
        },
      ];

      const payload = {
        visitStatus: "Scheduled",
        siteVisitDate: visitDate,
        siteVisitTime: visitTime || "11:00",
        siteVisitNotes: visitNotes.trim(),
        status: "Visit_Scheduled",
        currentUpdate: newUpdate,
        updates: updatedHistory,
      };

      await updateRecord(user.uid, COLLECTION, visitModalLead.id, payload);

      // Auto create a Follow-up record in 'followups' collection
      if (syncToFollowups) {
        try {
          const followupPayload = {
            name: visitModalLead.name,
            phone: visitModalLead.phone,
            area: visitModalLead.section || "",
            date: visitDate,
            time: visitTime || "11:00",
            type: "Site Visit",
            requirement: visitModalLead.requirement || "5 kW Solar On-Grid",
            status: "Scheduled",
            notes: `Lead source: ${visitModalLead.source || "Company"}. ${visitNotes || ""}`.trim(),
            leadId: visitModalLead.id,
            ownerUid: user.uid,
          };
          await addRecord(user.uid, FOLLOWUPS_COLLECTION, followupPayload);
        } catch (fErr) {
          console.warn("Could not sync to followups:", fErr);
        }
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === visitModalLead.id ? { ...l, ...payload } : l
        )
      );

      showNotification(
        `Site visit scheduled for ${visitModalLead.name} on ${visitDate}!`,
        "success"
      );
      setVisitModalLead(null);
      setVisitNotes("");
    } catch (err) {
      console.error("Schedule visit error:", err);
      showNotification("Could not schedule site visit.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Quick Action: Add Current Update
  async function handleAddUpdateSubmit(e) {
    e.preventDefault();
    if (!user?.uid || !updateModalLead || !updateText.trim()) return;

    setSaving(true);
    try {
      const updatedHistory = [
        ...(updateModalLead.updates || []),
        {
          id: "upd_" + Date.now(),
          text: updateText.trim(),
          date: new Date().toISOString(),
          by: user.displayName || "Sales rep",
        },
      ];

      const payload = {
        currentUpdate: updateText.trim(),
        updates: updatedHistory,
      };

      await updateRecord(user.uid, COLLECTION, updateModalLead.id, payload);

      setLeads((prev) =>
        prev.map((l) =>
          l.id === updateModalLead.id ? { ...l, ...payload } : l
        )
      );

      showNotification(`Update recorded for ${updateModalLead.name}.`, "success");
      setUpdateModalLead(null);
      setUpdateText("");
    } catch (err) {
      console.error("Add update error:", err);
      showNotification("Could not record update.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Inline Quick Change Stage
  async function handleStageChange(lead, newStage) {
    if (!user?.uid || !lead?.id) return;
    try {
      const stageObj = LEAD_STAGES.find((s) => s.id === newStage);
      const stageLabel = stageObj ? stageObj.label : newStage;

      const newUpdate = `Stage changed to: ${stageLabel}`;
      const updatedHistory = [
        ...(lead.updates || []),
        {
          id: "stage_" + Date.now(),
          text: newUpdate,
          date: new Date().toISOString(),
          by: user.displayName || "Sales rep",
        },
      ];

      const payload = {
        status: newStage,
        currentUpdate: newUpdate,
        updates: updatedHistory,
      };

      await updateRecord(user.uid, COLLECTION, lead.id, payload);
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, ...payload } : l))
      );
      showNotification(`Moved ${lead.name} to "${stageLabel}".`, "info");
    } catch (err) {
      console.error("Stage update error:", err);
    }
  }

  // Delete Lead
  async function handleDeleteLead(lead) {
    if (!user?.uid || !lead?.id) return;
    const ok = window.confirm(`Delete lead "${lead.name}"? This cannot be undone.`);
    if (!ok) return;

    try {
      await deleteRecord(user.uid, COLLECTION, lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      showNotification("Lead removed from system.", "info");
    } catch (err) {
      console.error("Delete error:", err);
      showNotification("Could not delete lead.", "error");
    }
  }

  // Export to CSV
  function exportToCSV() {
    if (leads.length === 0) {
      showNotification("No leads to export.", "warning");
      return;
    }

    const headers = [
      "SOURCE",
      "STATUS",
      "NAME",
      "SECTION",
      "CONTACT DETAILS",
      "CALL STATUS",
      "FIRST CALL DATE",
      "SITE VISIT DATE",
      "CURRENT UPDATE",
      "ASSIGNED TO",
      "GENERATED",
    ];

    const rows = filteredLeads.map((l) => [
      `"${(l.source || "").replace(/"/g, '""')}"`,
      `"${(l.status || "").replace(/"/g, '""')}"`,
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${(l.section || "").replace(/"/g, '""')}"`,
      `"${(l.phone || "").replace(/"/g, '""')}"`,
      `"${(l.callStatus || "").replace(/"/g, '""')}"`,
      `"${(l.firstCallDate || "").replace(/"/g, '""')}"`,
      `"${(l.siteVisitDate ? `${l.siteVisitDate} ${l.siteVisitTime || ""}` : "").replace(/"/g, '""')}"`,
      `"${(l.currentUpdate || "").replace(/"/g, '""')}"`,
      `"${(l.assignedTo || "").replace(/"/g, '""')}"`,
      `"${(l.generatedMonth || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `echonix_sales_leads_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Distinct sections list
  const allSections = useMemo(() => {
    const set = new Set(COMMON_SECTIONS);
    leads.forEach((l) => {
      if (l.section && l.section.trim()) set.add(l.section.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    let list = [...leads];

    // Stage filter
    if (stageFilter === "call_pending") {
      list = list.filter((l) => l.callStatus === "Pending");
    } else if (stageFilter === "visits_due") {
      list = list.filter((l) => l.status === "Visit_Scheduled");
    } else if (stageFilter !== "all") {
      list = list.filter((l) => l.status === stageFilter);
    }

    // Source filter
    if (sourceFilter !== "all") {
      list = list.filter((l) => l.source === sourceFilter);
    }

    // Section filter
    if (sectionFilter !== "all") {
      list = list.filter((l) => l.section === sectionFilter);
    }

    // Call status filter
    if (callStatusFilter !== "all") {
      list = list.filter((l) => l.callStatus === callStatusFilter);
    }

    // Search query
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) => {
        const text = [
          l.name,
          l.phone,
          l.section,
          l.source,
          l.assignedTo,
          l.currentUpdate,
          l.requirement,
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      });
    }

    return list;
  }, [
    leads,
    stageFilter,
    sourceFilter,
    sectionFilter,
    callStatusFilter,
    search,
  ]);

  // Statistics
  const stats = useMemo(() => {
    const total = leads.length;
    const callPending = leads.filter((l) => l.callStatus === "Pending").length;
    const visitsScheduled = leads.filter(
      (l) => l.status === "Visit_Scheduled" || l.visitStatus === "Scheduled"
    ).length;
    const visitsDone = leads.filter(
      (l) => l.status === "Visited" || l.visitStatus === "Completed"
    ).length;
    const won = leads.filter((l) => l.status === "Won").length;
    const lost = leads.filter((l) => l.status === "Lost").length;

    return { total, callPending, visitsScheduled, visitsDone, won, lost };
  }, [leads]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 font-sans">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-50">
            <Users size={13} />
            ECHONIX Lead Pipeline & CRM
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
            Lead Management System
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Track incoming leads from WhatsApp & Sheets, monitor First Calls, schedule Site Visits, and keep live updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Smart WhatsApp/Text Import Button */}
          <button
            type="button"
            onClick={() => {
              setImportText("");
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-teal-700 text-white hover:bg-teal-800 shadow-md shadow-teal-700/20 transition"
          >
            <ClipboardPaste size={16} />
            <span>Smart Import (WhatsApp / Sheet)</span>
          </button>

          {/* Manual Add Lead Button */}
          <button
            type="button"
            onClick={() => {
              setLeadForm(blankLead(user));
              setEditingId(null);
              setShowLeadModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm"
          >
            <Plus size={16} />
            <span>Add Single Lead</span>
          </button>

          {/* Export to CSV */}
          <button
            type="button"
            onClick={exportToCSV}
            title="Export filtered leads to CSV"
            className="inline-flex items-center justify-center p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            <Download size={16} />
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {note.text && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
            note.type === "error"
              ? "bg-rose-50 text-rose-800 border border-rose-200"
              : note.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : note.type === "warning"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-teal-50 text-teal-800 border border-teal-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="shrink-0" />
            <span>{note.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNote({ text: "", type: "info" })}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setStageFilter("all")}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            stageFilter === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-md"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">
            Total Leads
          </p>
          <p className="text-2xl font-black mt-1">{stats.total}</p>
        </div>

        <div
          onClick={() => setStageFilter("call_pending")}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            stageFilter === "call_pending"
              ? "bg-amber-500 text-white border-amber-500 shadow-md"
              : "bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">
              Call Pending
            </p>
            {stats.callPending > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-amber-600 animate-ping" />
            )}
          </div>
          <p className="text-2xl font-black mt-1">{stats.callPending}</p>
        </div>

        <div
          onClick={() => setStageFilter("visits_due")}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            stageFilter === "visits_due"
              ? "bg-teal-600 text-white border-teal-600 shadow-md"
              : "bg-teal-50 text-teal-900 border-teal-200 hover:border-teal-300"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">
            Visits Fixed
          </p>
          <p className="text-2xl font-black mt-1">{stats.visitsScheduled}</p>
        </div>

        <div
          onClick={() => setStageFilter("Visited")}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            stageFilter === "Visited"
              ? "bg-blue-600 text-white border-blue-600 shadow-md"
              : "bg-blue-50 text-blue-900 border-blue-200 hover:border-blue-300"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">
            Survey Done
          </p>
          <p className="text-2xl font-black mt-1">{stats.visitsDone}</p>
        </div>

        <div
          onClick={() => setStageFilter("Won")}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            stageFilter === "Won"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
              : "bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-300"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">
            Closed Won 🏆
          </p>
          <p className="text-2xl font-black mt-1">{stats.won}</p>
        </div>

        <div
          onClick={() => setStageFilter("Lost")}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            stageFilter === "Lost"
              ? "bg-rose-600 text-white border-rose-600 shadow-md"
              : "bg-rose-50 text-rose-900 border-rose-200 hover:border-rose-300"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">
            Lost / Dropped
          </p>
          <p className="text-2xl font-black mt-1">{stats.lost}</p>
        </div>
      </div>

      {/* Control Bar: Filters, Search & View Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone, section (e.g. Valancheri), update..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon size={14} />
              <span>Spreadsheet Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "board"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid size={14} />
              <span>Pipeline Board</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1">
            <Filter size={13} />
            Filters:
          </span>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="all">All Stages</option>
            <option value="call_pending">⏳ Call Pending Only</option>
            <option value="visits_due">📅 Site Visits Scheduled Only</option>
            {LEAD_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="all">All Sources</option>
            {LEAD_SOURCES.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          {/* Section Filter */}
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="all">All Locations / Sections</option>
            {allSections.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>

          {/* Call Status Filter */}
          <select
            value={callStatusFilter}
            onChange={(e) => setCallStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="all">All Call Statuses</option>
            {CALL_STATUSES.map((cs) => (
              <option key={cs.id} value={cs.id}>
                {cs.label}
              </option>
            ))}
          </select>

          {(stageFilter !== "all" ||
            sourceFilter !== "all" ||
            sectionFilter !== "all" ||
            callStatusFilter !== "all" ||
            search) && (
            <button
              type="button"
              onClick={() => {
                setStageFilter("all");
                setSourceFilter("all");
                setSectionFilter("all");
                setCallStatusFilter("all");
                setSearch("");
              }}
              className="text-xs font-bold text-teal-700 hover:text-teal-900 ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Table or Board */}
      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 size={32} className="animate-spin mx-auto mb-3 text-teal-600" />
          <p className="text-sm font-semibold">Loading ECHONIX leads...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto text-teal-700">
            <Users size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {leads.length === 0
                ? "No Leads Added Yet"
                : "No Leads Match the Selected Filters"}
            </h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
              {leads.length === 0
                ? "When the company sends leads via WhatsApp or Excel, click 'Smart Import' to paste and start tracking right away!"
                : "Try clearing your search query or reset your filters."}
            </p>
          </div>
          {leads.length === 0 && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-teal-700 text-white hover:bg-teal-800 shadow-md transition"
            >
              <ClipboardPaste size={16} />
              Import First Leads
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* SPREADSHEET TABLE VIEW (Matches Image 2 exactly!) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-200 font-bold uppercase tracking-wider text-[11px] border-b border-slate-700">
                  <th className="py-3 px-3.5 whitespace-nowrap">Source</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Stage Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Customer Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Section / Area</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Contact Details</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Call Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">First Call</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Site Visit</th>
                  <th className="py-3 px-4 min-w-[200px]">Current Update</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Assign</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => {
                  const stageObj =
                    LEAD_STAGES.find((s) => s.id === lead.status) || LEAD_STAGES[0];
                  const callObj =
                    CALL_STATUSES.find((c) => c.id === lead.callStatus) ||
                    CALL_STATUSES[0];
                  const waUrl = generateLeadWhatsAppUrl(lead, user?.displayName);

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-teal-50/40 transition group"
                    >
                      {/* Source */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {lead.source || "WhatsApp"}
                        </span>
                      </td>

                      {/* Stage Status dropdown */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <select
                          value={lead.status || "New"}
                          onChange={(e) =>
                            handleStageChange(lead, e.target.value)
                          }
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none ${stageObj.badge}`}
                        >
                          {LEAD_STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <strong className="text-slate-900 font-bold block text-sm">
                          {lead.name}
                        </strong>
                        {lead.requirement && (
                          <span className="text-[10px] text-slate-400 block">
                            {lead.requirement}
                          </span>
                        )}
                      </td>

                      {/* Section */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <MapPin size={12} className="text-teal-600 shrink-0" />
                          {lead.section || "—"}
                        </span>
                      </td>

                      {/* Contact Details & Quick Call/WhatsApp */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">
                            {lead.phone}
                          </span>
                          {lead.phone && (
                            <>
                              <a
                                href={`tel:${lead.phone}`}
                                title={`Call ${lead.phone}`}
                                className="p-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                              >
                                <Phone size={13} />
                              </a>
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open WhatsApp chat"
                                className="p-1 rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
                              >
                                <MessageCircle size={13} />
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Call Status Badge */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setCallModalLead(lead);
                            setCallOutcome(lead.callStatus || "Connected");
                            setCallNotes(lead.callNotes || "");
                          }}
                          title="Click to change or log call outcome"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${callObj.badge} hover:shadow-xs`}
                        >
                          <PhoneCall size={10} />
                          <span>{callObj.label}</span>
                        </button>
                      </td>

                      {/* First Call Date */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 font-medium">
                        {lead.firstCallDate || "—"}
                      </td>

                      {/* Site Visit */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {lead.siteVisitDate ? (
                          <div
                            onClick={() => {
                              setVisitModalLead(lead);
                              setVisitDate(lead.siteVisitDate);
                              setVisitTime(lead.siteVisitTime || "11:00");
                            }}
                            className="cursor-pointer group-hover:underline"
                          >
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <CalendarClock size={11} />
                              {lead.siteVisitDate}{" "}
                              {lead.siteVisitTime
                                ? formatTime(lead.siteVisitTime)
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setVisitModalLead(lead);
                              setVisitDate(todayString());
                              setVisitTime("11:00");
                              setVisitNotes("");
                            }}
                            className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline decoration-dashed"
                          >
                            + Set Visit Time
                          </button>
                        )}
                      </td>

                      {/* Current Update */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between gap-2 max-w-xs">
                          <p
                            className="text-xs text-slate-700 line-clamp-2 cursor-pointer hover:text-teal-900"
                            onClick={() => {
                              setUpdateModalLead(lead);
                              setUpdateText(lead.currentUpdate || "");
                            }}
                            title="Click to view full update or add new"
                          >
                            {lead.currentUpdate || "No update logged."}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setUpdateModalLead(lead);
                              setUpdateText("");
                            }}
                            title="Add update note"
                            className="text-slate-400 hover:text-teal-700 p-1"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      </td>

                      {/* Assigned Rep */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-600">
                        {lead.assignedTo || "Ashraf"}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Schedule Visit */}
                          <button
                            type="button"
                            onClick={() => {
                              setVisitModalLead(lead);
                              setVisitDate(lead.siteVisitDate || todayString());
                              setVisitTime(lead.siteVisitTime || "11:00");
                              setVisitNotes(lead.siteVisitNotes || "");
                            }}
                            title="Schedule / update site visit"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                          >
                            <Calendar size={14} />
                          </button>

                          {/* Edit Full Details */}
                          <button
                            type="button"
                            onClick={() => {
                              setLeadForm({
                                ...blankLead(user),
                                ...lead,
                              });
                              setEditingId(lead.id);
                              setShowLeadModal(true);
                            }}
                            title="Edit full lead information"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition"
                          >
                            <Pencil size={14} />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead)}
                            title="Delete lead"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN PIPELINE BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter(
              (l) => l.status === stage.id
            );

            return (
              <div
                key={stage.id}
                className="bg-slate-100/80 rounded-2xl p-3 border border-slate-200/80 space-y-3"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />
                    <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                      {stage.label}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards in column */}
                <div className="space-y-2.5 min-h-[150px]">
                  {stageLeads.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No leads in this stage
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const waUrl = generateLeadWhatsAppUrl(
                        lead,
                        user?.displayName
                      );
                      const callObj =
                        CALL_STATUSES.find((c) => c.id === lead.callStatus) ||
                        CALL_STATUSES[0];

                      return (
                        <div
                          key={lead.id}
                          className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs hover:shadow-md transition space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                                {lead.source || "WhatsApp"}
                              </span>
                              <h4 className="font-black text-slate-900 text-sm mt-1">
                                {lead.name}
                              </h4>
                            </div>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${callObj.badge}`}
                            >
                              {callObj.label}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 space-y-1">
                            <p className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-teal-600 shrink-0" />
                              <strong className="text-slate-800">
                                {lead.section || "Area not specified"}
                              </strong>
                            </p>
                            <p className="flex items-center gap-1.5 font-mono">
                              <Phone size={12} className="text-slate-400 shrink-0" />
                              <span>{lead.phone}</span>
                            </p>
                          </div>

                          {/* Site Visit Indicator */}
                          {lead.siteVisitDate && (
                            <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                              <span className="flex items-center gap-1 font-bold">
                                <CalendarClock size={12} />
                                {lead.siteVisitDate}{" "}
                                {lead.siteVisitTime
                                  ? formatTime(lead.siteVisitTime)
                                  : ""}
                              </span>
                            </div>
                          )}

                          {/* Latest update preview */}
                          {lead.currentUpdate && (
                            <p
                              onClick={() => {
                                setUpdateModalLead(lead);
                                setUpdateText(lead.currentUpdate);
                              }}
                              className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2 cursor-pointer hover:bg-slate-100"
                              title="Click to view update history"
                            >
                              {lead.currentUpdate}
                            </p>
                          )}

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                            {lead.phone && (
                              <a
                                href={`tel:${lead.phone}`}
                                title={`Call ${lead.phone}`}
                                className="flex-1 py-1 px-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-center flex items-center justify-center gap-1 transition"
                              >
                                <Phone size={12} />
                                Call
                              </a>
                            )}
                            {lead.phone && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp chat"
                                className="flex-1 py-1 px-2 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 text-center flex items-center justify-center gap-1 transition"
                              >
                                <MessageCircle size={12} />
                                Chat
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setVisitModalLead(lead);
                                setVisitDate(lead.siteVisitDate || todayString());
                                setVisitTime(lead.siteVisitTime || "11:00");
                                setVisitNotes(lead.siteVisitNotes || "");
                              }}
                              title="Schedule Visit"
                              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <Calendar size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLeadForm({ ...blankLead(user), ...lead });
                                setEditingId(lead.id);
                                setShowLeadModal(true);
                              }}
                              title="Edit"
                              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===============================================================
          MODAL 1: SMART IMPORT (WHATSAPP / EXCEL TEXT PARSER)
      =============================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-teal-50 text-teal-700">
                  <ClipboardPaste size={13} />
                  Instant Parser
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Import Leads from WhatsApp or Sheets
                </h3>
                <p className="text-xs text-slate-500">
                  Paste raw WhatsApp text (e.g. from Sangeetha) or copy-paste rows from Excel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Input options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lead Source
                </label>
                <select
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Assign To Executive
                </label>
                <input
                  type="text"
                  value={importAssign}
                  onChange={(e) => setImportAssign(e.target.value)}
                  placeholder="e.g. Ashraf"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                />
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label className="block font-bold text-slate-700 text-xs mb-1">
                Paste WhatsApp Message / Spreadsheet Text Here:
              </label>
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Paste lines like:\nMIBIN BEERANCIRA 9847397698 10:23 am\nSUNIL KODAKKAL 9656402032 10:23 am\nHAFSATH VETTICHIRA 7034818676 10:23 am\nBEERAN RANDATHANI 9946108417 10:23 am\n\nOr paste rows copied directly from Google Sheets / Excel!`}
                className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
              />
            </div>

            {/* Live Parsed Preview Table */}
            {parsedLeads.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Parsed Leads Preview ({parsedLeads.length} detected):
                  </span>
                  <span className="text-[11px] text-teal-700 font-semibold">
                    You can edit fields inline before importing
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Section / Area</th>
                        <th className="p-2 text-left">Phone</th>
                        <th className="p-2 text-left">Source</th>
                        <th className="p-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedLeads.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedLeads((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, name: val } : p
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 rounded border border-slate-200 font-bold"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={item.section}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedLeads((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, section: val } : p
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 rounded border border-slate-200"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={item.phone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedLeads((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, phone: val } : p
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 rounded border border-slate-200 font-mono font-bold"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={item.source}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedLeads((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, source: val } : p
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 rounded border border-slate-200"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setParsedLeads((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1 text-rose-500 hover:text-rose-700"
                              title="Remove from import"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || parsedLeads.length === 0}
                onClick={handleConfirmImport}
                className="px-5 py-2.5 rounded-xl bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-teal-700/20"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                <span>Import {parsedLeads.length} Lead(s) to Cloud</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===============================================================
          MODAL 2: ADD / EDIT SINGLE LEAD
      =============================================================== */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {editingId ? "Edit Lead Information" : "Add New Solar Lead"}
                </h3>
                <p className="text-xs text-slate-500">
                  Enter customer requirements, location, phone, and lead source.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLeadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Customer Name */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={leadForm.name}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, name: e.target.value })
                    }
                    placeholder="e.g. SHAJI"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 uppercase"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phone / Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    value={leadForm.phone}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, phone: e.target.value })
                    }
                    placeholder="e.g. 9846333320"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>

                {/* Section / Area */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Section / Location
                  </label>
                  <input
                    type="text"
                    list="section-suggestions"
                    value={leadForm.section}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, section: e.target.value })
                    }
                    placeholder="e.g. VALANCHERI"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 uppercase"
                  />
                  <datalist id="section-suggestions">
                    {allSections.map((sec) => (
                      <option key={sec} value={sec} />
                    ))}
                  </datalist>
                </div>

                {/* Source */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lead Source
                  </label>
                  <select
                    value={leadForm.source}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, source: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-teal-500/20"
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pipeline Stage */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pipeline Stage
                  </label>
                  <select
                    value={leadForm.status}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:ring-2 focus:ring-teal-500/20"
                  >
                    {LEAD_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Call Status */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Call Status
                  </label>
                  <select
                    value={leadForm.callStatus}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, callStatus: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-teal-500/20"
                  >
                    {CALL_STATUSES.map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Requirement */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Solar Requirement
                  </label>
                  <input
                    type="text"
                    value={leadForm.requirement}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, requirement: e.target.value })
                    }
                    placeholder="e.g. 5 kW Solar On-Grid"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                  />
                </div>

                {/* Assigned To */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Assigned Executive
                  </label>
                  <input
                    type="text"
                    value={leadForm.assignedTo}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, assignedTo: e.target.value })
                    }
                    placeholder="e.g. ASHRAF"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                  />
                </div>
              </div>

              {/* Current Update */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Current Update / Notes
                </label>
                <textarea
                  rows={2}
                  value={leadForm.currentUpdate}
                  onChange={(e) =>
                    setLeadForm({ ...leadForm, currentUpdate: e.target.value })
                  }
                  placeholder="e.g. Spoke on phone. Customer wants subsidy calculation and 3kW quotation..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLeadModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 font-bold inline-flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingId ? "Update Lead" : "Save Lead"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===============================================================
          MODAL 3: LOG CALL OUTCOME ("Call cheytho?")
      =============================================================== */}
      {callModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800">
                  <PhoneCall size={12} />
                  Log Call Outcome
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {callModalLead.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {callModalLead.phone} ({callModalLead.section || "Area N/A"})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCallModalLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogCallSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Call Outcome / Result:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CALL_STATUSES.map((cs) => (
                    <button
                      key={cs.id}
                      type="button"
                      onClick={() => setCallOutcome(cs.id)}
                      className={`py-2 px-3 rounded-xl border text-left font-bold text-xs transition ${
                        callOutcome === cs.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {cs.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Call Notes / Customer Feedback:
                </label>
                <textarea
                  rows={3}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="e.g. Spoke to customer. Interested in 5kW. Requested callback after 6 PM today."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href={`tel:${callModalLead.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition"
                >
                  <Phone size={13} />
                  Call Again
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCallModalLead(null)}
                    className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800 font-bold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    <span>Save Call Log</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===============================================================
          MODAL 4: SCHEDULE SITE VISIT ("Customer site visit time paranjo?")
      =============================================================== */}
      {visitModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800">
                  <CalendarClock size={12} />
                  Site Visit Scheduling
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Schedule Site Visit
                </h3>
                <p className="text-xs text-slate-500">
                  Customer: <strong>{visitModalLead.name}</strong> •{" "}
                  {visitModalLead.section || "Area N/A"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVisitModalLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleVisitSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Visit Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Visit Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Customer Address / Location Notes:
                </label>
                <input
                  type="text"
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="e.g. Near Beerancira Juma Masjid, 2-storey house"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                />
              </div>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-teal-50 border border-teal-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToFollowups}
                  onChange={(e) => setSyncToFollowups(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span className="text-xs text-teal-950 font-semibold">
                  Sync to <strong>Visits & Follow-ups Calendar</strong> & trigger audio reminder alarms
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVisitModalLead(null)}
                  className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 font-bold inline-flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Confirm Site Visit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===============================================================
          MODAL 5: CURRENT UPDATE & ACTIVITY TIMELINE ("Endhan current update?")
      =============================================================== */}
      {updateModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800">
                  <Zap size={12} />
                  Live Status & Timeline
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Current Update for {updateModalLead.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {updateModalLead.section || "No area"} • {updateModalLead.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUpdateModalLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick snippet chips */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                Quick 1-Click Update Snippets:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_UPDATE_SNIPPETS.map((snippet, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setUpdateText(snippet)}
                    className="text-[10px] font-medium px-2 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-900 text-slate-700 border border-slate-200 transition text-left"
                  >
                    {snippet}
                  </button>
                ))}
              </div>
            </div>

            {/* Add new update */}
            <form onSubmit={handleAddUpdateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Enter Latest Update:
                </label>
                <textarea
                  rows={3}
                  required
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="Type current update here..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !updateText.trim()}
                  className="px-4 py-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800 font-bold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Post Update</span>
                </button>
              </div>
            </form>

            {/* Activity History Timeline */}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-2">
                Activity History & Past Updates:
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {updateModalLead.updates && updateModalLead.updates.length > 0 ? (
                  updateModalLead.updates
                    .slice()
                    .reverse()
                    .map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1"
                      >
                        <p className="font-semibold text-slate-800">
                          {item.text}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(item.date).toLocaleString("en-IN")} • by{" "}
                          {item.by || "Sales rep"}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-slate-400">No previous updates recorded.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
