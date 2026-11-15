/**
 * Diminishing Balance (Reducing Interest) Solar Loan & Subsidy Calculator
 * Specifically modeled for PM Surya Ghar Rooftop Solar Loans in Kerala
 * (Canara Bank, SBI, Kerala Gramin Bank, Union Bank @ ~6% - 7% p.a.)
 *
 * Handles:
 * 1. Initial Loan (e.g. ₹2,00,000)
 * 2. Diminishing balance monthly interest calculation
 * 3. Central Subsidy DBT credit in Month 1/2 (e.g. ₹78,000 direct to loan account)
 * 4. Custom Monthly Repayment (₹1,500, ₹2,000, ₹2,500, ₹3,000, etc.) -> Duration & Interest
 * 5. Fixed Tenure EMI Reduction
 * 6. KSEB Zero Electricity Bill Switch pitch
 */

/**
 * Calculate diminishing loan payoff based on a target monthly repayment amount.
 * (e.g. Customer wants to pay ₹1,500 or ₹2,500 or ₹3,000 every month).
 */
export function calculateDiminishingLoanByPayment({
  loanAmount = 200000,
  annualInterestRate = 6.0,
  subsidyAmount = 78000,
  subsidyCreditMonth = 1,
  monthlyPayment = 2500,
}) {
  const principal = Math.max(1000, Number(loanAmount || 200000));
  const rate = Math.max(0.1, Number(annualInterestRate || 6.0));
  const monthlyRate = rate / 100 / 12;
  const subsidy = Math.max(0, Number(subsidyAmount || 0));
  const creditMonth = Math.max(1, Number(subsidyCreditMonth || 1));
  const payment = Math.max(100, Number(monthlyPayment || 2500));

  // Minimum payment threshold check:
  // If payment is less than initial monthly interest, the loan would never amortize.
  const initialMonthlyInterest = principal * monthlyRate;
  const isPaymentTooLow = payment <= initialMonthlyInterest;

  // 1. Simulation WITH Subsidy
  let balance = principal;
  let totalInterest = 0;
  let totalCustomerPaid = 0;
  let month = 0;
  const schedule = [];
  let balanceAfterSubsidy = principal;

  const maxMonths = 360; // 30-year safety cap

  while (balance > 0 && month < maxMonths) {
    month++;
    const openingBalance = balance;
    const interest = balance * monthlyRate;
    totalInterest += interest;

    let subsidyThisMonth = 0;
    if (month === creditMonth && subsidy > 0) {
      subsidyThisMonth = subsidy;
    }

    // Customer monthly repayment
    let principalPaid = 0;
    let actualPayment = payment;

    if (openingBalance + interest <= payment) {
      // Final month payoff
      actualPayment = openingBalance + interest;
      principalPaid = openingBalance;
      balance = 0;
    } else {
      principalPaid = Math.max(0, payment - interest);
      balance = openingBalance - principalPaid;
    }

    // Deduct subsidy if credited this month
    if (subsidyThisMonth > 0) {
      balance = Math.max(0, balance - subsidyThisMonth);
      balanceAfterSubsidy = balance;
    }

    totalCustomerPaid += actualPayment;

    if (month <= 24 || balance === 0) {
      schedule.push({
        month,
        openingBalance: Math.round(openingBalance),
        interest: Math.round(interest),
        principalPaid: Math.round(principalPaid),
        subsidyCredited: Math.round(subsidyThisMonth),
        closingBalance: Math.round(balance),
        customerPaid: Math.round(actualPayment),
      });
    }
  }

  // 2. Simulation WITHOUT Subsidy (for side-by-side comparison & interest saved)
  let balanceNoSub = principal;
  let totalInterestNoSub = 0;
  let monthNoSub = 0;

  if (!isPaymentTooLow) {
    while (balanceNoSub > 0 && monthNoSub < maxMonths) {
      monthNoSub++;
      const interest = balanceNoSub * monthlyRate;
      totalInterestNoSub += interest;
      if (balanceNoSub + interest <= payment) {
        balanceNoSub = 0;
      } else {
        const principalPaid = Math.max(0, payment - interest);
        balanceNoSub -= principalPaid;
      }
    }
  }

  const totalMonths = month;
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  let durationMalayalam = "";
  if (years > 0 && remainingMonths > 0) {
    durationMalayalam = `${years} വർഷം ${remainingMonths} മാസം`;
  } else if (years > 0) {
    durationMalayalam = `${years} വർഷം`;
  } else {
    durationMalayalam = `${remainingMonths} മാസം`;
  }

  const durationEnglish =
    years > 0
      ? remainingMonths > 0
        ? `${years} Yrs ${remainingMonths} Mos`
        : `${years} Yrs`
      : `${remainingMonths} Mos`;

  const yearsNoSub = Math.floor(monthNoSub / 12);
  const remainingMonthsNoSub = monthNoSub % 12;
  const durationNoSubMalayalam =
    yearsNoSub > 0
      ? remainingMonthsNoSub > 0
        ? `${yearsNoSub} വർഷം ${remainingMonthsNoSub} മാസം`
        : `${yearsNoSub} വർഷം`
      : `${remainingMonthsNoSub} മാസം`;

  const interestSaved = Math.max(0, Math.round(totalInterestNoSub - totalInterest));
  const monthsSaved = Math.max(0, monthNoSub - totalMonths);

  return {
    loanAmount: principal,
    annualInterestRate: rate,
    monthlyRate,
    subsidyAmount: subsidy,
    subsidyCreditMonth: creditMonth,
    monthlyPayment: payment,
    initialMonthlyInterest: Math.round(initialMonthlyInterest),
    isPaymentTooLow,
    // With Subsidy
    totalMonths,
    years,
    remainingMonths,
    durationMalayalam,
    durationEnglish,
    totalInterest: Math.round(totalInterest),
    totalCustomerPaid: Math.round(totalCustomerPaid),
    balanceAfterSubsidy: Math.round(balanceAfterSubsidy || Math.max(0, principal - subsidy)),
    // Without Subsidy Comparison
    totalMonthsWithoutSubsidy: monthNoSub,
    durationWithoutSubsidyMalayalam: durationNoSubMalayalam,
    totalInterestWithoutSubsidy: Math.round(totalInterestNoSub),
    interestSaved,
    monthsSaved,
    schedule,
  };
}

