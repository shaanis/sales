import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Phone,
  MessageCircle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Users,
  Plus,
  Search,
  Trash2,
  Pencil,
  AlertCircle,
  Bell,
  BellRing,
  Sparkles,
  X,
  Loader2,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Volume2,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
  updateRecord,
  deleteRecord,
} from "../../lib/data";
import {
  requestNotificationPermission,
  scheduleExactAlarms,
  testAlarm,
  playAlarmChime,
  formatTime,
  generateGoogleCalendarUrl,
  generateCustomerWhatsAppUrl,
} from "./notificationHelper";
import {
  getSavedGoogleToken,
  connectGoogleCalendar,
  clearGoogleToken,
  createGoogleCalendarEvent,
} from "./googleCalendarService";

const COLLECTION = "followups";

const todayString = () => new Date().toLocaleDateString("en-CA");

const blankFollowup = () => ({
  name: "",
  phone: "",
  area: "",
  date: todayString(),
  time: "10:00",
  type: "Site Visit",
  requirement: "",
  status: "Scheduled",
  notes: "",
});

const TYPE_OPTIONS = [
  "Site Visit",
  "Follow-up Call",
  "Re-visit",
  "Proposal Discussion",
  "Document Collection",
];

const STATUS_COLORS = {
  Scheduled: "bg-amber-50 text-amber-900 border-amber-200",
  Completed: "bg-teal-50 text-teal-800 border-teal-200",
  Rescheduled: "bg-slate-100 text-slate-700 border-slate-200",
  Cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function FollowupsPage() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [crmLeads, setCrmLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankFollowup);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'today' | 'upcoming' | 'completed'
  const [note, setNote] = useState({ text: "", type: "info" });
  const [notifPermission, setNotifPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  // Google Calendar Auto-sync State
  const [googleToken, setGoogleToken] = useState(() => getSavedGoogleToken());
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [autoSyncCalendar, setAutoSyncCalendar] = useState(true);
  const [showGoogleSetupModal, setShowGoogleSetupModal] = useState(false);

  const showNotification = (text, type = "info") => {
    setNote({ text, type });
    setTimeout(() => setNote({ text: "", type: "info" }), 5000);
  };

  // Load follow-ups from Firebase
  const loadFollowups = useCallback(async () => {
    if (!user?.uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [records, leadRecords] = await Promise.all([
        listRecords(user.uid, COLLECTION),
        listRecords(user.uid, "leads").catch(() => []),
      ]);
      const list = Array.isArray(records) ? records : [];
      setItems(list);
      setCrmLeads(Array.isArray(leadRecords) ? leadRecords : []);

      // Schedule exact-second alarms and notifications
      scheduleExactAlarms(list);
    } catch (err) {
      console.error("Failed to load follow-ups:", err);
      showNotification("Could not load follow-ups from cloud.", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  // Request browser notification permission
  async function handleEnableNotifications() {
    const res = await requestNotificationPermission();
    setNotifPermission(res.status);
    if (res.status === "granted") {
      showNotification("Browser reminder notifications enabled!", "success");
      scheduleExactAlarms(items);
    } else {
      showNotification(
        "Notification permission was not granted. You can still view in-app reminders.",
        "warning"
      );
    }
  }

  // Connect Google Calendar for direct background auto-sync
  async function handleConnectGoogle() {
    setConnectingGoogle(true);
    try {
      const res = await connectGoogleCalendar();
      setGoogleToken(res.token);
      setShowGoogleSetupModal(false);
      showNotification(
        "Google Calendar connected! Future site visits will automatically sync to your calendar.",
        "success"
      );
    } catch (err) {
      console.error("Google connect error:", err);
      const isOpNotAllowed =
        err?.code === "auth/operation-not-allowed" ||
        String(err?.message || "").includes("operation-not-allowed");

      if (isOpNotAllowed) {
        setShowGoogleSetupModal(true);
        showNotification(
          "Firebase Console-ൽ Google Sign-in provider enable ചെയ്യേണ്ടതുണ്ട്. Setup നിർദ്ദേശങ്ങൾ താഴെ കാണാം.",
          "warning"
        );
      } else {
        showNotification(
          `Google Calendar connection failed: ${err.message || "Unknown error"}. Popup links will be used instead.`,
          "warning"
        );
      }
    } finally {
      setConnectingGoogle(false);
    }
  }

  // Disconnect Google Calendar
  function handleDisconnectGoogle() {
    clearGoogleToken();
    setGoogleToken(null);
    showNotification("Disconnected from Google Calendar.", "info");
  }

  // Handle form field change
  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Open form for a new entry
  function handleAddNew() {
    setForm(blankFollowup());
    setEditingId(null);
    setFormOpen(true);
  }

  // Open form to edit
  function handleEdit(item) {
    setForm({
      name: item.name || "",
      phone: item.phone || "",
      area: item.area || "",
      date: item.date || todayString(),
      time: item.time || "10:00",
      type: item.type || "Site Visit",
      requirement: item.requirement || "",
      status: item.status || "Scheduled",
      notes: item.notes || "",
    });
    setEditingId(item.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Save or update follow-up & auto-sync to Google Calendar
  async function handleSave(e) {
    e.preventDefault();
    if (!user?.uid) {
      showNotification("Please log in to save.", "error");
      return;
    }

    if (!form.name.trim() || !form.phone.trim()) {
      showNotification(
        "Please provide customer name and phone number.",
        "error"
      );
      return;
    }

    setSaving(true);
    try {
      let googleEventData = {};

      // Prepare Google Calendar URL ahead of time
      const calUrl = generateGoogleCalendarUrl(form);

      // Automatic Google Calendar Sync
      if (autoSyncCalendar) {
        if (googleToken) {
          try {
            // Direct REST API Background Sync
            const gRes = await createGoogleCalendarEvent(googleToken, form);
            if (gRes.success) {
              googleEventData = {
                googleEventId: gRes.eventId,
                googleHtmlLink: gRes.htmlLink,
                syncedToCalendarAt: new Date().toISOString(),
              };
            }
          } catch (calErr) {
            console.warn("Direct Google API sync error:", calErr);
            // Fallback: auto-open Google Calendar pre-filled URL
            window.open(calUrl, "_blank", "noopener,noreferrer");
          }
        } else {
          // If Google OAuth is not connected yet, automatically open Google Calendar event tab
          window.open(calUrl, "_blank", "noopener,noreferrer");
        }
      }

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        area: form.area.trim(),
        date: form.date,
        time: form.time,
        type: form.type,
        requirement: form.requirement.trim(),
        status: form.status,
        notes: form.notes.trim(),
        ownerUid: user.uid,
        ...googleEventData,
      };

      if (editingId) {
        await updateRecord(user.uid, COLLECTION, editingId, payload);
        setItems((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? { ...item, ...payload, id: editingId }
              : item
          )
        );
        showNotification(
          googleEventData.googleEventId
            ? "Follow-up updated and synced with Google Calendar!"
            : "Follow-up updated successfully.",
          "success"
        );
      } else {
        const result = await addRecord(user.uid, COLLECTION, payload);
        setItems((prev) => [result, ...prev]);
        showNotification(
          googleEventData.googleEventId
            ? "New site visit scheduled and automatically saved to Google Calendar!"
            : "New site visit scheduled! Google Calendar opened to confirm.",
          "success"
        );
      }

      setForm(blankFollowup());
      setEditingId(null);
      setFormOpen(false);

      // Schedule exact real-time alarm immediately
      scheduleExactAlarms(
        editingId
          ? items.map((i) => (i.id === editingId ? { ...i, ...payload } : i))
          : [{ ...payload, id: "temp-new" }, ...items]
      );
    } catch (err) {
      console.error("Save error:", err);
      showNotification(`Save failed: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  // Mark status as Completed
  async function markCompleted(item) {
    if (!user?.uid) return;
    const nextStatus = item.status === "Completed" ? "Scheduled" : "Completed";

    try {
      await updateRecord(user.uid, COLLECTION, item.id, {
        status: nextStatus,
        completedAt:
          nextStatus === "Completed" ? new Date().toISOString() : null,
      });

      // Sync to linked CRM lead if present
      if (item.leadId) {
        try {
          const isDone = nextStatus === "Completed";
          const leadUpdate = {
            visitStatus: isDone ? "Completed" : "Scheduled",
            ...(isDone && (item.type === "Site Visit" || item.type === "Re-visit")
              ? { status: "Visited" }
              : {}),
            currentUpdate: isDone
              ? `✅ ${item.type || "Site Visit"} completed via Reminders`
              : `Re-opened ${item.type || "Site Visit"} in Reminders`,
          };
          await updateRecord(user.uid, "leads", item.leadId, leadUpdate);
        } catch (leadErr) {
          console.warn("Could not sync followup to CRM lead:", leadErr);
        }
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: nextStatus } : i
        )
      );

      showNotification(
        nextStatus === "Completed"
          ? `Marked "${item.name}" as Completed.`
          : `Re-opened "${item.name}".`,
        "success"
      );
    } catch (err) {
      console.error("Status update error:", err);
      showNotification("Could not update status.", "error");
    }
  }

  // Delete follow-up
  async function handleDelete(item) {
    if (!user?.uid) return;
    const ok = window.confirm(
      `Delete follow-up with ${item.name} on ${item.date}?`
    );
    if (!ok) return;

    try {
      await deleteRecord(user.uid, COLLECTION, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      showNotification("Follow-up deleted.", "info");
    } catch (err) {
      console.error("Delete error:", err);
      showNotification("Could not delete follow-up.", "error");
    }
  }

  // Categorize counts
  const today = todayString();

  const todayItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.date === today &&
          i.status !== "Completed" &&
          i.status !== "Cancelled"
      ),
    [items, today]
  );

  const upcomingItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.date > today &&
          i.status !== "Completed" &&
          i.status !== "Cancelled"
      ),
    [items, today]
  );

  const completedCount = useMemo(
    () => items.filter((i) => i.status === "Completed").length,
    [items]
  );

  // Filtered list based on search and tab
  const filteredList = useMemo(() => {
    let list = [...items];

    // Filter by tab
    if (filterTab === "today") {
      list = list.filter((i) => i.date === today);
    } else if (filterTab === "upcoming") {
      list = list.filter((i) => i.date >= today && i.status !== "Completed");
    } else if (filterTab === "completed") {
      list = list.filter((i) => i.status === "Completed");
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => {
        const text = [
          i.name,
          i.phone,
          i.area,
          i.type,
          i.requirement,
          i.notes,
          i.date,
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      });
    }

    // Sort: Pending items FIRST, Completed items at the bottom
    return list.sort((a, b) => {
      // 1. Pending/Scheduled (0) before Completed (1)
      const aDone = a.status === "Completed" ? 1 : 0;
      const bDone = b.status === "Completed" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      // 2. Sort by date and time
      if (a.date === b.date) {
        return (a.time || "").localeCompare(b.time || "");
      }
      return (a.date || "").localeCompare(b.date || "");
    });
  }, [items, filterTab, search, today]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-50">
            <CalendarClock size={13} />
            Lead Scheduling & Follow-ups
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
            Site Visits & Reminders
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Schedule customer site visits from call leads, sync to Google
            Calendar & receive timely reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Google Calendar Connection Status Button */}
          {googleToken ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Google Calendar Connected</span>
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="text-slate-400 hover:text-rose-600 underline text-[10px] ml-1"
                title="Disconnect Google account"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connectingGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm"
              title="Connect your Google account for 100% automatic silent background saves"
            >
              {connectingGoogle ? (
                <Loader2 size={14} className="animate-spin text-blue-600" />
              ) : (
                <Calendar size={14} className="text-blue-600" />
              )}
              {connectingGoogle
                ? "Connecting..."
                : "Connect Google Calendar"}
            </button>
          )}

          {notifPermission !== "granted" && (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition"
              title="Enable browser notifications"
            >
              <BellRing size={15} />
              Enable Reminders
            </button>
          )}

          <button
            type="button"
            className="btn primary"
            onClick={handleAddNew}
          >
            <Plus size={16} />
            Schedule Site Visit
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
          } flex items-center justify-between`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {note.type === "error" ? (
              <AlertCircle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{note.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNote({ text: "", type: "info" })}
            className="text-slate-400 hover:text-slate-700 p-0.5"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Google Setup Guide Modal (Shows when auth/operation-not-allowed occurs) */}
      {showGoogleSetupModal && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  Firebase Console-ൽ Google Sign-in Enable ചെയ്യണം (30 Seconds Setup)
                </h3>
                <p className="text-xs text-amber-800">
                  Firebase Error: <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-mono font-bold">auth/operation-not-allowed</code>. 
                  ഇത് പരിഹരിക്കാൻ താഴെയുള്ള സ്റ്റെപ്പുകൾ ചെയ്യുക:
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGoogleSetupModal(false)}
              className="text-amber-800 hover:text-amber-950 p-1"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-white rounded-xl p-3 border border-amber-200 text-xs space-y-1">
              <span className="font-extrabold text-amber-600">Step 1</span>
              <p className="font-semibold text-slate-800">Firebase Console തുറക്കുക</p>
              <p className="text-slate-500 text-[11px]">
                താഴെയുള്ള ബട്ടൺ ക്ലിക്ക് ചെയ്ത് Authentication &gt; Sign-in method പേജിലേക്ക് പോവുക.
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 border border-amber-200 text-xs space-y-1">
              <span className="font-extrabold text-amber-600">Step 2</span>
              <p className="font-semibold text-slate-800">Google Enable ചെയ്യുക</p>
              <p className="text-slate-500 text-[11px]">
                Sign-in providers ലിസ്റ്റിൽ &quot;Google&quot; ക്ലിക്ക് ചെയ്ത് Enable ടോഗിൾ ഓൺ ചെയ്യുക.
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 border border-amber-200 text-xs space-y-1">
              <span className="font-extrabold text-amber-600">Step 3</span>
              <p className="font-semibold text-slate-800">Email തിരഞ്ഞെടുത്ത് Save ചെയ്യുക</p>
              <p className="text-slate-500 text-[11px]">
                Project support email നൽകി Save അമർത്തുക. ശേഷം ഇവിടെ വന്ന് &quot;Connect&quot; ചെയ്യാം!
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="https://console.firebase.google.com/project/sales-report-14e06/authentication/providers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition shadow-sm"
            >
              <span>Open Firebase Sign-in Console</span>
              <ExternalLink size={13} />
            </a>

            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connectingGoogle}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 transition"
            >
              <Calendar size={13} className="text-blue-600" />
              <span>Retry Connect Google Calendar</span>
            </button>

            <span className="text-[11px] text-amber-800 italic">
              💡 ഇത് ചെയ്തില്ലെങ്കിലും നിങ്ങൾ ലീഡ് ഷെഡ്യൂൾ ചെയ്യുമ്പോൾ Google Calendar തനിയെ തുറന്നുവന്ന് സേവ് ചെയ്യാനാകും!
            </span>
          </div>
        </div>
      )}

      {/* Today's Urgent Reminder Alert Card */}
      {todayItems.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
                  Today&apos;s Follow-ups & Site Visits ({todayItems.length} Due)
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  You have appointments scheduled for today. Contact customers
                  or complete visits below.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFilterTab("today")}
              className="text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition self-start sm:self-auto"
            >
              View Today&apos;s List →
            </button>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setFilterTab("today")}
          className={`cursor-pointer rounded-2xl border p-4 bg-white transition hover:shadow-sm ${
            filterTab === "today"
              ? "border-amber-400 ring-2 ring-amber-400/20"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Due Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <strong className="text-2xl font-extrabold text-amber-600 block mt-2">
            {todayItems.length}
          </strong>
          <small className="text-[11px] text-slate-400">
            Scheduled for today
          </small>
        </div>

        <div
          onClick={() => setFilterTab("upcoming")}
          className={`cursor-pointer rounded-2xl border p-4 bg-white transition hover:shadow-sm ${
            filterTab === "upcoming"
              ? "border-teal-400 ring-2 ring-teal-400/20"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Upcoming
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Calendar size={16} />
            </div>
          </div>
          <strong className="text-2xl font-extrabold text-slate-900 block mt-2">
            {upcomingItems.length}
          </strong>
          <small className="text-[11px] text-slate-400">
            Future appointments
          </small>
        </div>

        <div
          onClick={() => setFilterTab("completed")}
          className={`cursor-pointer rounded-2xl border p-4 bg-white transition hover:shadow-sm ${
            filterTab === "completed"
              ? "border-teal-500 ring-2 ring-teal-500/20"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <strong className="text-2xl font-extrabold text-teal-700 block mt-2">
            {completedCount}
          </strong>
          <small className="text-[11px] text-slate-400">
            Visits marked done
          </small>
        </div>

        <div
          onClick={() => setFilterTab("all")}
          className={`cursor-pointer rounded-2xl border p-4 bg-white transition hover:shadow-sm ${
            filterTab === "all"
              ? "border-slate-800 ring-2 ring-slate-800/20"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Leads
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <User size={16} />
            </div>
          </div>
          <strong className="text-2xl font-extrabold text-slate-900 block mt-2">
            {items.length}
          </strong>
          <small className="text-[11px] text-slate-400">
            All registered follow-ups
          </small>
        </div>
      </div>

      {/* Schedule / Edit Form Panel */}
      {formOpen && (
        <section className="bg-white rounded-2xl border border-teal-200 shadow-md p-5 sm:p-6 transition-all">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="text-teal-600" size={20} />
                {editingId
                  ? "Edit Site Visit / Follow-up"
                  : "Schedule New Site Visit"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter lead details, appointment date, time, and customer
                requirement.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            {crmLeads.length > 0 && !editingId && (
              <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-200/80">
                <label className="block text-xs font-bold text-teal-900 mb-1 flex items-center gap-1.5">
                  <Users size={14} className="text-teal-700" />
                  <span>Choose from Lead Management System (Auto-fills details):</span>
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const selected = crmLeads.find((l) => l.id === e.target.value);
                    if (selected) {
                      setField("name", selected.name || "");
                      setField("phone", selected.phone || "");
                      setField("area", selected.section || "");
                      if (selected.requirement) setField("requirement", selected.requirement);
                      setField("leadId", selected.id);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-teal-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">-- Or select an existing CRM Lead --</option>
                  {crmLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.section ? `(${l.section})` : ""} - {l.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer / Lead Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Ashraf Vendallur"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="e.g. 9846012345"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Area / Site Location
                </label>
                <input
                  type="text"
                  value={form.area}
                  onChange={(e) => setField("area", e.target.value)}
                  placeholder="e.g. Kuttippuram, Near KSEB"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Visit / Follow-up Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setField("date", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Scheduled Time
                </label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setField("time", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Activity Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setField("type", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15 bg-white"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Capacity / Requirement <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={form.requirement}
                  onChange={(e) => setField("requirement", e.target.value)}
                  placeholder="e.g. 3 kW On-grid (Optional)"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15 bg-white"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Rescheduled">Rescheduled</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Call Remarks / Customer Notes
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="e.g. Customer requested morning visit after 10 AM. Interested in subsidy details."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15"
              />
            </div>

            {/* Google Calendar Auto-Sync Option */}
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={autoSyncCalendar}
                  onChange={(e) => setAutoSyncCalendar(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="flex items-center gap-1.5">
                  <Calendar size={15} className="text-blue-600" />
                  {googleToken
                    ? "Automatically save this appointment to Google Calendar"
                    : "Auto-open Google Calendar on save to confirm"}
                </span>
              </label>

              {!googleToken && (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={connectingGoogle}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline self-start sm:self-auto"
                >
                  {connectingGoogle
                    ? "Connecting..."
                    : "Connect Google Account for 100% silent save"}
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                }}
                className="btn secondary"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : editingId ? (
                  <>
                    <CheckCircle2 size={16} />
                    Update Follow-up
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Schedule Appointment
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Content List Panel */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Toolbar & Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-slate-50/50">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterTab === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("today")}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                filterTab === "today"
                  ? "bg-white text-amber-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock size={13} className="text-amber-600" />
              Today ({todayItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("upcoming")}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterTab === "upcoming"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Upcoming ({upcomingItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("completed")}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterTab === "completed"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-72">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, area, phone..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-sm gap-3">
            <Loader2 className="animate-spin text-teal-600" size={28} />
            <p>Loading site visits and follow-ups...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CalendarClock size={22} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {search
                ? "No follow-ups match your search"
                : filterTab === "today"
                  ? "No site visits or calls scheduled for today"
                  : "No follow-up leads yet"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              When a lead gives a date and time for a site visit or callback,
              click &quot;Schedule Site Visit&quot; to keep reminders.
            </p>
            <button
              type="button"
              onClick={handleAddNew}
              className="btn primary mt-4"
            >
              <Plus size={15} />
              Add First Follow-up
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredList.map((item) => {
              const isToday = item.date === today;
              const isDone = item.status === "Completed";
              const googleCalUrl = generateGoogleCalendarUrl(item);
              const waUrl = generateCustomerWhatsAppUrl(
                item,
                user?.displayName
              );

              return (
                <article
                  key={item.id}
                  className={`p-4 sm:p-5 transition hover:bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isToday && !isDone ? "bg-amber-50/30" : ""
                  }`}
                >
                  {/* Lead Info */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`font-bold text-sm sm:text-base ${
                          isDone
                            ? "text-slate-400 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {item.name}
                      </h4>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          STATUS_COLORS[item.status] ||
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.status}
                      </span>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {item.type}
                      </span>

                      {isToday && !isDone && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                          DUE TODAY
                        </span>
                      )}

                      {item.googleHtmlLink && (
                        <a
                          href={item.googleHtmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-100 transition"
                          title="View event in Google Calendar"
                        >
                          <Calendar size={11} />
                          Synced to Google
                          <ExternalLink size={9} />
                        </a>
                      )}

                      {item.leadId && (
                        <Link
                          to={`/leads?search=${encodeURIComponent(item.name || item.phone || "")}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full hover:bg-teal-100 transition"
                          title="View customer in Lead Management System"
                        >
                          <Users size={11} />
                          CRM Lead
                        </Link>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                      <div className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{formatDate(item.date)}</span>
                        {item.time && (
                          <span className="text-teal-700 font-semibold">
                            at {formatTime(item.time)}
                          </span>
                        )}
                      </div>

                      {item.area && (
                        <div className="inline-flex items-center gap-1">
                          <MapPin size={13} className="text-slate-400" />
                          <span>{item.area}</span>
                        </div>
                      )}

                      {item.requirement && (
                        <div className="inline-flex items-center gap-1 text-slate-600">
                          <Sparkles size={12} className="text-amber-500" />
                          <span>{item.requirement}</span>
                        </div>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 mt-1">
                        <strong>Notes:</strong> {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto shrink-0">
                    {/* Direct Phone Call */}
                    {item.phone && (
                      <a
                        href={`tel:${item.phone}`}
                        title={`Call ${item.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
                      >
                        <Phone size={13} />
                        Call
                      </a>
                    )}

                    {/* WhatsApp confirmation */}
                    {item.phone && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Send visit confirmation on WhatsApp"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition"
                      >
                        <MessageCircle size={13} />
                        WhatsApp
                      </a>
                    )}

                    {/* Google Calendar sync (Alarm reminder on mobile) */}
                    <a
                      href={item.googleHtmlLink || googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={
                        item.googleHtmlLink
                          ? "Open in Google Calendar"
                          : "Save to Google Calendar for phone alarm"
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
                    >
                      <CalendarPlus size={13} />
                      Calendar
                    </a>

                    {/* Mark Completed Toggle */}
                    <button
                      type="button"
                      onClick={() => markCompleted(item)}
                      title={isDone ? "Re-open" : "Mark as Completed"}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        isDone
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200"
                          : "bg-slate-900 text-white hover:bg-slate-800 border-slate-900 shadow-xs"
                      }`}
                    >
                      <Check size={13} />
                      {isDone ? "Done" : "Complete"}
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      title="Edit or Reschedule"
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                    >
                      <Pencil size={15} />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      title="Delete follow-up"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Footer info */}
        {!loading && filteredList.length > 0 && (
          <footer className="p-3.5 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-400 text-center sm:text-right font-medium">
            Showing {filteredList.length} of {items.length} total scheduled leads
          </footer>
        )}
      </section>
    </div>
  );
}
