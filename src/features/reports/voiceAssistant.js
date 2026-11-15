/**
 * Speech Recognition & Natural Language Voice Parser for ECHONIX Field Sales
 * Uses the Web Speech API (Chrome, Edge, Safari, Android Webview)
 * with phonetic & keyword extraction for Malayalam / Indian English speech patterns.
 */

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );
}

// Web Audio API chimes for tactile feedback
export function playVoiceFeedbackSound(type = "start") {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "start") {
      // Pleasant rising double beep
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === "success") {
      // High chime
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.setValueAtTime(980, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Low closing tone
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch {
    // Audio context may be restricted by autoplay policy
  }
}

// Convert number words to numeric strings
const wordToNumber = (word) => {
  if (!word) return null;
  const cleaned = word.toLowerCase().trim();
  const map = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    onnu: 1, // Malayalam transliteration
    rendu: 2,
    moonu: 3,
    naalu: 4,
    anju: 5,
  };
  if (map[cleaned] !== undefined) return map[cleaned];
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
};

/**
 * Parses raw voice text into daily sales report fields
 */
export function parseVoiceSalesNotes(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { extracted: {}, rawText: "" };
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();
  const extracted = {};

  // Helper to find a number near a keyword
  const findNumberNear = (pattern) => {
    const match = lower.match(pattern);
    if (match) {
      const num = wordToNumber(match[1]);
      if (num !== null) return String(num);
    }
    return null;
  };

  // 1. New Leads
  const newLeadsVal =
    findNumberNear(/(?:new leads?|leads? collected|leads?)\s*(?:is|are|count)?\s*[:=-]?\s*(\b\w+\b)/) ||
    findNumberNear(/(\b\w+\b)\s*(?:new leads?|leads?)/);
  if (newLeadsVal) extracted.newLeads = newLeadsVal;

  // 2. Site Survey Done
  const surveyVal =
    findNumberNear(/(?:site surveys?|surveys?|survey done|site visit)\s*(?:is|are|count)?\s*[:=-]?\s*(\b\w+\b)/) ||
    findNumberNear(/(\b\w+\b)\s*(?:site surveys?|surveys?)/);
  if (surveyVal) extracted.siteSurvey = surveyVal;

  // 3. Proposals Sent
  const proposalVal =
    findNumberNear(/(?:proposals? sent|proposals?|quotations? sent|quotes?)\s*(?:is|are)?\s*[:=-]?\s*(\b\w+\b)/) ||
    findNumberNear(/(\b\w+\b)\s*(?:proposals?|quotations?|quotes? sent)/);
  if (proposalVal) extracted.proposalSent = proposalVal;

  // 4. Re-visits
  const revisitsVal =
    findNumberNear(/(?:re-?visits?|re visits?)\s*(?:is|are|count)?\s*[:=-]?\s*(\b\w+\b)/) ||
    findNumberNear(/(\b\w+\b)\s*(?:re-?visits?)/);
  if (revisitsVal) extracted.revisits = revisitsVal;

  // 5. PO Count
  const poVal =
    findNumberNear(/(?:po count|po received|po closed|orders?|po)\s*(?:is|are|count)?\s*[:=-]?\s*(\b\w+\b)/) ||
    findNumberNear(/(\b\w+\b)\s*(?:po count|po|deal closed)/);
  if (poVal) extracted.poCount = poVal;

  // 6. Dealer / B2B visits
  const dealerVal =
    findNumberNear(/(?:dealer visits?|dealers?|b2b visits?|b2b)\s*(?:is|are|count)?\s*[:=-]?\s*(\b\w+\b)/) ||
    findNumberNear(/(\b\w+\b)\s*(?:dealer visits?|dealers?)/);
  if (dealerVal) extracted.dealerVisits = dealerVal;

  // 7. Payment Collected
  const paymentMatch = lower.match(
    /(?:payment collected|payment|advance|collected amount|cash)\s*(?:is|of)?\s*[:=-]?\s*(?:rs\.?|inr|₹)?\s*(\d[\d,]*)/
  ) || lower.match(/(\d[\d,]*)\s*(?:rupees|rs|advance|payment)/);

  if (paymentMatch) {
    const rawNum = paymentMatch[1].replace(/,/g, "");
    const num = parseInt(rawNum, 10);
    if (!isNaN(num) && num > 0) {
      extracted.paymentCollected = `₹${num.toLocaleString("en-IN")}`;
    }
  }

  // 8. Documents Collected
  const docKeywords = [];
  if (/kseb(?:\s*bill)?|electricity bill/i.test(lower)) docKeywords.push("KSEB bill");
  if (/aadhaar|adhar|id proof/i.test(lower)) docKeywords.push("ID proof");
  if (/bank passbook|bank doc|cheque/i.test(lower)) docKeywords.push("Bank documents");
  if (/photo|roof photo/i.test(lower)) docKeywords.push("Site photos");
  if (docKeywords.length > 0) {
    extracted.documentsCollected = docKeywords.join(", ");
  }

  // 9. Area / Locations Worked
  const areaMatch =
    text.match(/(?:worked (?:at|in|with)|area(?:s)? covered|locations?|visited|route)\s*[:=-]?\s*([^.,\n]+(?:,[^.,\n]+)?)/i);
  if (areaMatch) {
    const cleanedArea = areaMatch[1].trim();
    if (cleanedArea.length > 2 && !/^\d+$/.test(cleanedArea)) {
      extracted.area = cleanedArea;
    }
  }

  // 10. Tomorrow's Focus Tasks
  const focusMatch = lower.match(/(?:tomorrow(?:'s)? focus|focus tomorrow|tomorrow priorities?)\s*[:=-]?\s*([\s\S]+)/);
  if (focusMatch) {
    const focusBody = focusMatch[1];
    // Split by numbered items "1.", "2.", "3." or commas or semicolons
    const items = focusBody
      .split(/(?:\b[123]\b[\.\)]|\bpoint\b|;|\n)/)
      .map((s) => s.trim().replace(/^[-•,]\s*/, ""))
      .filter((s) => s.length > 3);

    if (items[0]) extracted.focus1 = items[0];
    if (items[1]) extracted.focus2 = items[1];
    if (items[2]) extracted.focus3 = items[2];
  }

  // 11. Activity Type
  if (!extracted.activityType) {
    const acts = [];
    if (/survey|visit/i.test(lower)) acts.push("Site survey");
    if (/follow-?up|follow up/i.test(lower)) acts.push("Lead follow-up");
    if (/b2b|dealer/i.test(lower)) acts.push("Dealer meeting");
    if (acts.length > 0) extracted.activityType = acts.join(", ");
  }

  return {
    extracted,
    rawText: text,
  };
}
