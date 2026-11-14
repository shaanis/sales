import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Phone,
  PhoneCall,
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
  Flame,
  ArrowUpDown,
  RotateCw,
  FileText,
  MessageSquare,
  CheckCircle,
  SlidersHorizontal,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import RescheduleModal from "../../components/RescheduleModal";
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
  ACTION_TYPES,
  COMMON_SECTIONS,
  QUICK_UPDATE_SNIPPETS,
  blankLead,
  parseLeadsText,
  generateLeadWhatsAppUrl,
} from "./leadsModel";
import {
  scheduleExactAlarms,
  formatTime,
} from "../followups/notificationHelper";

const COLLECTION = "leads";
const FOLLOWUPS_COLLECTION = "followups";

const todayString = () => new Date().toLocaleDateString("en-CA");

export default function LeadsPage() {
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState({ text: "", type: "info" });

  // View mode: 'table' or 'board'
  const [viewMode, setViewMode] = useState("table");
  const [hideEmptyStages, setHideEmptyStages] = useState(true);
  const [boardStageFilter, setBoardStageFilter] = useState("all");

  // Sorting: 'visits_first' | 'newest' | 'calls_pending' | 'alphabetical'
  const [sortBy, setSortBy] = useState("visits_first");

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

  // Action / Site Visit / Follow-up Schedule Modal
  const [actionModalLead, setActionModalLead] = useState(null);
  const [actionType, setActionType] = useState("Site Visit");
  const [actionDate, setActionDate] = useState(todayString());
  const [actionTime, setActionTime] = useState("11:00");
  const [actionNotes, setActionNotes] = useState("");
  const [syncToFollowups, setSyncToFollowups] = useState(true);

  const [updateModalLead, setUpdateModalLead] = useState(null);
  const [updateText, setUpdateText] = useState("");
  const [rescheduleItem, setRescheduleItem] = useState(null);

  const showNotification = (text, type = "info") => {
    setNote({ text, type });
    setTimeout(() => setNote({ text: "", type: "info" }), 5000);
  };

  // Load leads and follow-ups from cloud
  const loadAllData = useCallback(async () => {
    if (!user?.uid) {
      setLeads([]);
      setFollowups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [leadRecords, followupRecords] = await Promise.all([
        listRecords(user.uid, COLLECTION),
        listRecords(user.uid, FOLLOWUPS_COLLECTION).catch(() => []),
      ]);

      const lList = Array.isArray(leadRecords) ? leadRecords : [];
      const fList = Array.isArray(followupRecords) ? followupRecords : [];

      setLeads(lList);
      setFollowups(fList);

      // Register alarms for follow-ups
      scheduleExactAlarms(fList);
    } catch (err) {
      console.error("Failed to load leads/followups:", err);
      showNotification("Could not load leads from cloud.", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

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
          requirement: item.requirement || "",
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
      loadAllData();
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
      loadAllData();
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

  // Open Action / Appointment Modal (Pre-fills existing reminder if available)
  const openActionModal = (lead, defaultType = "Site Visit") => {
    if (!lead) return;
    const existing = followups.find(
      (f) =>
        (f.leadId && f.leadId === lead.id) ||
        (f.phone &&
          lead.phone &&
          f.phone.replace(/\D/g, "") === lead.phone.replace(/\D/g, "") &&
          f.status !== "Completed" &&
          f.status !== "Cancelled")
    );

    setActionModalLead(lead);
    if (existing) {
      setActionType(existing.type || defaultType);
      setActionDate(existing.date || lead.siteVisitDate || todayString());
      setActionTime(existing.time || lead.siteVisitTime || "11:00");
      setActionNotes(existing.notes || lead.siteVisitNotes || "");
    } else {
      setActionType(defaultType);
      setActionDate(lead.siteVisitDate || todayString());
      setActionTime(lead.siteVisitTime || "11:00");
      setActionNotes(lead.siteVisitNotes || "");
    }
  };

  // Quick Action: Schedule or Update Visit/Follow-up Action
  async function handleScheduleActionSubmit(e) {
    e.preventDefault();
    if (!user?.uid || !actionModalLead) return;

    if (!actionDate) {
      showNotification("Please select an appointment date.", "error");
      return;
    }

    setSaving(true);
    try {
      const formattedTimeStr = actionTime ? ` at ${formatTime(actionTime)}` : "";
      const isVisit = actionType === "Site Visit" || actionType === "Re-visit";
      const newUpdate = `📅 ${actionType} Scheduled on ${actionDate}${formattedTimeStr} (${actionModalLead.section || "Site"})${actionNotes ? " - " + actionNotes : ""}`;

      const updatedHistory = [
        ...(actionModalLead.updates || []),
        {
          id: "act_" + Date.now(),
          text: newUpdate,
          date: new Date().toISOString(),
          by: user.displayName || "Sales rep",
        },
      ];

      const leadPayload = {
        ...(isVisit
          ? {
              visitStatus: "Scheduled",
              siteVisitDate: actionDate,
              siteVisitTime: actionTime || "11:00",
              siteVisitNotes: actionNotes.trim(),
              status: "Visit_Scheduled",
            }
          : {}),
        currentUpdate: newUpdate,
        updates: updatedHistory,
      };

      await updateRecord(user.uid, COLLECTION, actionModalLead.id, leadPayload);

      // Auto create or update existing record in 'followups' collection (Fixes duplicate reminders!)
      let wasExistingUpdated = false;
      if (syncToFollowups) {
        try {
          const followupPayload = {
            name: actionModalLead.name,
            phone: actionModalLead.phone,
            area: actionModalLead.section || "",
            date: actionDate,
            time: actionTime || "11:00",
            type: actionType,
            requirement: actionModalLead.requirement || "",
            status: "Scheduled",
            notes: `${actionType} for ${actionModalLead.name}. ${actionNotes || ""}`.trim(),
            leadId: actionModalLead.id,
            ownerUid: user.uid,
          };

          // Find ALL active follow-ups for this lead
          const existingMatches = followups.filter(
            (f) =>
              (f.leadId && f.leadId === actionModalLead.id) ||
              (f.phone &&
                actionModalLead.phone &&
                f.phone.replace(/\D/g, "") === actionModalLead.phone.replace(/\D/g, "") &&
                f.status !== "Completed" &&
                f.status !== "Cancelled")
          );

          let updatedFollowupsList;
          if (existingMatches.length > 0) {
            wasExistingUpdated = true;
            // Update the primary existing reminder
            const primary = existingMatches[0];
            await updateRecord(
              user.uid,
              FOLLOWUPS_COLLECTION,
              primary.id,
              followupPayload
            );

            // Clean up any accidental duplicate records from previous runs
            for (let i = 1; i < existingMatches.length; i++) {
              try {
                await deleteRecord(user.uid, FOLLOWUPS_COLLECTION, existingMatches[i].id);
              } catch (delErr) {
                console.warn("Could not delete duplicate followup:", delErr);
              }
            }

            const duplicateIds = new Set(existingMatches.slice(1).map((m) => m.id));
            updatedFollowupsList = followups
              .filter((f) => !duplicateIds.has(f.id))
              .map((f) =>
                f.id === primary.id ? { ...f, ...followupPayload } : f
              );
          } else {
            // Create a single new reminder
            const newFollowup = await addRecord(
              user.uid,
              FOLLOWUPS_COLLECTION,
              followupPayload
            );
            updatedFollowupsList = [newFollowup, ...followups];
          }

          setFollowups(updatedFollowupsList);
          scheduleExactAlarms(updatedFollowupsList);
        } catch (fErr) {
          console.warn("Could not sync to followups:", fErr);
        }
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === actionModalLead.id ? { ...l, ...leadPayload } : l
        )
      );

      showNotification(
        wasExistingUpdated
          ? `Updated existing appointment for ${actionModalLead.name} to ${actionDate} (${actionTime || "11:00"})!`
          : `${actionType} scheduled for ${actionModalLead.name} on ${actionDate}!`,
        "success"
      );
      setActionModalLead(null);
      setActionNotes("");
    } catch (err) {
      console.error("Schedule action error:", err);
      showNotification("Could not schedule appointment.", "error");
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

      const newUpdate = `Stage moved to: ${stageLabel}`;
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

  // 1-Click Advance to Next Stage
  async function handleAdvanceStage(lead) {
    if (!user?.uid || !lead?.id) return;
    const stageOrder = ["New", "Contacted", "Visit_Scheduled", "Visited", "Proposal", "Won"];
    const currentIdx = stageOrder.indexOf(lead.status);
    if (currentIdx === -1 || currentIdx >= stageOrder.length - 1) {
      showNotification("Lead is already at final stage.", "info");
      return;
    }
    const nextStage = stageOrder[currentIdx + 1];
    await handleStageChange(lead, nextStage);
  }

  // Complete a Today Plan Item (synchronizes Followups + Leads)
  async function handleCompleteTodayPlan(plan) {
    if (!user?.uid || !plan) return;
    setSaving(true);
    try {
      const completedTimestamp = new Date().toISOString();
      const nextStatus = plan.status === "Completed" ? "Scheduled" : "Completed";
      const isCompleted = nextStatus === "Completed";

      // 1. If it's an existing followups record, update it
      if (plan.isFollowupRecord && plan.followupId) {
        await updateRecord(user.uid, FOLLOWUPS_COLLECTION, plan.followupId, {
          status: nextStatus,
          completedAt: isCompleted ? completedTimestamp : null,
        });
        setFollowups((prev) =>
          prev.map((f) =>
            f.id === plan.followupId ? { ...f, status: nextStatus } : f
          )
        );
      }

      // 2. If it's linked to a lead, update CRM lead
      if (plan.leadId) {
        const targetLead = leads.find((l) => l.id === plan.leadId);
        const isVisit = plan.type === "Site Visit" || plan.type === "Re-visit";
        const newUpdateText = isCompleted
          ? `✅ Completed ${plan.type} scheduled for today`
          : `Re-opened ${plan.type}`;

        const leadUpdate = {
          visitStatus: isCompleted ? "Completed" : "Scheduled",
          ...(isCompleted && isVisit ? { status: "Visited" } : {}),
          currentUpdate: newUpdateText,
          updates: [
            ...(targetLead?.updates || []),
            {
              id: "comp_" + Date.now(),
              text: newUpdateText,
              date: completedTimestamp,
              by: user.displayName || "Sales rep",
            },
          ],
        };

        await updateRecord(user.uid, COLLECTION, plan.leadId, leadUpdate);
        setLeads((prev) =>
          prev.map((l) =>
            l.id === plan.leadId ? { ...l, ...leadUpdate } : l
          )
        );
      }

      showNotification(
        isCompleted
          ? `Marked "${plan.name}" (${plan.type}) completed for today! 🎉`
          : `Re-opened "${plan.name}" (${plan.type}).`,
        "success"
      );
    } catch (err) {
      console.error("Complete today plan error:", err);
      showNotification("Could not update task status.", "error");
    } finally {
      setSaving(false);
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

      // Also remove associated reminder from followups collection
      const associatedFollowups = followups.filter(
        (f) =>
          f.leadId === lead.id ||
          (f.phone &&
            lead.phone &&
            f.phone.replace(/\D/g, "") === lead.phone.replace(/\D/g, ""))
      );
      for (const af of associatedFollowups) {
        try {
          await deleteRecord(user.uid, FOLLOWUPS_COLLECTION, af.id);
        } catch (delErr) {
          console.warn("Could not delete associated followup:", delErr);
        }
      }
      setFollowups((prev) =>
        prev.filter(
          (f) =>
            f.leadId !== lead.id &&
            (!lead.phone ||
              !f.phone ||
              f.phone.replace(/\D/g, "") !== lead.phone.replace(/\D/g, ""))
        )
      );

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
      "SOLAR REQUIREMENT",
      "GENERATED",
    ];

    const rows = sortedFilteredLeads.map((l) => [
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
      `"${(l.requirement || "").replace(/"/g, '""')}"`,
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

  // Distinct sources list (Combines default + any custom entered sources)
  const allSourcesList = useMemo(() => {
    const set = new Set(LEAD_SOURCES);
    leads.forEach((l) => {
      if (l.source && l.source.trim()) set.add(l.source.trim());
    });
    return Array.from(set);
  }, [leads]);

  const today = todayString();

  // TODAY'S ACTION PLANS (Site Visits, Follow-up Calls, Document Collection, Re-visits)
  const todayPlans = useMemo(() => {
    const plans = [];

    // 1. From followups collection for today
    followups.forEach((f) => {
      if (f.date === today && f.status !== "Cancelled") {
        plans.push({
          id: f.id,
          isFollowupRecord: true,
          followupId: f.id,
          leadId: f.leadId,
          name: f.name || "Customer",
          phone: f.phone || "",
          area: f.area || "",
          time: f.time || "10:00",
          type: f.type || "Site Visit",
          status: f.status || "Scheduled",
          notes: f.notes || "",
          requirement: f.requirement || "",
        });
      }
    });

    // 2. From leads with siteVisitDate === today (deduplicating if already linked)
    leads.forEach((l) => {
      if (
        l.siteVisitDate === today &&
        l.status !== "Lost" &&
        !plans.some(
          (p) => p.leadId === l.id || (p.phone && p.phone === l.phone)
        )
      ) {
        plans.push({
          id: "lead_visit_" + l.id,
          isFollowupRecord: false,
          leadId: l.id,
          name: l.name,
          phone: l.phone,
          area: l.section,
          time: l.siteVisitTime || "11:00",
          type: "Site Visit",
          status: l.visitStatus === "Completed" ? "Completed" : "Scheduled",
          notes: l.siteVisitNotes || l.currentUpdate || "",
          requirement: l.requirement || "",
        });
      }
    });

    // Sort: PENDING items FIRST, Completed items at the bottom
    return plans.sort((a, b) => {
      const aDone = a.status === "Completed" ? 1 : 0;
      const bDone = b.status === "Completed" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (a.time || "").localeCompare(b.time || "");
    });
  }, [followups, leads, today]);

  const pendingTodayPlans = useMemo(
    () => todayPlans.filter((p) => p.status !== "Completed"),
    [todayPlans]
  );
  const completedTodayPlans = useMemo(
    () => todayPlans.filter((p) => p.status === "Completed"),
    [todayPlans]
  );

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    let list = [...leads];

    // Stage filter
    if (stageFilter === "call_pending") {
      list = list.filter((l) => l.callStatus === "Pending");
    } else if (stageFilter === "visits_due") {
      list = list.filter(
        (l) =>
          l.status === "Visit_Scheduled" ||
          l.visitStatus === "Scheduled" ||
          (l.siteVisitDate && l.siteVisitDate >= today)
      );
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
    today,
  ]);

  // Sort Filtered Leads with High Priority for Scheduled Visits
  const sortedFilteredLeads = useMemo(() => {
    const list = [...filteredLeads];

    if (sortBy === "visits_first") {
      list.sort((a, b) => {
        // Priority Scoring:
        // 4: Scheduled Visit TODAY
        // 3: Scheduled Visit in FUTURE
        // 2: Visit Scheduled stage
        // 1: Call Pending
        // 0: General
        const getScore = (lead) => {
          const vDate = lead.siteVisitDate;
          const isVisitFixed =
            lead.status === "Visit_Scheduled" || lead.visitStatus === "Scheduled";
          if (vDate === today && isVisitFixed) return 4;
          if (vDate && vDate > today && isVisitFixed) return 3;
          if (isVisitFixed) return 2;
          if (lead.callStatus === "Pending") return 1;
          return 0;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Highest score first
        }

        // If both have visit dates, sort by date & time
        if (a.siteVisitDate && b.siteVisitDate && a.siteVisitDate !== b.siteVisitDate) {
          return a.siteVisitDate.localeCompare(b.siteVisitDate);
        }

        return (a.name || "").localeCompare(b.name || "");
      });
    } else if (sortBy === "newest") {
      list.reverse();
    } else if (sortBy === "calls_pending") {
      list.sort((a, b) => {
        const aP = a.callStatus === "Pending" ? 1 : 0;
        const bP = b.callStatus === "Pending" ? 1 : 0;
        return bP - aP;
      });
    } else if (sortBy === "alphabetical") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return list;
  }, [filteredLeads, sortBy, today]);

  // Statistics
  const stats = useMemo(() => {
    const total = leads.length;
    const callPending = leads.filter((l) => l.callStatus === "Pending").length;
    const visitsScheduled = leads.filter(
      (l) =>
        l.status === "Visit_Scheduled" ||
        l.visitStatus === "Scheduled" ||
        (l.siteVisitDate && l.siteVisitDate >= today)
    ).length;
    const visitsDone = leads.filter(
      (l) => l.status === "Visited" || l.visitStatus === "Completed"
    ).length;
    const won = leads.filter((l) => l.status === "Won").length;
    const lost = leads.filter((l) => l.status === "Lost").length;

    return { total, callPending, visitsScheduled, visitsDone, won, lost };
  }, [leads, today]);

  // WhatsApp generator for today's appointment
  function generateTodayAppointmentWa(plan) {
    if (!plan?.phone) return "";
    const phone = plan.phone.replace(/\D/g, "");
    const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
    const timeStr = plan.time ? ` at ${formatTime(plan.time)}` : "";
    const rep = user?.displayName || "ECHONIX Solar";
    const name = plan.name ? `${plan.name} Sir` : "Sir";
    const place = plan.area ? ` at ${plan.area}` : "";

    const msg = `Hello ${name},
Greetings from *ECHONIX Solar*! ☀️
This is ${rep}.

Checking in regarding our scheduled *${plan.type}* today (${today})${timeStr}${place}.

Looking forward to meeting you! Please let me know if any adjustment in timing is required.

Thank you!
*ECHONIX Solar Solutions*`;

    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(
      msg
    )}`;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans px-2 sm:px-4">
      {/* Page Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200">
            <Users size={12} className="text-teal-600" />
            ECHONIX Lead Pipeline &amp; CRM
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
            Lead Management System
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Priority tracking for Site Visits, appointments, WhatsApp lead imports, and live status updates.
          </p>
        </div>

        {/* Top Buttons Bar - Strictly Aligned & Consistent Heights */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full lg:w-auto">
          {/* Quick link to Site Visits & Reminders */}
          <Link
            to="/followups"
            className="h-10 px-3.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition flex items-center justify-center gap-2 active:scale-95"
            title="Open Site Visits & Reminders Calendar"
          >
            <CalendarClock size={15} className="shrink-0" />
            <span className="truncate">Visits &amp; Reminders</span>
            {todayPlans.length > 0 && (
              <span className="bg-white text-amber-900 px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none shrink-0">
                {todayPlans.length}
              </span>
            )}
          </Link>

          {/* Smart WhatsApp/Text Import Button */}
          <button
            type="button"
            onClick={() => {
              setImportText("");
              setShowImportModal(true);
            }}
            className="h-10 px-3.5 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition flex items-center justify-center gap-2 active:scale-95"
          >
            <ClipboardPaste size={15} className="shrink-0" />
            <span className="truncate">Smart Import</span>
          </button>

          {/* Manual Add Lead Button */}
          <button
            type="button"
            onClick={() => {
              setLeadForm(blankLead(user));
              setEditingId(null);
              setShowLeadModal(true);
            }}
            className="h-10 px-3.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={15} className="shrink-0" />
            <span className="truncate">Add Lead</span>
          </button>

          {/* Export to CSV */}
          <button
            type="button"
            onClick={exportToCSV}
            title="Export filtered leads to CSV spreadsheet"
            className="h-10 px-3.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition flex items-center justify-center gap-2 active:scale-95"
          >
            <Download size={15} className="shrink-0" />
            <span className="truncate sm:hidden">Export CSV</span>
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {note.text && (
        <div
          className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
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
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ===============================================================
          TODAY'S SCHEDULE & ACTION PLAN (COMPACT WHEN EMPTY, EXPANDED WHEN ACTIVE)
      =============================================================== */}
      {todayPlans.length === 0 ? (
        <div className="bg-white rounded-2xl px-4 py-2.5 border border-slate-200/90 shadow-2xs flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <CalendarClock size={13} />
            </div>
            <span>No visits or follow-ups scheduled for today ({today}).</span>
          </div>
          <Link
            to="/followups"
            className="text-xs font-bold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 shrink-0"
          >
            <span>Calendar</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                <CalendarClock size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Today&apos;s Action Plan
                  </h2>
                  {pendingTodayPlans.length > 0 ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                      {pendingTodayPlans.length} Pending
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      All Done
                    </span>
                  )}
                  {completedTodayPlans.length > 0 && (
                    <span className="text-xs font-medium text-slate-400">
                      • {completedTodayPlans.length} Completed
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visits, calls, and actions scheduled for today ({today}).
                </p>
              </div>
            </div>

            <Link
              to="/followups"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition shrink-0 self-start sm:self-auto"
            >
              <span>Open Reminders</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="space-y-4">
            {/* PENDING ITEMS - SHOWN FIRST AT THE VERY TOP */}
            {pendingTodayPlans.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingTodayPlans.map((plan) => {
                  const planWa = generateTodayAppointmentWa(plan);

                  return (
                    <div
                      key={plan.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-xs transition flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                            {plan.type}
                          </span>

                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <Clock size={11} />
                            {plan.time ? formatTime(plan.time) : "Today"}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-slate-900">
                            {plan.name}
                          </h4>
                          {plan.area && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                              <MapPin size={11} className="text-slate-400 shrink-0" />
                              <span>{plan.area}</span>
                            </p>
                          )}
                        </div>

                        {plan.notes && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2">
                            {plan.notes}
                          </p>
                        )}
                      </div>

                      {/* Quick Actions (Responsive Flex Bar) */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                        {plan.phone && (
                          <a
                            href={`tel:${plan.phone}`}
                            title={`Call ${plan.name} (${plan.phone})`}
                            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition shrink-0"
                          >
                            <Phone size={13} />
                          </a>
                        )}

                        {plan.phone && planWa && (
                          <a
                            href={planWa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp reminder"
                            className="p-2 rounded-xl text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition shrink-0"
                          >
                            <MessageCircle size={13} />
                          </a>
                        )}

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setRescheduleItem(plan)}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 transition active:scale-95 shadow-xs whitespace-nowrap"
                          title="Customer not home / busy / reschedule date"
                        >
                          <RotateCw size={12} className="text-amber-700" />
                          <span>Reschedule</span>
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleCompleteTodayPlan(plan)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs whitespace-nowrap"
                        >
                          <CheckCircle2 size={13} />
                          <span>Mark Done</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* COMPLETED ITEMS - SHOWN AT THE BOTTOM IN MUTED CLEAN FOLD */}
            {completedTodayPlans.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Completed Today ({completedTodayPlans.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {completedTodayPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-slate-400 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 size={13} className="text-teal-600 shrink-0" />
                        <span className="font-semibold line-through truncate text-slate-500">
                          {plan.name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          ({plan.type})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCompleteTodayPlan(plan)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline shrink-0 font-medium"
                      >
                        Re-open
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Top Metric Cards - Minimal & Compact (Horizontal scroll on mobile to avoid pushing content down) */}
      <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar sm:grid sm:grid-cols-3 lg:grid-cols-6">
        {[
          { id: "all", label: "Total Leads", count: stats.total },
          { id: "visits_due", label: "Visits Due", count: stats.visitsScheduled, isPriority: true },
          { id: "call_pending", label: "Call Pending", count: stats.callPending },
          { id: "Visited", label: "Survey Done", count: stats.visitsDone },
          { id: "Won", label: "Closed Won", count: stats.won },
          { id: "Lost", label: "Lost / Dropped", count: stats.lost },
        ].map((m) => {
          const isSelected = stageFilter === m.id;
          return (
            <div
              key={m.id}
              onClick={() => setStageFilter(m.id)}
              className={`cursor-pointer rounded-2xl p-2.5 sm:p-3 border transition shrink-0 min-w-[120px] sm:min-w-0 ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : m.isPriority && m.count > 0
                  ? "bg-amber-50/60 text-amber-950 border-amber-200 hover:border-amber-300"
                  : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                    isSelected ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {m.label}
                </p>
                {m.isPriority && m.count > 0 && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-lg sm:text-2xl font-black mt-0.5">{m.count}</p>
            </div>
          );
        })}
      </div>

      {/* Control Bar: Filters, Search, Priority Sorting & View Switcher */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
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
              placeholder="Search by customer name, phone, section (Valancheri, Tirur), update..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
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

          {/* Sort Control */}
          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <ArrowUpDown size={14} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-teal-600 text-xs"
            >
              <option value="visits_first">🎯 Priority (Visits First)</option>
              <option value="newest">🕒 Newest First</option>
              <option value="calls_pending">⏳ Calls Pending First</option>
              <option value="alphabetical">🔤 Name (A - Z)</option>
            </select>
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
          <span className="text-slate-400 font-bold flex items-center gap-1 mr-1">
            <Filter size={13} />
            Filters:
          </span>

          {/* Quick Priority Button */}
          <button
            type="button"
            onClick={() =>
              setStageFilter(stageFilter === "visits_due" ? "all" : "visits_due")
            }
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
              stageFilter === "visits_due"
                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
            }`}
          >
            <Flame size={12} />
            <span>Priority Visits ({stats.visitsScheduled})</span>
          </button>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="all">All Stages</option>
            <option value="visits_due">📅 Site Visits Scheduled / Due</option>
            <option value="call_pending">⏳ Call Pending Only</option>
            {LEAD_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Source Filter (Supports custom typed sources) */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="all">All Sources</option>
            {allSourcesList.map((src) => (
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
      ) : sortedFilteredLeads.length === 0 ? (
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
        /* ===============================================================
            UNIFIED SPREADSHEET TABLE VIEW (CLEAN, COMPACT & INVITING)
        =============================================================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-100 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <th className="py-3 px-3 whitespace-nowrap text-center">#</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Customer &amp; System</th>
                  <th className="py-3 px-3 whitespace-nowrap">Location</th>
                  <th className="py-3 px-3 whitespace-nowrap">Phone &amp; Connect</th>
                  <th className="py-3 px-3 whitespace-nowrap">Call Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Pipeline Stage</th>
                  <th className="py-3 px-3 whitespace-nowrap">Site Visit</th>
                  <th className="py-3 px-3.5 min-w-[180px]">Latest Update</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {sortedFilteredLeads.map((lead, idx) => {
                  const stageObj =
                    LEAD_STAGES.find((s) => s.id === lead.status) || LEAD_STAGES[0];
                  const callObj =
                    CALL_STATUSES.find((c) => c.id === lead.callStatus) ||
                    CALL_STATUSES[0];
                  const waUrl = generateLeadWhatsAppUrl(lead, user?.displayName);

                  const isVisitToday =
                    lead.siteVisitDate === today &&
                    (lead.visitStatus === "Scheduled" ||
                      lead.status === "Visit_Scheduled");
                  const hasFutureVisit =
                    lead.siteVisitDate &&
                    lead.siteVisitDate > today &&
                    (lead.visitStatus === "Scheduled" ||
                      lead.status === "Visit_Scheduled");

                  return (
                    <tr
                      key={lead.id}
                      className={`transition group hover:bg-teal-50/40 ${
                        isVisitToday
                          ? "bg-amber-50/50 border-l-4 border-l-amber-500"
                          : hasFutureVisit
                          ? "border-l-4 border-l-teal-500 hover:bg-teal-50/30"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {/* # Index & Source */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Customer & Requirement */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-slate-900 font-bold block text-xs group-hover:text-teal-900">
                            {lead.name}
                          </strong>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {lead.source || "WA"}
                          </span>
                        </div>
                        {lead.requirement && lead.requirement.trim() && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded mt-0.5 border border-teal-200">
                            <Zap size={9} />
                            {lead.requirement}
                          </span>
                        )}
                      </td>

                      {/* Location / Section */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {lead.section && lead.section.trim() && !["—", "-", "area not specified"].includes(lead.section.trim().toLowerCase()) ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 text-xs font-medium">
                            <MapPin size={12} className="text-teal-600 shrink-0" />
                            <span>{lead.section.trim()}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs select-none">—</span>
                        )}
                      </td>

                      {/* Phone & Direct Connect Icons */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {lead.phone}
                          </span>
                          {lead.phone && (
                            <>
                              <a
                                href={`tel:${lead.phone}`}
                                title={`Call ${lead.phone}`}
                                className="p-1 rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                              >
                                <Phone size={12} />
                              </a>
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp Chat"
                                className="p-1 rounded-md text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
                              >
                                <MessageCircle size={12} />
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Call Status Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setCallModalLead(lead);
                            setCallOutcome(lead.callStatus || "Connected");
                            setCallNotes(lead.callNotes || "");
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${callObj.badge} hover:shadow-xs`}
                        >
                          <PhoneCall size={9} />
                          <span>{callObj.label}</span>
                        </button>
                      </td>

                      {/* Pipeline Stage Dropdown with Chevron */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="relative inline-flex items-center">
                          <select
                            value={lead.status || "New"}
                            onChange={(e) =>
                              handleStageChange(lead, e.target.value)
                            }
                            className={`text-[10px] font-bold pl-2.5 pr-5 py-0.5 rounded-lg border appearance-none cursor-pointer focus:outline-none transition ${stageObj.badge}`}
                          >
                            {LEAD_STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                        </div>
                      </td>

                      {/* Site Visit */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {lead.siteVisitDate && lead.siteVisitDate.trim() && lead.siteVisitDate.trim() !== "—" ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openActionModal(lead, "Site Visit")}
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                isVisitToday
                                  ? "bg-amber-500 text-white border-amber-600 animate-pulse"
                                  : "text-amber-900 bg-amber-50 border-amber-200"
                              }`}
                            >
                              <CalendarClock size={10} />
                              <span>{isVisitToday ? "TODAY" : lead.siteVisitDate}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescheduleItem(lead)}
                              title="Reschedule / Postpone site visit"
                              className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition"
                            >
                              <RotateCw size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openActionModal(lead, "Site Visit")}
                            className="text-[10px] text-slate-400 hover:text-amber-700 font-medium"
                          >
                            + Schedule
                          </button>
                        )}
                      </td>

                      {/* Latest Update Note */}
                      <td className="py-2.5 px-3.5">
                        <div
                          onClick={() => {
                            setUpdateModalLead(lead);
                            setUpdateText(lead.currentUpdate || "");
                          }}
                          className="flex items-center justify-between gap-1 max-w-xs cursor-pointer group/note"
                          title="Click to add or view update notes"
                        >
                          {lead.currentUpdate && lead.currentUpdate.trim() && !["no update logged.", "—", "-"].includes(lead.currentUpdate.trim().toLowerCase()) ? (
                            <p className="text-[11px] text-slate-700 line-clamp-1 group-hover/note:text-teal-900 font-medium">
                              {lead.currentUpdate.trim()}
                            </p>
                          ) : (
                            <span className="text-[10px] text-slate-400 group-hover/note:text-teal-700 inline-flex items-center gap-0.5">
                              <Plus size={10} />
                              <span>Add note</span>
                            </span>
                          )}
                          <Pencil size={11} className="text-slate-300 group-hover/note:text-teal-700 shrink-0" />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
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
                            title="View all technical data & edit"
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 transition flex items-center gap-1 border border-slate-200"
                          >
                            <Pencil size={11} />
                            <span>Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead)}
                            title="Delete lead"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 size={13} />
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
        /* ===============================================================
            PIPELINE BOARD VIEW (SLICK, COMPACT & NO EMPTY GAPS)
        =============================================================== */
        <div className="space-y-4">
          {/* Stage Filter Tab Bar (Pills with real-time lead counts) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <button
                type="button"
                onClick={() => setBoardStageFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  boardStageFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>All Active Stages</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20">
                  {sortedFilteredLeads.length}
                </span>
              </button>

              {LEAD_STAGES.map((st) => {
                const count = sortedFilteredLeads.filter(
                  (l) => l.status === st.id
                ).length;
                if (count === 0 && hideEmptyStages && boardStageFilter !== st.id) {
                  return null;
                }
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setBoardStageFilter(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      boardStageFilter === st.id
                        ? "bg-teal-700 text-white shadow-xs"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    <span>{st.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        boardStageFilter === st.id
                          ? "bg-white/20"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Empty Stages Visibility Toggle */}
            <button
              type="button"
              onClick={() => setHideEmptyStages(!hideEmptyStages)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 self-end sm:self-auto px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition shrink-0"
            >
              {hideEmptyStages ? "Show all stages" : "Hide empty stages"}
            </button>
          </div>

          {/* Kanban Lanes - Horizontal Swipeable on Mobile, Side-by-Side on Desktop */}
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory items-start no-scrollbar">
            {LEAD_STAGES.filter((st) => {
              if (boardStageFilter !== "all") return st.id === boardStageFilter;
              const count = sortedFilteredLeads.filter(
                (l) => l.status === st.id
              ).length;
              if (hideEmptyStages && count === 0) return false;
              return true;
            }).map((stage) => {
              const stageLeads = sortedFilteredLeads.filter(
                (l) => l.status === stage.id
              );
              const isVisitStage = stage.id === "Visit_Scheduled";

              return (
                <div
                  key={stage.id}
                  className={`w-[85vw] sm:w-80 shrink-0 snap-start rounded-2xl p-3.5 space-y-3 transition border ${
                    isVisitStage
                      ? "bg-amber-50/30 border-amber-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />
                      <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                        {stage.label}
                      </h3>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        isVisitStage
                          ? "bg-amber-500 text-white border-amber-600"
                          : "bg-white text-slate-700 border-slate-200 shadow-2xs"
                      }`}
                    >
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Cards in column */}
                  <div className="space-y-3">
                    {stageLeads.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-medium">
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
                        const isVisitToday =
                          lead.siteVisitDate === today &&
                          (lead.visitStatus === "Scheduled" ||
                            lead.status === "Visit_Scheduled");

                        const hasSection = Boolean(
                          lead.section &&
                            lead.section.trim() &&
                            lead.section.trim() !== "—" &&
                            lead.section.trim() !== "-" &&
                            lead.section.trim().toLowerCase() !== "area not specified"
                        );
                        const hasRequirement = Boolean(
                          lead.requirement &&
                            lead.requirement.trim() &&
                            lead.requirement.trim() !== "—" &&
                            lead.requirement.trim() !== "-"
                        );
                        const hasVisit = Boolean(
                          lead.siteVisitDate &&
                            lead.siteVisitDate.trim() &&
                            lead.siteVisitDate.trim() !== "—"
                        );
                        const hasPhone = Boolean(
                          lead.phone &&
                            lead.phone.trim() &&
                            lead.phone.trim() !== "—" &&
                            lead.phone.trim() !== "-"
                        );
                        const hasSource = Boolean(
                          lead.source &&
                            lead.source.trim() &&
                            lead.source.trim() !== "—"
                        );
                        const hasCallStatus = Boolean(
                          lead.callStatus && lead.callStatus.trim()
                        );

                        const rawUpdate = lead.currentUpdate
                          ? lead.currentUpdate.trim()
                          : "";
                        const hasCurrentUpdate = Boolean(
                          rawUpdate &&
                            ![
                              "no update logged.",
                              "new lead received from company",
                              "lead recorded in system",
                              "—",
                              "-",
                            ].includes(rawUpdate.toLowerCase())
                        );

                        // Visual Pipeline Stepper Steps
                        const PIPELINE_FLOW = [
                          { id: "New", label: "New" },
                          { id: "Contacted", label: "Talk" },
                          { id: "Visit_Scheduled", label: "Visit" },
                          { id: "Visited", label: "Survey" },
                          { id: "Proposal", label: "Quote" },
                          { id: "Won", label: "Won" },
                        ];
                        const currentStepIndex = PIPELINE_FLOW.findIndex(
                          (p) => p.id === lead.status
                        );

                        return (
                          <div
                            key={lead.id}
                            className={`bg-white rounded-2xl p-3.5 border transition-all duration-150 space-y-3 shadow-xs hover:shadow-md ${
                              isVisitToday
                                ? "border-amber-400 ring-2 ring-amber-400/25"
                                : "border-slate-200"
                            }`}
                          >
                            {/* Visual Progress Stepper for Pipeline */}
                            <div className="bg-slate-50/90 p-1 rounded-xl border border-slate-100 flex items-center justify-between gap-0.5">
                              {PIPELINE_FLOW.map((step, idx) => {
                                const isCurrent = lead.status === step.id;
                                const isPassed = currentStepIndex > idx;
                                return (
                                  <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => handleStageChange(lead, step.id)}
                                    title={`Click to set stage: ${step.label}`}
                                    className={`flex-1 py-1 rounded-lg text-[9px] font-bold text-center transition truncate ${
                                      isCurrent
                                        ? "bg-slate-900 text-white shadow-2xs"
                                        : isPassed
                                        ? "bg-teal-50 text-teal-700"
                                        : "text-slate-400 hover:text-slate-700"
                                    }`}
                                  >
                                    {step.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Badges: Source + Call Status */}
                            {(hasSource || hasCallStatus) && (
                              <div className="flex items-center justify-between gap-2">
                                {hasSource ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    {lead.source.trim()}
                                  </span>
                                ) : (
                                  <span />
                                )}

                                {hasCallStatus && (
                                  <span
                                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${callObj.badge}`}
                                  >
                                    {callObj.label}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Customer Name & Section / Requirement */}
                            <div>
                              <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                                {lead.name}
                              </h4>
                              {(hasSection || hasRequirement) && (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 mt-1">
                                  {hasSection && (
                                    <span className="flex items-center gap-1 font-medium text-slate-700">
                                      <MapPin
                                        size={12}
                                        className="text-teal-700 shrink-0"
                                      />
                                      {lead.section.trim()}
                                    </span>
                                  )}
                                  {hasRequirement && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                      <Zap size={9} />
                                      {lead.requirement.trim()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Scheduled Site Visit Highlight - Only if scheduled */}
                            {hasVisit && (
                              <div
                                onClick={() =>
                                  openActionModal(lead, "Site Visit")
                                }
                                className={`rounded-xl p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer border transition ${
                                  isVisitToday
                                    ? "bg-amber-500 text-white border-amber-600 shadow-xs animate-pulse"
                                    : "bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100"
                                }`}
                                title="Click to view/reschedule visit"
                              >
                                <span className="flex items-center gap-1.5">
                                  <CalendarClock size={13} className="shrink-0" />
                                  <span>
                                    {isVisitToday ? "TODAY" : lead.siteVisitDate}{" "}
                                    {lead.siteVisitTime
                                      ? formatTime(lead.siteVisitTime)
                                      : ""}
                                  </span>
                                </span>
                                <span className="text-[10px] uppercase font-bold underline decoration-dashed">
                                  Edit
                                </span>
                              </div>
                            )}

                            {/* Phone & Quick Contact */}
                            {hasPhone && (
                              <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                                <span className="font-mono font-bold text-slate-800 text-[11px]">
                                  {lead.phone.trim()}
                                </span>
                                <div className="flex items-center gap-1">
                                  <a
                                    href={`tel:${lead.phone.trim()}`}
                                    title={`Call ${lead.phone}`}
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
                                  >
                                    <Phone size={12} />
                                  </a>
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="WhatsApp chat"
                                    className="p-1.5 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition"
                                  >
                                    <MessageCircle size={12} />
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Latest update snippet */}
                            {hasCurrentUpdate && (
                              <p
                                onClick={() => {
                                  setUpdateModalLead(lead);
                                  setUpdateText(lead.currentUpdate);
                                }}
                                className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2 cursor-pointer hover:bg-slate-100 transition"
                                title="Click to view update history"
                              >
                                {lead.currentUpdate}
                              </p>
                            )}

                            {/* 1-Click Advance Stage Button & Actions */}
                            <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 text-xs">
                              {stage.id !== "Won" && stage.id !== "Lost" ? (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStage(lead)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs"
                                  title="Move to next pipeline stage"
                                >
                                  <span>Advance</span>
                                  <ArrowRight size={12} />
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400">
                                  {stage.id === "Won" ? "🎉 Closed Deal" : "Dropped"}
                                </span>
                              )}

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openActionModal(lead, "Site Visit")
                                  }
                                  title="Schedule Visit"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                                >
                                  <Calendar size={14} />
                                </button>
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
                                  title="Edit full lead details"
                                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                                >
                                  Details
                                </button>
                              </div>
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
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-teal-50 text-teal-700">
                  <ClipboardPaste size={13} />
                  Instant Parser
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Import Leads from WhatsApp or Sheets
                </h3>
                <p className="text-xs text-slate-500">
                  Paste raw WhatsApp messages or copy-paste rows from Excel / Google Sheets.
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
                  Lead Source (Select or Type):
                </label>
                <input
                  type="text"
                  list="import-source-list"
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value)}
                  placeholder="e.g. WhatsApp, FB Lead..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                />
                <datalist id="import-source-list">
                  {allSourcesList.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
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
                    Edit fields inline before importing
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
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
          MODAL 2: ADD / EDIT SINGLE LEAD (COMBOBOX SOURCE & OPTIONAL SOLAR REQUIREMENT)
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
                  Enter customer name, phone, area, lead source, and optional solar requirement.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

                {/* Lead Source: Combobox (Dropdown + Direct Typing) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Lead Source
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Select or type custom
                    </span>
                  </div>
                  <input
                    type="text"
                    list="lead-source-suggestions"
                    value={leadForm.source}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, source: e.target.value })
                    }
                    placeholder="Select or type source (e.g. Instagram, Referral)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                  <datalist id="lead-source-suggestions">
                    {allSourcesList.map((src) => (
                      <option key={src} value={src} />
                    ))}
                  </datalist>

                  {/* Quick Source Chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {["WhatsApp", "FB LEAD", "KSEB", "REFERRAL", "DIRECT VISIT"].map(
                      (chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() =>
                            setLeadForm({ ...leadForm, source: chip })
                          }
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition ${
                            leadForm.source?.toUpperCase() === chip.toUpperCase()
                              ? "bg-teal-700 text-white border-teal-700"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {chip}
                        </button>
                      )
                    )}
                  </div>
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

                {/* Solar Requirement: MANUALLY FILLABLE & OPTIONAL (NO 5KW DEFAULT) */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Solar Requirement <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={leadForm.requirement || ""}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, requirement: e.target.value })
                    }
                    placeholder="e.g. 3 kW On-Grid (Leave blank if undecided)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
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
          MODAL 3: LOG CALL OUTCOME
      =============================================================== */}
      {callModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800">
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
                  placeholder="e.g. Spoke to customer. Requested callback after 6 PM today."
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
          MODAL 4: SCHEDULE VISIT OR FOLLOW-UP (INTEGRATED WITH REMINDERS)
      =============================================================== */}
      {actionModalLead && (() => {
        const existingReminder = followups.find(
          (f) =>
            (f.leadId && f.leadId === actionModalLead.id) ||
            (f.phone &&
              actionModalLead.phone &&
              f.phone.replace(/\D/g, "") ===
                actionModalLead.phone.replace(/\D/g, "") &&
              f.status !== "Completed" &&
              f.status !== "Cancelled")
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                    <CalendarClock size={12} />
                    {existingReminder ? "Update Existing Reminder" : "Schedule Appointment"}
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    {actionModalLead.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {actionModalLead.section || "Area N/A"} • {actionModalLead.phone}
                  </p>
                  {existingReminder && (
                    <p className="text-[11px] text-amber-900 font-bold bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-200 inline-block mt-1">
                      Existing reminder for {existingReminder.date} ({existingReminder.time ? formatTime(existingReminder.time) : ""}) will be updated!
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActionModalLead(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleScheduleActionSubmit} className="space-y-3.5 text-xs">
                {/* Activity Type Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Appointment Type:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ACTION_TYPES.map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setActionType(act.id)}
                        className={`p-2 rounded-xl border text-left font-bold text-xs transition ${
                          actionType === act.id
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={actionDate}
                      onChange={(e) => setActionDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={actionTime}
                      onChange={(e) => setActionTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                    />
                  </div>
                </div>

                {/* Address / Notes */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Location / Notes:
                  </label>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="e.g. Near Juma Masjid, roof survey, check KSEB bill"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                  />
                </div>

                {/* Sync Checkbox */}
                <label className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncToFollowups}
                    onChange={(e) => setSyncToFollowups(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span className="text-xs text-amber-950 font-bold">
                    Sync to <strong>Site Visits & Reminders</strong> (Triggers exact-time alarms)
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActionModalLead(null)}
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
                    <span>{existingReminder ? "Update Reminder & Visit" : "Confirm Appointment"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ===============================================================
          MODAL 5: CURRENT UPDATE & ACTIVITY TIMELINE
      =============================================================== */}
      {updateModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-50 text-blue-800">
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

      {/* Reschedule Visit Modal */}
      {rescheduleItem && (
        <RescheduleModal
          isOpen={Boolean(rescheduleItem)}
          item={rescheduleItem}
          onClose={() => setRescheduleItem(null)}
          onSuccess={(updated) => {
            loadAllData();
            showNotification(
              `Site visit for "${updated.name}" has been rescheduled.`,
              "success"
            );
          }}
        />
      )}
    </div>
  );
}
