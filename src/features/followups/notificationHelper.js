/**
 * Notification, Real-time Exact Alarm, and Calendar helper utilities
 */

/**
 * Play high-priority alert chime using Web Audio API (Zero external audio file dependency)
 */
export function playAlarmChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Helper to play synthesized tone
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + start + duration
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // 4-Tone Urgent Alarm Chime: High -> Higher -> High -> Highest
    playTone(880, 0, 0.22); // A5
    playTone(1174.66, 0.22, 0.28); // D6
    playTone(880, 0.52, 0.22); // A5
    playTone(1318.51, 0.74, 0.55); // E6
  } catch (err) {
    console.warn("Could not play alarm chime:", err);
  }
}

/**
 * Request Browser Notification permission
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return { supported: false, status: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    return { supported: true, status: permission };
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return { supported: true, status: Notification.permission || "denied" };
  }
}

// Track triggered alarms to prevent repeating the same alarm twice in a session
const triggeredAlarms = new Set();
let activeTimeouts = new Map();
let watchdogInterval = null;

/**
 * Fire the alarm immediately with audio chime, browser notification, and callback
 */
function fireAlarm(item, alarmKey, onTrigger) {
  if (alarmKey) {
    triggeredAlarms.add(alarmKey);
  }

  // 1. Fire browser desktop notification if permission granted
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      const timeStr = item.time ? ` [${formatTime(item.time)}]` : "";
      const title = `⏰ ALARM${timeStr}: ${item.type || "Site Visit"} with ${item.name}`;
      const options = {
        body: `📍 Location: ${item.area || "Site"}\n📞 Phone: ${item.phone || "N/A"}\n⚡ Requirement: ${item.requirement || "Solar Project"}\n\nTime reached right now! Click to open details.`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        requireInteraction: true, // DOES NOT DISAPPEAR UNTIL DISMISSED!
        tag: `exact-alarm-${item.id}-${item.time}`,
      };

      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (err) {
      console.error("Browser notification error:", err);
    }
  }

  // 3. Trigger in-app visual modal callback
  if (typeof onTrigger === "function") {
    onTrigger(item);
  }
}

export const checkAndNotifyFollowups = scheduleExactAlarms;

/**
 * Schedule Real-Time Exact-Second Alarms for upcoming appointments
 * Automatically calculates exact millisecond timeout + maintains 1-second watchdog
 */
export function scheduleExactAlarms(followups = [], onTrigger) {
  // Clear any existing timeouts
  activeTimeouts.forEach((tId) => clearTimeout(tId));
  activeTimeouts.clear();

  const todayStr = new Date().toLocaleDateString("en-CA");

  followups.forEach((item) => {
    if (
      !item ||
      !item.date ||
      !item.time ||
      item.status === "Completed" ||
      item.status === "Cancelled"
    ) {
      return;
    }

    if (item.date !== todayStr) return;

    const [h, m] = item.time.split(":");
    const target = new Date();
    target.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

    const targetMs = target.getTime();
    const nowMs = Date.now();
    const diffMs = targetMs - nowMs;

    const alarmKey = `${item.id}_${item.date}_${item.time}`;

    // If alarm is in the future today
    if (diffMs > 0) {
      const tId = setTimeout(() => {
        fireAlarm(item, alarmKey, onTrigger);
      }, diffMs);
      activeTimeouts.set(alarmKey, tId);
    } else if (diffMs >= -60000 && !triggeredAlarms.has(alarmKey)) {
      // If time just passed within the last 60 seconds (e.g. page just refreshed)
      fireAlarm(item, alarmKey, onTrigger);
    }
  });

  // 1-Second Watchdog Timer to eliminate any browser throttling or clock drift
  if (!watchdogInterval) {
    watchdogInterval = setInterval(() => {
      const now = Date.now();
      followups.forEach((item) => {
        if (
          !item ||
          !item.date ||
          !item.time ||
          item.status === "Completed" ||
          item.status === "Cancelled"
        ) {
          return;
        }

        if (item.date !== todayStr) return;

        const [h, m] = item.time.split(":");
        const target = new Date();
        target.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        const targetMs = target.getTime();

        const alarmKey = `${item.id}_${item.date}_${item.time}`;

        // If current second hits target within 1.5 seconds window and hasn't fired yet
        if (
          now >= targetMs &&
          now - targetMs < 60000 &&
          !triggeredAlarms.has(alarmKey)
        ) {
          fireAlarm(item, alarmKey, onTrigger);
        }
      });
    }, 1000);
  }
}

/**
 * Manually trigger an alarm for testing
 */
export function testAlarm(onTrigger) {
  const dummyItem = {
    id: "test-alarm",
    name: "Test Customer (Sample Lead)",
    phone: "9846012345",
    area: "Sample Site, Calicut",
    time: new Date().toTimeString().slice(0, 5),
    type: "Site Visit",
    requirement: "5 kW On-grid Solar",
  };
  fireAlarm(dummyItem, null, onTrigger);
}

/**
 * Format 24-hr time (e.g. "14:30") to 12-hr with AM/PM (e.g. "2:30 PM")
 */
export function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return timeStr;

  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minStr || "00"} ${ampm}`;
}

/**
 * Generate 1-click Google Calendar Event URL
 * Starts at the exact scheduled time with instant notifications
 */
export function generateGoogleCalendarUrl(item) {
  if (!item || !item.date) return "";

  const title = encodeURIComponent(
    `[ECHONIX] ${item.type || "Site Visit"}: ${item.name}`
  );
  const location = encodeURIComponent(item.area || "");
  const details = encodeURIComponent(
    `Customer: ${item.name}\nPhone: ${item.phone || "N/A"}\nType: ${item.type || "Site Visit"}\nRequirement: ${item.requirement || "Solar Project"}\nNotes: ${item.notes || "None"}`
  );

  const dateClean = item.date.replace(/-/g, "");
  let startStr = dateClean;
  let endStr = dateClean;

  if (item.time) {
    const [h, m] = item.time.split(":");
    const startH = h.padStart(2, "0");
    const startM = (m || "00").padStart(2, "0");
    startStr = `${dateClean}T${startH}${startM}00`;

    // 10 minutes slot instead of 1 hour
    const startMinutesTotal = parseInt(h, 10) * 60 + parseInt(m || "00", 10);
    const endMinutesTotal = (startMinutesTotal + 10) % (24 * 60);
    const endH = String(Math.floor(endMinutesTotal / 60)).padStart(2, "0");
    const endM = String(endMinutesTotal % 60).padStart(2, "0");
    endStr = `${dateClean}T${endH}${endM}00`;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
}

/**
 * Generate WhatsApp message URL to confirm visit with the customer
 */
export function generateCustomerWhatsAppUrl(item, executiveName = "") {
  if (!item || !item.phone) return "";

  const phone = item.phone.replace(/\D/g, "");
  const formattedPhone = phone.length === 10 ? `91${phone}` : phone;

  const timeText = item.time ? ` at ${formatTime(item.time)}` : "";
  const dateFormatted = item.date
    ? item.date.split("-").reverse().join("/")
    : "the scheduled date";

  const message = `Hello ${item.name},
This is ${executiveName || "ECHONIX Solar Sales Team"}. 
Confirming our ${item.type || "Site Visit"} scheduled on *${dateFormatted}${timeText}* at your location (${item.area || "site"}). 

Please feel free to reach out if you need any adjustments to the schedule. Thank you!`;

  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
}
