import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Sun,
  Zap,
  Calculator,
  Download,
  Share2,
  MessageCircle,
  Copy,
  Check,
  Building2,
  Home,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  TreePine,
  RotateCcw,
  Users,
  Search,
  ExternalLink,
  Layers,
  CreditCard,
  MapPin,
} from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import { listRecords, updateRecord } from "../../lib/data";
import {
  calculateSolarMetrics,
  calculateSubsidy,
  estimateSizingFromBill,
  estimateSystemCost,
  estimatePanelCount,
  formatWhatsAppQuote,
  formatWhatsAppGroupBookingSpec,
} from "./solarCalculatorModel";
import { generateSolarQuotationPdf } from "./solarPdfGenerator";

export default function SolarCalculatorPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryLeadId = searchParams.get("leadId");
  const queryName = searchParams.get("name") || "";
  const queryPhone = searchParams.get("phone") || "";
  const queryArea = searchParams.get("area") || "";

  // Template Mode: "group_spec" (Default ECHONIX Group Format) vs "detailed_quote"
  const [templateMode, setTemplateMode] = useState("group_spec");

  // System & Capacity
  const [bimonthlyBill, setBimonthlyBill] = useState("5000");
  const [systemKw, setSystemKw] = useState(4);
  const [systemType, setSystemType] = useState("On-Grid");
  const [withOptimizer, setWithOptimizer] = useState(true);
  const [isResidential, setIsResidential] = useState(true);

  // Hardware Specifications (matching Shanis's exact ECHONIX WhatsApp booking spec)
  const [panelWattage, setPanelWattage] = useState("554 Wp");
  const [panelCount, setPanelCount] = useState(6);
  const [panelBrand, setPanelBrand] = useState("Goldie/ Rayzon");
  const [inverterKw, setInverterKw] = useState(4);
  const [inverterBrand, setInverterBrand] = useState("");
  const [structure, setStructure] = useState("8 panel  structure");
  const [roofType, setRoofType] = useState("concrete flat  roof");

  // Pricing & Commercials
  const [totalPrice, setTotalPrice] = useState("240000");
  const [withKsebCharge, setWithKsebCharge] = useState(true);
  const [paymentType, setPaymentType] = useState("Loan  amount 2 Lack");
  const [branch, setBranch] = useState("chandapadi, ponnani");
  const [includeCustomerHeader, setIncludeCustomerHeader] = useState(false);

  // Client Details
  const [customerName, setCustomerName] = useState(queryName);
  const [phone, setPhone] = useState(queryPhone);
  const [location, setLocation] = useState(queryArea);
  const [ksebConsumerNo, setKsebConsumerNo] = useState("");

  // CRM Leads linking
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(queryLeadId || "");
  const [isSavingToLead, setIsSavingToLead] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Load leads to easily select an existing customer
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
            if (matched.ksebConsumerNo) setKsebConsumerNo(matched.ksebConsumerNo);
            if (matched.billAmount) {
              setBimonthlyBill(String(matched.billAmount));
              const sizing = estimateSizingFromBill(matched.billAmount);
              setSystemKw(sizing.recommendedKw);
              syncSystemDefaults(sizing.recommendedKw);
            }
          }
        }
      })
      .catch(() => {});
  }, [user?.uid, queryLeadId]);

  // Sync defaults when kW changes
  const syncSystemDefaults = (kw) => {
    setInverterKw(kw);
    const estCost = estimateSystemCost(kw);
    setTotalPrice(String(estCost));
    const count = estimatePanelCount(kw, 554);
    setPanelCount(count);
    setStructure(`${count <= 6 ? 8 : count <= 8 ? 8 : 10} panel  structure`);
  };

  const handleKwChange = (kw) => {
    setSystemKw(kw);
    syncSystemDefaults(kw);
  };

  const handleBillChange = (val) => {
    setBimonthlyBill(val);
    const num = Number(val);
    if (num > 0) {
      const sizing = estimateSizingFromBill(num);
      setSystemKw(sizing.recommendedKw);
      syncSystemDefaults(sizing.recommendedKw);
    }
  };

  // Lead selection from dropdown
  const handleSelectLead = (e) => {
    const id = e.target.value;
    setSelectedLeadId(id);
    if (!id) return;
    const l = leads.find((item) => item.id === id);
    if (l) {
      setCustomerName(l.name || "");
      setPhone(l.phone || "");
      setLocation(l.section || l.area || "");
      if (l.ksebConsumerNo) setKsebConsumerNo(l.ksebConsumerNo);
      if (l.billAmount) {
        setBimonthlyBill(String(l.billAmount));
        const sizing = estimateSizingFromBill(l.billAmount);
        setSystemKw(sizing.recommendedKw);
        syncSystemDefaults(sizing.recommendedKw);
      }
    }
  };

  // Calculated Metrics
  const metrics = useMemo(() => {
    return calculateSolarMetrics({
      systemKw,
      customCost: totalPrice ? Number(totalPrice) : null,
      isResidential,
    });
  }, [systemKw, totalPrice, isResidential]);

  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  // Formatted Output depending on templateMode
  const activeWhatsAppText = useMemo(() => {
    if (templateMode === "group_spec") {
      return formatWhatsAppGroupBookingSpec({
        customerName,
        phone,
        location,
        systemKw,
        systemType,
        withOptimizer,
        panelWattage,
        panelCount,
        panelBrand,
        inverterKw,
        inverterBrand,
        structure,
        roofType,
        totalPrice: Number(totalPrice || 240000),
        withKsebCharge,
        paymentType,
        branch,
        website: "https://echonix.in",
        includeCustomerHeader,
      });
    }

    return formatWhatsAppQuote({
      customerName: customerName || "Customer",
      phone,
      location,
      ksebConsumerNo,
      systemKw: metrics.systemKw,
      systemType,
      panelBrand: `${panelWattage} ${panelBrand} (${panelCount} Nos)`,
      inverterBrand: `${inverterKw || systemKw}KW Inverter ${inverterBrand}`,
      customCost: totalPrice ? Number(totalPrice) : null,
      isResidential,
      executiveName: user?.displayName || "Shanis",
      branch,
    });
  }, [
    templateMode,
    customerName,
    phone,
    location,
    ksebConsumerNo,
    systemKw,
    systemType,
    withOptimizer,
    panelWattage,
    panelCount,
    panelBrand,
    inverterKw,
    inverterBrand,
    structure,
    roofType,
    totalPrice,
    withKsebCharge,
    paymentType,
    branch,
    includeCustomerHeader,
    metrics.systemKw,
    isResidential,
    user?.displayName,
  ]);

  // Copy WhatsApp proposal
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeWhatsAppText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = activeWhatsAppText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Open WhatsApp directly
  const handleSendWhatsApp = () => {
    // Automatically copy clean text to clipboard as well
    try {
      navigator.clipboard.writeText(activeWhatsAppText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {}

    const cleanPhone = (phone || "").replace(/\D/g, "");
    const encoded = encodeURIComponent(activeWhatsAppText);
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (cleanPhone.length >= 10) {
      const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      if (isMobile) {
        window.open(`https://api.whatsapp.com/send?phone=${fullPhone}&text=${encoded}`, "_blank");
      } else {
        window.open(`https://web.whatsapp.com/send?phone=${fullPhone}&text=${encoded}`, "_blank");
      }
    } else {
      if (isMobile) {
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
      } else {
        window.open(`https://web.whatsapp.com/send?text=${encoded}`, "_blank");
      }
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    setPdfBusy(true);
    try {
      const { save } = generateSolarQuotationPdf({
        customerName: customerName || "Customer",
        phone,
        location,
        ksebConsumerNo,
        systemKw,
        systemType,
        withOptimizer,
        panelWattage,
        panelCount,
        panelBrand,
        inverterKw,
        inverterBrand,
        structure,
        roofType,
        totalPrice: Number(totalPrice || 240000),
        withKsebCharge,
        paymentType,
        branch,
        isResidential,
        executiveName: user?.displayName || "Shanis",
      });
      save();
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please verify details.");
    } finally {
      setPdfBusy(false);
    }
  };

  // Save Quote to Lead in CRM
  const handleSaveToLead = async () => {
    if (!user?.uid || !selectedLeadId) {
      alert("Please select or link a Lead from your CRM first.");
      return;
    }
    setIsSavingToLead(true);
    try {
      await updateRecord(user.uid, "leads", selectedLeadId, {
        systemSizeKw: metrics.systemKw,
        quotationAmount: Number(totalPrice || metrics.cost),
        subsidyAmount: metrics.subsidy,
        netPayableAmount: metrics.netInvestment,
        ksebConsumerNo: ksebConsumerNo || undefined,
        status: "Proposal Sent",
        proposalDate: new Date().toLocaleDateString("en-CA"),
        lastQuotationText: activeWhatsAppText,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Could not save to lead:", err);
      alert("Could not update lead. Check your connection.");
    } finally {
      setIsSavingToLead(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
            <Sun size={14} className="text-amber-500 animate-spin-slow" />
            ECHONIX Solar Booking & Specification Generator
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Solar Quotation & WhatsApp Group Spec
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Generate customer proposal & instant WhatsApp group handover specification (customer OK aayal groupil idan).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {selectedLeadId && (
            <Link
              to="/leads"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <Users size={14} /> Back to CRM
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Input Controls & Spec Builder (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Select Lead */}
          {leads.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-slate-700 shrink-0">
                <Users size={18} className="text-teal-600" />
                <span className="text-xs font-bold uppercase tracking-wide">
                  Link to CRM Lead:
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

          {/* Sizing & Core System Box */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm">
                  <Calculator size={18} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    1. System & Sizing (സിസ്റ്റം)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select kW capacity and optimizer options
                  </p>
                </div>
              </div>

              {/* Optimizer Toggle Button */}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-amber-100 transition">
                <input
                  type="checkbox"
                  checked={withOptimizer}
                  onChange={(e) => setWithOptimizer(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span>with optimizer</span>
              </label>
            </div>

            {/* Quick kW Preset Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  System Capacity: <strong className="text-teal-700 text-base">{systemKw} KW</strong> {systemType}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={systemType}
                    onChange={(e) => setSystemType(e.target.value)}
                    className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-800"
                  >
                    <option>On-Grid</option>
                    <option>Hybrid</option>
                    <option>Off-Grid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {[2, 3, 4, 5, 6, 8].map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => handleKwChange(kw)}
                    className={`py-2 text-xs font-extrabold rounded-xl border transition cursor-pointer ${
                      systemKw === kw
                        ? "bg-gradient-to-r from-teal-700 to-teal-800 text-white border-teal-800 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {kw} KW
                  </button>
                ))}
              </div>
            </div>

            {/* Bill Sizing Helper */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-amber-500 shrink-0" />
                <span className="font-semibold text-slate-700">
                  Estimate from KSEB Bill:
                </span>
                <input
                  type="number"
                  step="500"
                  value={bimonthlyBill}
                  onChange={(e) => handleBillChange(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900"
                />
              </div>
              <span className="text-[11px] text-slate-500">
                Recommended: <strong>{estimateSizingFromBill(bimonthlyBill).recommendedKw} KW</strong>
              </span>
            </div>
          </div>

          {/* Detailed Hardware & Group Spec Form */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-teal-600 text-white shadow-sm">
                <Layers size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  2. Panels, Structure & Roof (സ്പെസിഫിക്കേഷൻ)
                </h2>
                <p className="text-xs text-slate-500">
                  Panels, inverter, structure and site roof type
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Panel Wattage */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  പാനൽ വാട്ടേജ് (Wp)
                </label>
                <input
                  type="text"
                  value={panelWattage}
                  onChange={(e) => setPanelWattage(e.target.value)}
                  placeholder="e.g. 554 Wp"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              {/* Panel Count */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  പാനൽ എണ്ണം (Count)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={panelCount}
                  onChange={(e) => setPanelCount(Number(e.target.value))}
                  placeholder="e.g. 6"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              {/* Panel Brand */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  പാനൽ ബ്രാൻഡ്
                </label>
                <input
                  type="text"
                  value={panelBrand}
                  onChange={(e) => setPanelBrand(e.target.value)}
                  placeholder="e.g. Goldie/ Rayzon"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              {/* Inverter Kw */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ഇൻവെർട്ടർ കപ്പാസിറ്റി
                </label>
                <input
                  type="number"
                  value={inverterKw}
                  onChange={(e) => setInverterKw(Number(e.target.value))}
                  placeholder="e.g. 4"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              {/* Structure */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  സ്ട്രക്ച്ചർ (Structure)
                </label>
                <input
                  type="text"
                  value={structure}
                  onChange={(e) => setStructure(e.target.value)}
                  placeholder="e.g. 8 panel  structure"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              {/* Roof Type */}
              <div className="sm:col-span-3">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  റൂഫ് ടൈപ് (Roof Type)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    "concrete flat  roof",
                    "sloped tile  roof",
                    "metal sheet  roof",
                    "truss work",
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoofType(r)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition ${
                        roofType === r
                          ? "bg-teal-700 text-white border-teal-700 font-bold"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={roofType}
                    onChange={(e) => setRoofType(e.target.value)}
                    className="flex-1 min-w-[150px] rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-600"
                    placeholder="or enter custom roof type..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing, Payment & Branch Commercials */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
                <CreditCard size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  3. വില, പേയ്മെന്റ് & ബ്രാഞ്ച് (Commercials)
                </h2>
                <p className="text-xs text-slate-500">
                  Total price, payment method (loan/cash) & branch
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Total Price with KSEB Charge */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    ആകെ വില (Total Price in ₹)
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={withKsebCharge}
                      onChange={(e) => setWithKsebCharge(e.target.checked)}
                      className="rounded text-teal-600"
                    />
                    <span>With KSEB Charge</span>
                  </label>
                </div>
                <input
                  type="number"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  placeholder="e.g. 240000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-extrabold text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              {/* Payment Type / Loan */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Payment Type / Loan Details
                </label>
                <input
                  type="text"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  placeholder="e.g. Loan  amount 2 Lack"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              {/* Branch */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Branch Office (ബ്രാഞ്ച്)
                </label>
                <div className="flex gap-2 flex-wrap items-center">
                  {[
                    "chandapadi, ponnani",
                    "kuttippuram",
                    "edappal",
                    "tirur",
                    "valanchery",
                  ].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBranch(b)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition ${
                        branch === b
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="custom branch..."
                    className="flex-1 min-w-[140px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Site Details Form */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building2 size={15} className="text-teal-600" />
                Customer & Site Info (കസ്റ്റമർ വിവരങ്ങൾ)
              </h2>

              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCustomerHeader}
                  onChange={(e) => setIncludeCustomerHeader(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <span>Include in Group Message</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ashraf"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Phone (WhatsApp)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9846012345"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Location / Section
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Chandapadi, Ponnani"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  KSEB Consumer No
                </label>
                <input
                  type="text"
                  value={ksebConsumerNo}
                  onChange={(e) => setKsebConsumerNo(e.target.value)}
                  placeholder="e.g. 115542000342"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WhatsApp Live Preview & 1-Click Group Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Booking Summary Card */}
          <div className="bg-gradient-to-br from-[#102b32] via-[#163f47] to-[#0f343b] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden border border-teal-900/40">
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-[#12a594]/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#51d8c6]">
                {systemKw} KW {systemType} {withOptimizer ? "+ Optimizer" : ""}
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300 font-bold">
                {branch}
              </span>
            </div>

            <div className="mt-4 space-y-1.5 border-b border-white/10 pb-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block text-[11px] text-[#b6cbcd] font-bold uppercase tracking-wider">
                    Total Turnkey Price
                  </span>
                  <span className="text-3xl font-black text-white tracking-tight">
                    {money(totalPrice)}
                  </span>
                  <span className="text-[10px] text-teal-200 block mt-0.5">
                    {withKsebCharge ? "(With KSEB Charge)" : ""}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">
                    Govt. Subsidy
                  </span>
                  <span className="text-base font-black text-emerald-400">
                    -{money(metrics.subsidy)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Specs summary */}
            <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs">
              <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
                <span className="text-[9px] text-[#b6cbcd] block uppercase font-bold">
                  Panels
                </span>
                <strong className="text-xs text-white">
                  {panelWattage} x {panelCount} Nos
                </strong>
                <span className="text-[9px] text-slate-300 block truncate">
                  {panelBrand}
                </span>
              </div>

              <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
                <span className="text-[9px] text-[#b6cbcd] block uppercase font-bold">
                  Structure & Roof
                </span>
                <strong className="text-xs text-white truncate block">
                  {structure}
                </strong>
                <span className="text-[9px] text-slate-300 block truncate">
                  {roofType}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-[#b6cbcd]">Payment Scheme:</span>
              <strong className="text-amber-300 font-bold">
                {paymentType}
              </strong>
            </div>
          </div>

          {/* Format Switcher Tabs */}
          <div className="flex rounded-2xl bg-slate-200 p-1 shadow-inner text-xs font-black">
            <button
              type="button"
              onClick={() => setTemplateMode("group_spec")}
              className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                templateMode === "group_spec"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🌞 Group Booking Spec</span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            </button>

            <button
              type="button"
              onClick={() => setTemplateMode("detailed_quote")}
              className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                templateMode === "detailed_quote"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📊 Customer Proposal</span>
            </button>
          </div>

          {/* WhatsApp Text Preview Box */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <MessageCircle size={15} className="text-emerald-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {templateMode === "group_spec"
                    ? "WhatsApp Group Message (OK ആയ സ്പെസിഫിക്കേഷൻ)"
                    : "Customer WhatsApp Proposal"}
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                READY TO SEND
              </span>
            </div>

            <pre className="font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap max-h-64 overflow-y-auto no-scrollbar p-3.5 bg-slate-50 rounded-2xl border border-slate-200 select-all">
              {activeWhatsAppText}
            </pre>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* WhatsApp Send Button */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <MessageCircle size={18} />
                <span>
                  {templateMode === "group_spec"
                    ? "Post to WhatsApp Group / Customer"
                    : "Send Quotation via WhatsApp"}
                </span>
              </button>

              {/* Secondary Buttons Row */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span>Copied Spec!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={pdfBusy}
                  className="py-2.5 px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border border-teal-200 cursor-pointer"
                >
                  <Download size={14} />
                  <span>{pdfBusy ? "Creating..." : "Download PDF"}</span>
                </button>
              </div>

              {/* Link & Save to CRM Lead */}
              {selectedLeadId && (
                <button
                  type="button"
                  onClick={handleSaveToLead}
                  disabled={isSavingToLead}
                  className="w-full mt-2 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 size={15} className="text-emerald-400" />
                      <span>Saved to Lead Record!</span>
                    </>
                  ) : (
                    <>
                      <Users size={15} />
                      <span>
                        {isSavingToLead ? "Updating..." : "Save Quote to Lead CRM"}
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Helper tip for rich preview and intact emojis */}
              <div className="text-[11px] text-slate-600 bg-teal-50/80 p-2.5 rounded-xl border border-teal-100 flex items-start gap-2 leading-relaxed mt-2">
                <Sparkles size={14} className="text-teal-700 shrink-0 mt-0.5" />
                <span>
                  <strong>ടിപ്പ്:</strong> പുതിയ WhatsApp ഗ്രൂപ്പിൽ ഇടാൻ <strong>"Copy Text"</strong> ക്ലിക്ക് ചെയ്ത് ഗ്രൂപ്പിൽ <strong>Paste (Ctrl+V)</strong> ചെയ്താൽ എല്ലാ ഇമോജികളും വെബ്സൈറ്റ് പ്രിവ്യൂ കാർഡും (Image 2 പോലെ) 100% ഒറിജിനലായി വരും!
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
