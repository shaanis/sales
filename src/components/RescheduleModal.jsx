import React, { useState } from "react";
import {
  CalendarClock,
  Clock,
  Calendar,
  MapPin,
  Phone,
  MessageCircle,
  X,
  Check,
  Loader2,
  AlertCircle,
  CalendarPlus,
  Home,
  Briefcase,
  CalendarDays,
  PhoneCall,
  Car,
  XCircle,
} from "lucide-react";

import { useAuth } from "../features/auth/AuthProvider";
import { listRecords, updateRecord, addRecord } from "../lib/data";
import {
  formatTime,
  generateRescheduledWhatsAppUrl,
  scheduleExactAlarms,
} from "../features/followups/notificationHelper";
import {
  getSavedGoogleToken,
  createGoogleCalendarEvent,
} from "../features/followups/googleCalendarService";

const todayString = () => new Date().toLocaleDateString("en-CA");

const getOffsetDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};

const getNextDayOfWeek = (targetDay) => {
  // 0 = Sunday, 1 = Monday, etc.
  const d = new Date();
  const current = d.getDay();
  let diff = (targetDay - current + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-CA");
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const REASON_OPTIONS = [
  {
    id: "Customer Not at Home",
    label: "Customer Not at Home",
    sub: "Not available at site",
    icon: Home,
    color: "amber",
  },
  {
    id: "Customer Busy / At Work",
    label: "Customer Busy",
    sub: "In office or meeting",
    icon: Briefcase,
    color: "blue",
  },
  {
    id: "Customer Postponed Date",
    label: "Date Postponed",
    sub: "Requested another date",
    icon: CalendarDays,
    color: "teal",
  },
  {
    id: "Asked to Call Later",
    label: "Call Back Later",
    sub: "Will confirm on callback",
    icon: PhoneCall,
    color: "purple",
  },
  {
    id: "Executive Route Delay",
    label: "Route Delay",
    sub: "Schedule conflict",
    icon: Car,
    color: "slate",
  },
  {
    id: "Not Interested Right Now",
    label: "Not Interested Now",
    sub: "Deal on hold / paused",
    icon: XCircle,
    color: "rose",
  },
];

export default function RescheduleModal({
  isOpen,
  item,
  onClose,
  onSuccess,
}) {
  const { user } = useAuth();

  const [selectedReason, setSelectedReason] = useState("Customer Not at Home");
  const [customNote, setCustomNote] = useState("");
  const [isDateFixed, setIsDateFixed] = useState(true);
  const [newDate, setNewDate] = useState(() => getOffsetDate(1)); // Default tomorrow
  const [newTime, setNewTime] = useState(() => item?.time || "10:30");
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !item) return null;

  const today = todayString();
  const customerName = item.name || "Customer";
  const customerPhone = item.phone || "";
  const customerArea = item.area || item.section || "";
  const currentScheduledDate = item.date || today;
  const currentScheduledTime = item.time || "";

  // Quick Date Chips in English
  const datePresets = [
    { label: "Tomorrow", value: getOffsetDate(1) },
    { label: "Day After", value: getOffsetDate(2) },
    { label: "In 3 Days", value: getOffsetDate(3) },
    { label: "This Sunday", value: getNextDayOfWeek(0) },
    { label: "Next Monday", value: getNextDayOfWeek(1) },
  ];

  // Quick Time Chips
  const timePresets = ["09:30", "10:30", "11:30", "14:30", "16:00", "17:30"];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user?.uid) {
      setErrorMsg("Please log in to reschedule.");
      return;
    }

    if (isDateFixed && !newDate) {
      setErrorMsg("Please select a new appointment date.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const nowIso = new Date().toISOString();
      const reasonText = selectedReason;
      const combinedNotes = customNote.trim();

      // Formatted audit note in English
      const dateChangeNotice = isDateFixed
        ? `Rescheduled to ${formatDateDisplay(newDate)}${newTime ? ` at ${formatTime(newTime)}` : ""}`
        : "Postponed (New date pending confirmation)";

      const auditLog = `[Postponed: ${reasonText} on ${formatDateDisplay(today)}] ${dateChangeNotice}${combinedNotes ? ` - ${combinedNotes}` : ""}`;

      let googleEventData = {};
      const updatedItemData = {
        ...item,
        name: customerName,
        phone: customerPhone,
        area: customerArea,
        date: isDateFixed ? newDate : item.date,
        time: isDateFixed ? newTime : item.time,
        type: item.type || "Site Visit",
        requirement: item.requirement || "",
        status: "Rescheduled",
      };

      // 1. Google Calendar Auto-sync (if new date chosen)
      if (isDateFixed && syncGoogle) {
        const token = getSavedGoogleToken();
        if (token) {
          try {
            const gRes = await createGoogleCalendarEvent(token, updatedItemData);
            if (gRes.success) {
              googleEventData = {
                googleEventId: gRes.eventId,
                googleHtmlLink: gRes.htmlLink,
                syncedToCalendarAt: nowIso,
              };
            }
          } catch (calErr) {
            console.warn("Could not sync to Google Calendar API:", calErr);
          }
        }
      }

      // 2. Update Followups Record
      let followupTargetId = item.followupId || (item.leadId ? null : item.id);

      // Search if there's an existing followups record for this lead/phone
      const existingFollowups = await listRecords(user.uid, "followups").catch(() => []);
      const matchedFollowup = existingFollowups.find(
        (f) =>
          f.id === followupTargetId ||
          (item.leadId && f.leadId === item.leadId) ||
          (customerPhone &&
            f.phone &&
            f.phone.replace(/\D/g, "") === customerPhone.replace(/\D/g, "") &&
            f.status !== "Completed" &&
            f.status !== "Cancelled")
      );

      const followupPayload = {
        name: customerName,
        phone: customerPhone,
        area: customerArea,
        date: isDateFixed ? newDate : item.date || today,
        time: isDateFixed ? newTime : item.time || "10:00",
        type: item.type || "Site Visit",
        requirement: item.requirement || "",
        status: "Rescheduled",
        rescheduledFrom: currentScheduledDate,
        rescheduledReason: reasonText,
        rescheduledAt: nowIso,
        notes: item.notes ? `${item.notes}\n${auditLog}` : auditLog,
        ownerUid: user.uid,
        ...googleEventData,
      };

      if (matchedFollowup) {
        await updateRecord(user.uid, "followups", matchedFollowup.id, followupPayload);
      } else if (item.isFollowupRecord || !item.leadId) {
        if (item.id) {
          await updateRecord(user.uid, "followups", item.id, followupPayload);
        } else {
          await addRecord(user.uid, "followups", followupPayload);
        }
      } else if (isDateFixed) {
        // Create follow-up so alarms and notifications trigger on the new date
        await addRecord(user.uid, "followups", {
          ...followupPayload,
          leadId: item.leadId || item.id,
        });
      }

      // 3. Update Leads Collection Record (if linked or if item is a lead)
      const targetLeadId = item.leadId || (item.updates ? item.id : null);
      let matchedLeadId = targetLeadId;

      if (!matchedLeadId && customerPhone) {
        const allLeads = await listRecords(user.uid, "leads").catch(() => []);
        const found = allLeads.find(
          (l) =>
            l.phone &&
            customerPhone &&
            l.phone.replace(/\D/g, "") === customerPhone.replace(/\D/g, "")
        );
        if (found) matchedLeadId = found.id;
      }

      if (matchedLeadId) {
        const currentLeadList = await listRecords(user.uid, "leads").catch(() => []);
        const targetLead = currentLeadList.find((l) => l.id === matchedLeadId);

        const newLeadUpdateText = `⚠️ Site visit postponed (${reasonText}): ${dateChangeNotice}`;

        const leadPayload = {
          visitStatus: "Rescheduled",
          ...(isDateFixed
            ? {
                siteVisitDate: newDate,
                siteVisitTime: newTime,
                siteVisitNotes: auditLog,
              }
            : {}),
          currentUpdate: newLeadUpdateText,
          updates: [
            ...(targetLead?.updates || []),
            {
              id: "resched_" + Date.now(),
              text: newLeadUpdateText,
              date: nowIso,
              by: user.displayName || "Sales rep",
            },
          ],
        };

        await updateRecord(user.uid, "leads", matchedLeadId, leadPayload);
      }

      // 4. Update Alarm Schedulers immediately
      const refreshedList = await listRecords(user.uid, "followups").catch(() => []);
      scheduleExactAlarms(refreshedList);

      if (typeof onSuccess === "function") {
        onSuccess({
          ...updatedItemData,
          reasonText,
          auditLog,
        });
      }

      onClose();
    } catch (err) {
      console.error("Reschedule failed:", err);
      setErrorMsg(`Reschedule failed: ${err.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  // Pre-generated WhatsApp Confirmation URL in English
  const waUrl = generateRescheduledWhatsAppUrl(
    item,
    isDateFixed ? newDate : null,
    isDateFixed ? newTime : null,
    selectedReason,
    user?.displayName
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 my-auto animate-scale-in">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-teal-600 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner shrink-0">
              <CalendarClock size={22} className="text-white" />
            </div>
            <div>
              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-widest uppercase bg-white/25 text-white">
                Site Visit Postponed / Reschedule
              </span>
              <h3 className="text-base sm:text-xl font-black tracking-tight leading-tight mt-0.5">
                Reschedule Site Visit
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lead / Current Appointment Context Bar */}
        <div className="bg-amber-50/70 border-b border-amber-200/80 px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 text-xs">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
              Customer Details
            </span>
            <strong className="text-xs sm:text-sm font-extrabold text-slate-900 truncate block">
              {customerName}
            </strong>
            <div className="flex items-center gap-2 text-slate-600 mt-0.5 text-[10px] sm:text-[11px] truncate">
              {customerArea && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={11} className="text-teal-600 shrink-0" />
                  <span className="truncate">{customerArea}</span>
                </span>
              )}
              {customerPhone && (
                <span className="flex items-center gap-0.5 text-slate-500">
                  <Phone size={11} className="shrink-0" />
                  <span>{customerPhone}</span>
                </span>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Scheduled For
            </span>
            <span className="font-extrabold text-amber-900 block text-xs">
              {formatDateDisplay(currentScheduledDate)}
            </span>
            {currentScheduledTime && (
              <span className="text-[10px] font-bold text-teal-700 block">
                {formatTime(currentScheduledTime)}
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 max-h-[72vh] overflow-y-auto no-scrollbar">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 1: Reason for Rescheduling */}
          <div>
            <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
              1. Reason for Rescheduling *
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REASON_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const isSelected = selectedReason === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedReason(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 active:scale-[0.98] ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-xs"
                        : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <IconComp
                        size={15}
                        className={isSelected ? "text-amber-600" : "text-slate-400"}
                      />
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="block text-xs leading-tight">
                        {opt.label}
                      </span>
                      <small className="block text-[10px] text-slate-500 font-normal leading-tight mt-0.5">
                        {opt.sub}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Call Notes / Reason Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Call Remarks / Customer Feedback:
            </label>
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Customer is out of town until Monday. Requested morning visit."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15"
            />
          </div>

          {/* Step 2: New Visit Date & Time */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-black text-slate-900 uppercase tracking-wider">
                2. New Visit Schedule
              </label>

              {/* Toggle Date Decided vs Pending */}
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={!isDateFixed}
                  onChange={(e) => setIsDateFixed(!e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Date not decided yet</span>
              </label>
            </div>

            {isDateFixed ? (
              <div className="space-y-3 pt-1">
                {/* 1-Tap Quick Date Chips */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Quick Pick Date:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {datePresets.map((dp) => {
                      const isChosen = newDate === dp.value;
                      return (
                        <button
                          key={dp.label}
                          type="button"
                          onClick={() => setNewDate(dp.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95 ${
                            isChosen
                              ? "bg-amber-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {dp.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Exact Date & Time Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      New Date *
                    </label>
                    <input
                      type="date"
                      required={isDateFixed}
                      min={today}
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      New Time
                    </label>
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15"
                    />
                  </div>
                </div>

                {/* Quick Time Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400">Time:</span>
                  {timePresets.map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setNewTime(tp)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        newTime === tp
                          ? "bg-teal-700 text-white font-bold"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {formatTime(tp)}
                    </button>
                  ))}
                </div>

                {/* Google Calendar Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={syncGoogle}
                    onChange={(e) => setSyncGoogle(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="flex items-center gap-1.5">
                    <CalendarPlus size={14} className="text-blue-600" />
                    <span>Sync updated schedule to Google Calendar for alarm</span>
                  </span>
                </label>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-100/60 text-amber-900 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-700 shrink-0" />
                  <span>Visit Postponed without Fixed Date</span>
                </p>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  This item will be removed from today&apos;s active reminder list and safely stored under the &quot;Rescheduled&quot; tab. You can call the customer later to confirm a new date.
                </p>
              </div>
            )}
          </div>

          {/* Step 3: Quick WhatsApp Notification to Customer */}
          {customerPhone && (
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-xs font-bold text-emerald-950 truncate">
                  Send WhatsApp Confirmation
                </span>
                <span className="block text-[10px] text-emerald-700 truncate">
                  {isDateFixed
                    ? `Notify customer of revised date (${formatDateDisplay(newDate)})`
                    : "Notify customer that visit has been postponed"}
                </span>
              </div>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 transition shrink-0 shadow-xs active:scale-95"
              >
                <MessageCircle size={14} />
                <span>Send WhatsApp</span>
              </a>
            </div>
          )}

          {/* Form Actions (Full width buttons on mobile) */}
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition text-center"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>
                    {isDateFixed
                      ? `Confirm Reschedule`
                      : "Save as Postponed"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
