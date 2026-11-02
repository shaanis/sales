
import React, { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  MessageCircle,
  Users,
  CheckCircle2,
  UsersRound,
  Loader2,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import {
  addRecord,
  listRecords,
  deleteRecord,
} from "../../lib/data";

const MEMBER_COLLECTION = "whatsappMembers";

export default function WhatsAppGroupPage() {
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");

  const [groupName, setGroupName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Load Back Office members from Firebase
  useEffect(() => {
    if (!user?.uid) return;

    let active = true;

    async function loadMembers() {
      setLoading(true);

      try {
        const result = await listRecords(
          user.uid,
          MEMBER_COLLECTION
        );

        if (active) {
          setMembers(result);
        }
      } catch (err) {
        console.error("Failed to load members:", err);

        if (active) {
          setError("Unable to load Back Office members.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMembers();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  // Add member
  async function addMember(e) {
    e.preventDefault();

    const phone = memberPhone.replace(/\D/g, "");

    if (!memberName.trim() || phone.length < 10) {
      setError("Enter a valid name and WhatsApp number.");
      return;
    }

    if (members.some((m) => m.phone === phone)) {
      setError("This WhatsApp number already exists.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const saved = await addRecord(
        user.uid,
        MEMBER_COLLECTION,
        {
          name: memberName.trim(),
          phone,
        }
      );

      setMembers((prev) => [...prev, saved]);

      setMemberName("");
      setMemberPhone("");

      setNotice("Back Office member added successfully!");
    } catch (err) {
      console.error("Add member failed:", err);
      setError("Failed to save member. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Delete member
  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.name}?`)) return;

    setError("");
    setNotice("");

    try {
      await deleteRecord(
        user.uid,
        MEMBER_COLLECTION,
        member.id
      );

      setMembers((prev) =>
        prev.filter((m) => m.id !== member.id)
      );

      setNotice("Member removed successfully.");
    } catch (err) {
      console.error("Delete member failed:", err);
      setError("Unable to delete member.");
    }
  }

  // Validate and prepare numbers
  function getParticipantNumbers() {
    const customer = customerPhone.replace(/\D/g, "");

    if (customer.length < 10) {
      throw new Error("Enter a valid customer WhatsApp number.");
    }

    if (members.length === 0) {
      throw new Error("Add Back Office members first.");
    }

    return [
      ...new Set([
        customer,
        ...members.map((m) => m.phone),
      ]),
    ];
  }

  // Copy all numbers
  async function copyNumbers() {
    setError("");
    setNotice("");

    try {
      const numbers = getParticipantNumbers();

      await navigator.clipboard.writeText(
        numbers.join("\n")
      );

      setNotice(
        `${numbers.length} participant numbers copied successfully!`
      );
    } catch (err) {
      setError(
        err.message || "Unable to copy numbers. Check clipboard permission."
      );
    }
  }

  // Open WhatsApp
  function openWhatsApp() {
    setError("");
    setNotice("");

    try {
      getParticipantNumbers();

      if (!groupName.trim()) {
        throw new Error("Enter the WhatsApp group name.");
      }

      if (!customerName.trim()) {
        throw new Error("Enter the customer name.");
      }

      window.open(
        "https://web.whatsapp.com/",
        "_blank",
        "noopener,noreferrer"
      );

      setNotice(
        "WhatsApp opened. Create a new group and select the participant contacts."
      );
    } catch (err) {
      setError(err.message);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[#dce6e7] bg-white px-4 py-3 text-sm text-[#19363e] outline-none transition placeholder:text-[#9aabad] focus:border-[#12a594] focus:ring-2 focus:ring-[#12a594]/10";

  const labelClass =
    "mb-2 block text-sm font-semibold text-[#345158]";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-[10px] font-bold tracking-[1.5px] text-[#12a594]">
            SALES MANAGEMENT
          </p>

          <h1 className="text-2xl font-extrabold text-[#19363e]">
            WhatsApp Groups
          </h1>

          <p className="mt-2 text-sm text-[#82949a]">
            Manage Back Office members and prepare customer groups.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#d6eeea] bg-[#edfaf7] px-4 py-3">
          <UsersRound size={19} className="text-[#0d9b89]" />
          <span className="text-sm font-bold text-[#087d70]">
            {members.length} Members
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-auto font-bold"
          >
            ×
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} />
          <span className="flex-1">{notice}</span>
          <button
            onClick={() => setNotice("")}
            className="font-bold"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Back Office Members */}
        <section className="rounded-2xl border border-[#e1e9ea] bg-white p-5 shadow-sm md:p-6">

          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-[#eaf4ff] p-3">
              <Users size={22} className="text-blue-600" />
            </div>

            <div>
              <h2 className="font-bold text-[#19363e]">
                Back Office Members
              </h2>
              <p className="mt-1 text-xs text-[#82949a]">
                Manage fixed group participants
              </p>
            </div>
          </div>

          <form onSubmit={addMember} className="space-y-4">

            <div>
              <label className={labelClass}>
                Member Name
              </label>

              <input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Enter member name"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                WhatsApp Number
              </label>

              <input
                value={memberPhone}
                onChange={(e) => setMemberPhone(e.target.value)}
                placeholder="91XXXXXXXXXX"
                type="tel"
                className={inputClass}
                required
              />

              <p className="mt-1 text-xs text-[#91a2a5]">
                Include country code, without + sign.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !user?.uid}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#21464b] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#193a40] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              {saving ? "Saving..." : "Add Back Office Member"}
            </button>
          </form>

          {/* Saved Members */}
          <div className="mt-7 border-t border-[#edf1f2] pt-5">

            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#19363e]">
                Saved Members
              </h3>

              <span className="rounded-lg bg-[#edf7f5] px-3 py-1 text-xs font-bold text-[#087d70]">
                {members.length}
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-[#12a594]" />
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dce6e7] py-10 text-center">
                <Users size={30} className="mx-auto mb-2 text-[#a9b9bb]" />
                <p className="text-sm text-[#82949a]">
                  No members added yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl border border-[#edf1f2] bg-[#f8fafb] p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d5f3ed] font-bold text-[#087d70]">
                        {member.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#19363e]">
                          {member.name}
                        </p>
                        <p className="text-xs text-[#82949a]">
                          +{member.phone}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeMember(member)}
                      className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                      title="Remove member"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Create Customer Group */}
        <section className="rounded-2xl border border-[#e1e9ea] bg-white p-5 shadow-sm md:p-6">

          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-[#e5f8f2] p-3">
              <MessageCircle size={22} className="text-[#0d9b89]" />
            </div>

            <div>
              <h2 className="font-bold text-[#19363e]">
                Create Customer Group
              </h2>
              <p className="mt-1 text-xs text-[#82949a]">
                Prepare WhatsApp group details
              </p>
            </div>
          </div>

          <div className="space-y-4">

            <div>
              <label className={labelClass}>
                Group Name
              </label>

              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="ECHONIX - Customer Name"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Customer Name
              </label>

              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Customer WhatsApp Number
              </label>

              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="91XXXXXXXXXX"
                type="tel"
                className={inputClass}
              />
            </div>
          </div>

          {/* Participants */}
          <div className="my-6 rounded-xl border border-[#e6eeee] bg-[#f7fafb] p-4">

            <h3 className="mb-4 text-sm font-bold text-[#19363e]">
              Group Participants
            </h3>

            <div className="space-y-3 text-sm">

              <div className="flex justify-between text-[#627b80]">
                <span>Customer</span>
                <span className="font-bold text-[#19363e]">
                  {customerPhone.trim() ? 1 : 0}
                </span>
              </div>

              <div className="flex justify-between text-[#627b80]">
                <span>Back Office Members</span>
                <span className="font-bold text-[#19363e]">
                  {members.length}
                </span>
              </div>

              <div className="flex justify-between border-t border-[#dce6e7] pt-3 font-bold text-[#19363e]">
                <span>Total Participants</span>
                <span className="text-[#0d9b89]">
                  {members.length + (customerPhone.trim() ? 1 : 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Copy Numbers */}
          <button
            type="button"
            onClick={copyNumbers}
            disabled={loading || members.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#12a594] bg-white px-4 py-3 text-sm font-bold text-[#087d70] transition hover:bg-[#edfaf7] disabled:opacity-50"
          >
            <Copy size={18} />
            Copy All Numbers
          </button>

          {/* Open WhatsApp */}
          <button
            type="button"
            onClick={openWhatsApp}
            disabled={loading || members.length === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#159b75] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#087d60] disabled:opacity-50"
          >
            <MessageCircle size={19} />
            Open WhatsApp
          </button>

          <div className="mt-5 rounded-xl border border-[#f3e4bd] bg-[#fffaf0] p-4">
            <p className="text-xs leading-6 text-[#8b6a2d]">
              <strong>How to use:</strong> First copy all numbers.
              Open WhatsApp, select New Group, choose the customer
              and Back Office contacts, enter your group name and
              create the group. WhatsApp may require these numbers
              to be saved as phone contacts before selection.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