/**
 * Standard Bank Tenure Mode (e.g. 3, 5, 7, 10 Years).
 * Shows how the ₹78,000 subsidy drops the EMI significantly.
 */
export function calculateDiminishingLoanByTenure({
  loanAmount = 200000,
  annualInterestRate = 6.0,
  subsidyAmount = 78000,
  tenureYears = 5,
  subsidyCreditMonth = 1,
}) {
  const principal = Math.max(1000, Number(loanAmount || 200000));
  const rate = Math.max(0.1, Number(annualInterestRate || 6.0));
  const monthlyRate = rate / 100 / 12;
  const totalMonths = Math.max(6, Number(tenureYears || 5) * 12);
  const subsidy = Math.max(0, Number(subsidyAmount || 0));

  // Original EMI Formula: P * r * (1+r)^N / ((1+r)^N - 1)
  const factor = Math.pow(1 + monthlyRate, totalMonths);
  const originalEmi = Math.round((principal * monthlyRate * factor) / (factor - 1));
  const originalTotalPayment = originalEmi * totalMonths;
  const originalTotalInterest = Math.max(0, originalTotalPayment - principal);

  // If ₹78,000 subsidy credited at Month 1:
  // Month 1 payment
  const interestMonth1 = principal * monthlyRate;
  const principalPaidMonth1 = Math.max(0, originalEmi - interestMonth1);
  const remainingBalanceAfterMonth1 = Math.max(
    0,
    principal - principalPaidMonth1 - subsidy
  );

  // Revised EMI for remaining months (totalMonths - 1)
  const remainingMonths = totalMonths - 1;
  const factorRevised = Math.pow(1 + monthlyRate, remainingMonths);
  const revisedEmi =
    remainingMonths > 0 && remainingBalanceAfterMonth1 > 0
      ? Math.round(
          (remainingBalanceAfterMonth1 * monthlyRate * factorRevised) /
            (factorRevised - 1)
        )
      : 0;

  const revisedTotalCustomerPaid = originalEmi + revisedEmi * remainingMonths;
  const revisedTotalInterest = Math.max(
    0,
    Math.round(revisedTotalCustomerPaid - (principal - subsidy))
  );
  const monthlyEmiDrop = Math.max(0, originalEmi - revisedEmi);
  const totalInterestSaved = Math.max(0, originalTotalInterest - revisedTotalInterest);

  return {
    loanAmount: principal,
    annualInterestRate: rate,
    tenureYears,
    totalMonths,
    subsidyAmount: subsidy,
    originalEmi,
    originalTotalInterest,
    revisedEmi,
    monthlyEmiDrop,
    revisedTotalInterest,
    totalInterestSaved,
    remainingBalanceAfterSubsidy: Math.round(remainingBalanceAfterMonth1),
  };
}

