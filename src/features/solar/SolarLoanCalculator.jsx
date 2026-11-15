import React, { useState, useMemo } from "react";
import {
  Banknote,
  Percent,
  Calendar,
  Sparkles,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  MessageCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

import {
  calculateDiminishingLoanByPayment,
  calculateDiminishingLoanByTenure,
  formatWhatsAppLoanPitch,
} from "./solarLoanModel";

export default function SolarLoanCalculator({
  initialLoanAmount = 200000,
  initialSubsidy = 78000,
  initialRate = 6.0,
  systemKw = 3,
  customerName = "",
  phone = "",
  location = "",
  branch = "chandapadi, ponnani",
  onApplyToQuote = null,
}) {
  // Inputs
  const [loanAmount, setLoanAmount] = useState(initialLoanAmount);
  const [interestRate, setInterestRate] = useState(initialRate);
  const [subsidyAmount, setSubsidyAmount] = useState(initialSubsidy);
  const [subsidyCreditMonth, setSubsidyCreditMonth] = useState(1);
  const [calcMode, setCalcMode] = useState("by_payment"); // "by_payment" or "by_tenure"

  // Mode 1: Custom Monthly Repayment
  const [monthlyPayment, setMonthlyPayment] = useState(2500);

  // Mode 2: Standard Bank Tenure
  const [tenureYears, setTenureYears] = useState(5);

  // Optional KSEB bill comparison
  const [bimonthlyBill, setBimonthlyBill] = useState("5000");
  const [showSchedule, setShowSchedule] = useState(false);
  const [copied, setCopied] = useState(false);

  const monthlyKsebBill = Math.round(Number(bimonthlyBill || 0) / 2);

  // Calculations
  const paymentResult = useMemo(() => {
    return calculateDiminishingLoanByPayment({
      loanAmount,
      annualInterestRate: interestRate,
      subsidyAmount,
      subsidyCreditMonth,
      monthlyPayment,
    });
  }, [loanAmount, interestRate, subsidyAmount, subsidyCreditMonth, monthlyPayment]);

  const tenureResult = useMemo(() => {
    return calculateDiminishingLoanByTenure({
      loanAmount,
      annualInterestRate: interestRate,
      subsidyAmount,
      tenureYears,
      subsidyCreditMonth,
    });
  }, [loanAmount, interestRate, subsidyAmount, tenureYears, subsidyCreditMonth]);

  // WhatsApp pitch text
  const whatsAppText = useMemo(() => {
    return formatWhatsAppLoanPitch({
      customerName: customerName || "Customer",
      phone,
      location,
      systemKw,
      loanAmount,
      annualInterestRate: interestRate,
      subsidyAmount,
      monthlyPayment,
      ksebMonthlyBill: monthlyKsebBill > 0 ? monthlyKsebBill : null,
      branch,
      website: "https://echonix.in",
    });
  }, [
    customerName,
    phone,
    location,
    systemKw,
    loanAmount,
    interestRate,
    subsidyAmount,
    monthlyPayment,
    monthlyKsebBill,
    branch,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsAppText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(whatsAppText);
    const url = phone
      ? `https://wa.me/91${phone.replace(/\D/g, "")}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6">
      {/* Title & Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-sm">
            <Banknote size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                PM സൂര്യഘർ സോളാർ ലോൺ
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                Diminishing Balance (കുറഞ്ഞുവരുന്ന പലിശ)
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
              സോളാർ ലോൺ & സബ്സിഡി കാൽക്കുലേറ്റർ
            </h2>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setCalcMode("by_payment")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              calcMode === "by_payment"
                ? "bg-white text-emerald-900 shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            മാസ അടവ് (₹1500 / ₹2500...)
          </button>
          <button
            type="button"
            onClick={() => setCalcMode("by_tenure")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              calcMode === "by_tenure"
                ? "bg-white text-emerald-900 shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ബാങ്ക് കാലാവധി (3 / 5 / 7 വർഷം)
          </button>
        </div>
      </div>

      {/* Primary Loan Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Loan Amount */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              ലോൺ തുക (Loan Amount)
            </label>
            <span className="text-xs font-black text-emerald-700">
              {money(loanAmount)}
            </span>
          </div>
          <input
            type="number"
            step="10000"
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-extrabold text-slate-900 outline-none focus:border-teal-600"
          />
          <div className="flex gap-1.5 flex-wrap">
            {[150000, 200000, 240000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setLoanAmount(amt)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                  loanAmount === amt
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                ₹{amt / 100000} Lakh
              </button>
            ))}
          </div>
        </div>

        {/* Diminishing Interest Rate */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              പലിശ നിരക്ക് (Interest Rate)
            </label>
            <span className="text-xs font-black text-teal-700">
              {interestRate}% p.a.
            </span>
          </div>
          <input
            type="number"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-extrabold text-slate-900 outline-none focus:border-teal-600"
          />
          <div className="flex gap-1.5 flex-wrap">
            {[6.0, 6.5, 7.0, 7.5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setInterestRate(r)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                  interestRate === r
                    ? "bg-teal-700 text-white border-teal-700"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {r}%
              </button>
            ))}
          </div>
        </div>

        {/* Central Subsidy Amount & Credit Month */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              കേന്ദ്ര സബ്സിഡി (PM Surya Ghar)
            </label>
            <span className="text-xs font-black text-amber-700">
              {money(subsidyAmount)}
            </span>
          </div>
          <input
            type="number"
            step="1000"
            value={subsidyAmount}
            onChange={(e) => setSubsidyAmount(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-extrabold text-slate-900 outline-none focus:border-teal-600"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex gap-1">
              {[30000, 60000, 78000].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubsidyAmount(s)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition ${
                    subsidyAmount === s
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  ₹{s / 1000}k
                </button>
              ))}
            </div>
            <span className="text-[10px] font-medium text-slate-600">
              ക്രെഡിറ്റ്: 1-ാം മാസം
            </span>
          </div>
        </div>
      </div>

      {/* Subsidy Impact Highlight Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-4 text-white relative overflow-hidden shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-400/30">
              <Sparkles size={11} /> സബ്സിഡി മാജിക്
            </span>
            <h3 className="text-sm font-bold text-white">
              1 മാസത്തിനുള്ളിൽ ₹{subsidyAmount.toLocaleString('en-IN')} സബ്സിഡി ലോണിൽ ക്രെഡിറ്റ് ആകും!
            </h3>
            <p className="text-xs text-teal-200/80">
              തുടക്കത്തിൽ ലോൺ {money(loanAmount)} ആയിരിക്കുമെങ്കിലും, സബ്സിഡി കയറുന്നതോടെ യഥാർത്ഥ ബാധ്യത വെറും{" "}
              <strong className="text-white underline font-black">
                {money(paymentResult.balanceAfterSubsidy)}
              </strong>{" "}
              ആയി കുറയുന്നു. പലിശ പകുതിയായി കുറയും!
            </p>
          </div>

          <div className="shrink-0 bg-white/10 rounded-xl p-3 border border-white/15 text-center min-w-[130px]">
            <span className="block text-[10px] text-teal-200 font-bold uppercase">
              സബ്സിഡിക്ക് ശേഷമുള്ള ലോൺ
            </span>
            <strong className="text-xl font-black text-amber-300 block">
              {money(paymentResult.balanceAfterSubsidy)}
            </strong>
            <span className="text-[9px] text-slate-300">ബാക്കി തുകയ്ക്ക് മാത്രം പലിശ</span>
          </div>
        </div>
      </div>

      {/* MODE 1: Repayment by Custom Monthly Payment */}
      {calcMode === "by_payment" && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Banknote size={16} className="text-emerald-600" />
                കസ്റ്റമർ മാസം അടയ്ക്കാൻ ഉദ്ദേശിക്കുന്ന തുക (Monthly Payment):
              </label>
              <div className="text-lg font-black text-emerald-800">
                {money(monthlyPayment)} / month
              </div>
            </div>

            {/* Quick Payment Preset Chips */}
            <div className="flex gap-2 flex-wrap">
              {[1500, 2000, 2500, 3000, 3500, 4000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setMonthlyPayment(amt)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl border transition cursor-pointer ${
                    monthlyPayment === amt
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  ₹{amt.toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            {/* Slider */}
            <div className="pt-2">
              <input
                type="range"
                min="1000"
                max="10000"
                step="250"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-bold mt-1">
                <span>₹1,000/mo</span>
                <span>₹2,500/mo (Recommended)</span>
                <span>₹5,000/mo</span>
                <span>₹10,000/mo</span>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Duration */}
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                ലോൺ തീരുന്ന കാലാവധി
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-950 mt-1">
                {paymentResult.durationMalayalam}
              </div>
              <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                ({paymentResult.totalMonths} മാസങ്ങൾ)
              </span>
            </div>

            {/* Total Interest Paid */}
            <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 block">
                ആകെ അടയ്ക്കുന്ന പലിശ
              </span>
              <div className="text-lg sm:text-xl font-black text-teal-950 mt-1">
                {money(paymentResult.totalInterest)}
              </div>
              <span className="text-[10px] text-teal-700 font-semibold block mt-0.5">
                കുറഞ്ഞുവരുന്ന പലിശ (Diminishing)
              </span>
            </div>

            {/* Interest Saved by Subsidy */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                സബ്സിഡി ലാഭിച്ച പലിശ
              </span>
              <div className="text-lg sm:text-xl font-black text-amber-950 mt-1">
                {money(paymentResult.interestSaved)}
              </div>
              <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                {paymentResult.monthsSaved} മാസം നേരത്തെ തീരും!
              </span>
            </div>

            {/* Total Paid by Customer */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                കസ്റ്റമർ ആകെ അടയ്ക്കുന്നത്
              </span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                {money(paymentResult.totalCustomerPaid)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                (മുതൽ + പലിശ - സബ്സിഡി)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: Repayment by Standard Bank Tenure */}
      {calcMode === "by_tenure" && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={16} className="text-teal-600" />
              ബാങ്ക് ലോൺ കാലാവധി (Tenure in Years):
            </label>

            <div className="flex gap-2 flex-wrap">
              {[3, 5, 7, 10].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setTenureYears(yr)}
                  className={`px-4 py-2 text-xs font-extrabold rounded-xl border transition cursor-pointer ${
                    tenureYears === yr
                      ? "bg-teal-700 text-white border-teal-700 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {yr} വർഷം ({yr * 12} മാസം)
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                സബ്സിഡിക്ക് മുമ്പുള്ള EMI
              </span>
              <div className="text-lg font-black text-slate-700 mt-1">
                {money(tenureResult.originalEmi)} <span className="text-xs font-normal">/mo</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ആദ്യ മാസത്തെ അടവ് മാത്രം
              </span>
            </div>

            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4">
              <span className="text-[10px] font-black uppercase text-emerald-800 block">
                സബ്സിഡിക്ക് ശേഷമുള്ള പുതിയ EMI
              </span>
              <div className="text-2xl font-black text-emerald-950 mt-1">
                {money(tenureResult.revisedEmi)} <span className="text-xs font-normal">/mo</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                📉 പ്രതിമാസം ₹{tenureResult.monthlyEmiDrop.toLocaleString('en-IN')} കുറവ്!
              </span>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
              <span className="text-[10px] font-black uppercase text-amber-800 block">
                ആകെ പലിശ ലാഭം
              </span>
              <div className="text-xl font-black text-amber-950 mt-1">
                {money(tenureResult.totalInterestSaved)}
              </div>
              <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                സബ്സിഡി കാരണം ലാഭിക്കുന്ന പലിശ
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KSEB Electricity Bill Free Switch Pitch */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 uppercase tracking-wide">
            <Zap size={15} className="text-amber-600 fill-amber-500" />
            "₹0 കറന്റ് ബിൽ കൊണ്ട് സോളാർ സിസ്റ്റം ഫ്രീ!" പ്ലാൻ
          </div>
          <p className="text-xs text-amber-950/80 leading-relaxed max-w-xl">
            കസ്റ്റമർ ഇപ്പോൾ KSEB-ക്ക് നൽകുന്ന 2 മാസത്തെ ബിൽ എത്രയാണ്? ആ തുക കൊണ്ട് തന്നെ പോക്കറ്റിൽ നിന്ന് 1 രൂപ അധികം ചെലവാക്കാതെ സോളാർ സിസ്റ്റം അടച്ചുതീർക്കാം!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div>
            <span className="text-[10px] font-bold text-amber-800 block">2 മാസത്തെ KSEB ബിൽ (₹)</span>
            <input
              type="number"
              step="500"
              value={bimonthlyBill}
              onChange={(e) => setBimonthlyBill(e.target.value)}
              placeholder="e.g. 5000"
              className="w-28 rounded-xl border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-extrabold text-slate-900 outline-none"
            />
          </div>
          {monthlyKsebBill > 0 && (
            <button
              type="button"
              onClick={() => setMonthlyPayment(monthlyKsebBill)}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              title="Set monthly repayment equal to current monthly electricity bill"
            >
              Apply ₹{monthlyKsebBill}/mo
            </button>
          )}
        </div>
      </div>

      {/* Expandable Schedule: "1 monthinte ullil subsidy 78000 kerumbol palish engane varunn" */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-extrabold text-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-emerald-600" />
            <span>ആദ്യ മാസങ്ങളിലെ പലിശ കുറയുന്ന കണക്ക് (Live Diminishing Schedule)</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-bold">
            <span>{showSchedule ? "Hide Table" : "Show Month-by-Month Breakdown"}</span>
            {showSchedule ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showSchedule && (
          <div className="p-4 space-y-3 bg-white">
            <p className="text-xs text-slate-600">
              സബ്സിഡി വരുന്നതോടെ പലിശ എങ്ങനെയാണ് ഒറ്റയടിക്ക് കുറയുന്നത് എന്ന് കസ്റ്റമർക്ക് വ്യക്തമായി കാണിച്ചുകൊടുക്കാം:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-600">
                    <th className="py-2 px-2.5">മാസം (Month)</th>
                    <th className="py-2 px-2.5">തുടക്ക ലോൺ (Opening)</th>
                    <th className="py-2 px-2.5">മാസ പലിശ (Interest)</th>
                    <th className="py-2 px-2.5">മാസ അടവ് (Payment)</th>
                    <th className="py-2 px-2.5">സബ്സിഡി ക്രെഡിറ്റ് (Subsidy)</th>
                    <th className="py-2 px-2.5">ബാക്കി ലോൺ (Closing)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paymentResult.schedule.slice(0, 6).map((s) => (
                    <tr
                      key={s.month}
                      className={
                        s.subsidyCredited > 0
                          ? "bg-amber-50/80 font-bold text-amber-950"
                          : "hover:bg-slate-50 text-slate-800"
                      }
                    >
                      <td className="py-2 px-2.5">
                        {s.month === 1 ? "1-ാം മാസം (Month 1)" : `${s.month}-ാം മാസം`}
                      </td>
                      <td className="py-2 px-2.5">{money(s.openingBalance)}</td>
                      <td className="py-2 px-2.5 text-teal-700 font-bold">
                        {money(s.interest)}
                      </td>
                      <td className="py-2 px-2.5">{money(s.customerPaid)}</td>
                      <td className="py-2 px-2.5 text-amber-700 font-extrabold">
                        {s.subsidyCredited > 0 ? `+ ${money(s.subsidyCredited)} DBT` : "-"}
                      </td>
                      <td className="py-2 px-2.5 font-black text-slate-900">
                        {money(s.closingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
              💡 <strong>ശ്രദ്ധിക്കുക:</strong> 1-ാം മാസം പലിശ {money(paymentResult.schedule[0]?.interest || 1000)} ആണെങ്കിൽ, ₹78,000 സബ്സിഡി ക്രെഡിറ്റ് ആകുന്നതോടെ 2-ാം മാസം പലിശ വെറും {money(paymentResult.schedule[1]?.interest || 602)} ആയി കുറയുന്നു!
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Message Preview & 1-Tap Actions */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <MessageCircle size={15} className="text-emerald-600" />
            WhatsApp Pitch (കസ്റ്റമർക്ക് അയക്കാൻ തയാറായ സന്ദേശം)
          </span>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
            READY TO SHARE
          </span>
        </div>

        <pre className="font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap max-h-44 overflow-y-auto p-3 bg-white rounded-xl border border-slate-200 select-all">
          {whatsAppText}
        </pre>

        {/* Buttons Row */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full sm:flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Share2 size={15} />
            <span>കസ്റ്റമർക്ക് WhatsApp-ൽ അയക്കുക</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto py-3 px-4 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={15} className="text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={15} />
                <span>Copy Message</span>
              </>
            )}
          </button>

          {onApplyToQuote && (
            <button
              type="button"
              onClick={() => {
                const specText = `Loan amount ${loanAmount / 100000} Lack (EMI ₹${monthlyPayment}/mo, Subsidy ₹${subsidyAmount/1000}k credit)`;
                onApplyToQuote({
                  paymentType: specText,
                  loanAmount,
                  monthlyPayment,
                  subsidyAmount,
                });
              }}
              className="w-full sm:w-auto py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>Use in Group Booking Spec</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
