import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Banknote,
  Sun,
  Users,
  ArrowLeft,
  Share2,
  Sparkles,
  Calculator,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import { listRecords } from "../../lib/data";
import SolarLoanCalculator from "./SolarLoanCalculator";

export default function SolarLoanPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const queryLeadId = searchParams.get("leadId") || "";
  const queryName = searchParams.get("name") || "";
  const queryPhone = searchParams.get("phone") || "";
  const queryLocation = searchParams.get("location") || "";
  const queryKw = Number(searchParams.get("kw") || 3);
  const queryLoan = Number(searchParams.get("loan") || 200000);
  const querySubsidy = Number(searchParams.get("subsidy") || 78000);

  const [customerName, setCustomerName] = useState(queryName);
  const [phone, setPhone] = useState(queryPhone);
  const [location, setLocation] = useState(queryLocation);
  const [systemKw, setSystemKw] = useState(queryKw);

  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(queryLeadId);

  // Load leads
  useEffect(() => {
    if (!user?.uid) return;
    listRecords(user.uid, "leads")
      .then((records) => {
        const list = Array.isArray(records) ? records : [];
        setLeads(list);
        if (queryLeadId) {
          const matched = list.find((l) => l.id === queryLeadId);
          if (matched) {
            setCustomerName(matched.name || "");
            setPhone(matched.phone || "");
            setLocation(matched.section || matched.area || "");
            if (matched.systemSizeKw) setSystemKw(Number(matched.systemSizeKw));
          }
        }
      })
      .catch(() => {});
  }, [user?.uid, queryLeadId]);

  const handleSelectLead = (e) => {
    const id = e.target.value;
    setSelectedLeadId(id);
    if (!id) return;
    const matched = leads.find((l) => l.id === id);
    if (matched) {
      setCustomerName(matched.name || "");
      setPhone(matched.phone || "");
      setLocation(matched.section || matched.area || "");
      if (matched.systemSizeKw) setSystemKw(Number(matched.systemSizeKw));
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <Banknote size={14} className="text-emerald-600" />
            PM Surya Ghar · Diminishing Loan & Subsidy Sizer
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1.5">
            സോളാർ ലോൺ & സബ്സിഡി കാൽക്കുലേറ്റർ
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            വീടുകളിൽ സന്ദർശനം നടത്തുമ്പോൾ ₹2 ലക്ഷം ലോണിൽ ₹1500 / ₹2500 / ₹3000 വെച്ച് അടച്ചാൽ എത്ര കാലം കൊണ്ട് തീരും, ₹78,000 സബ്സിഡി കയറുമ്പോൾ പലിശ എങ്ങനെ കുറയും എന്ന് തത്സമയം കാണിക്കാം.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/calculator"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Sun size={14} className="text-amber-500" />
            <span>Solar Quote & Specs</span>
          </Link>
        </div>
      </div>

      {/* CRM Lead Quick Select */}
      {leads.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-slate-700 shrink-0">
            <Users size={16} className="text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wide">
              Link with CRM Lead:
            </span>
          </div>
          <select
            value={selectedLeadId}
            onChange={handleSelectLead}
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-teal-600 focus:bg-white"
          >
            <option value="">-- Choose existing lead (Optional) --</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} {l.phone ? `(${l.phone})` : ""} - {l.section || "No area"}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Loan Calculator Component */}
      <SolarLoanCalculator
        initialLoanAmount={queryLoan || 200000}
        initialSubsidy={querySubsidy || 78000}
        initialRate={6.0}
        systemKw={systemKw}
        customerName={customerName}
        phone={phone}
        location={location}
        branch="chandapadi, ponnani"
      />
    </div>
  );
}