/**
 * Formats a clean, high-conversion WhatsApp pitch for the customer.
 */
export function formatWhatsAppLoanPitch({
  customerName = "Customer",
  phone = "",
  location = "",
  systemKw = 3,
  loanAmount = 200000,
  annualInterestRate = 6.0,
  subsidyAmount = 78000,
  monthlyPayment = 2500,
  ksebMonthlyBill = null,
  branch = "chandapadi, ponnani",
  website = "https://echonix.in",
}) {
  const result = calculateDiminishingLoanByPayment({
    loanAmount,
    annualInterestRate,
    subsidyAmount,
    subsidyCreditMonth: 1,
    monthlyPayment,
  });

  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  let header = "";
  if (customerName || phone || location) {
    header = `👤 *കസ്റ്റമർ: ${customerName}*${phone ? ` (${phone})` : ""}${location ? ` - ${location}` : ""}\n\n`;
  }

  const ksebBillComparison = ksebMonthlyBill
    ? `\n💡 *കറന്റ് ബിൽ താരതമ്യം:*
നിങ്ങൾ ഇപ്പോൾ KSEB-ക്ക് നൽകുന്ന പ്രതിമാസ ബിൽ ഏകദേശം *${money(ksebMonthlyBill)}* ആണ്.
സോളാർ സ്ഥാപിക്കുന്നതോടെ ഈ കറന്റ് ബിൽ *₹0* ആകും!
ആ തുക (അല്ലെങ്കിൽ ${money(monthlyPayment)}) ലോണിലേക്ക് മാറ്റിയാൽ, അധിക ബാധ്യതയില്ലാതെ തന്നെ സിസ്റ്റം പൂർണ്ണമായും അടച്ചുതീർക്കാം!\n`
    : `\n💡 *ലാഭക്കണക്ക്:*
സോളാർ വരുന്നതോടെ നിങ്ങളുടെ KSEB കറന്റ് ബിൽ *₹0* ആകും! നിങ്ങൾ കറന്റ് ബില്ലിന് നൽകാറുള്ള അതേ തുക കൊണ്ട് ഈ ലോൺ ഫ്രീയായി അടച്ചുതീർക്കാം!\n`;

  return `${header}🌞 *ECHONIX സോളാർ ലോൺ & സബ്സിഡി കാൽക്കുലേഷൻ*
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *സിസ്റ്റം:* ${systemKw} KW On-Grid (PM സൂര്യഘർ)
💰 *ലോൺ തുക:* ${money(loanAmount)} (Diminishing @ ${annualInterestRate}%)
🎁 *കേന്ദ്ര സർക്കാർ സബ്സിഡി:* *${money(subsidyAmount)}*
(1 മാസത്തിനകം നിങ്ങളുടെ ലോൺ അക്കൗണ്ടിലേക്ക് നേരിട്ട് DBT ആയി ക്രെഡിറ്റ് ആകും)

👉 *സബ്സിഡിക്ക് ശേഷമുള്ള ബാക്കി ലോൺ: ${money(result.balanceAfterSubsidy)} മാത്രം!*
━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *പ്രതിമാസ തിരിച്ചടവ് പ്ലാൻ:*
• പ്രതിമാസം അടയ്ക്കുന്നത്: *${money(monthlyPayment)}*
• ലോൺ തീരുന്ന കാലാവധി: *${result.durationMalayalam}* (${result.totalMonths} മാസം)
• ആകെ വരുന്ന പലിശ: *${money(result.totalInterest)} മാത്രം!*
• സബ്സിഡി കാരണം ലാഭിക്കുന്ന പലിശ: *${money(result.interestSaved)}*
${ksebBillComparison}
🛡️ *ECHONIX വാറന്റി:*
✅ 25 വർഷം സോളാർ പാനൽ വാറന്റി
✅ 5 വർഷം സൗജന്യ സർവീസ്
✅ വേഗത്തിലുള്ള ബാങ്ക് ലോൺ & സബ്സിഡി ക്ലിയറൻസ്

🏢 ബ്രാഞ്ച്: ${branch}
🌐 ${website}`;
}
