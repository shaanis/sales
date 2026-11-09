/**
 * Notification and Calendar helper utilities for Site Visits and Lead Follow-ups
 */

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

/**
 * Check and trigger browser notifications for visits/calls due today
 */
export function checkAndNotifyFollowups(followups = []) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const todayStr = new Date().toLocaleDateString("en-CA");
  const notifiedKey = `notified_followups_${todayStr}`;
  const alreadyNotified = JSON.parse(
    sessionStorage.getItem(notifiedKey) || "[]"
  );

  const todayPending = followups.filter(
    (f) =>
      f.date === todayStr &&
      f.status !== "Completed" &&
      f.status !== "Cancelled" &&
      !alreadyNotified.includes(f.id)
  );

  todayPending.forEach((item) => {
    try {
      const timeText = item.time ? ` at ${formatTime(item.time)}` : "";
      const title = `🔔 ${item.type || "Site Visit"} Today: ${item.name}`;
      const options = {
        body: `Scheduled${timeText} in ${item.area || "customer location"}. Click to view details.`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `followup-${item.id}`,
      };

      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      alreadyNotified.push(item.id);
    } catch (err) {
      console.error("Could not send notification:", err);
    }
  });

  sessionStorage.setItem(notifiedKey, JSON.stringify(alreadyNotified));
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
 * Opens directly in the user's phone or browser Google Calendar
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

    // Default event duration: 1 hour
    const endH = String((parseInt(h, 10) + 1) % 24).padStart(2, "0");
    endStr = `${dateClean}T${endH}${startM}00`;
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
