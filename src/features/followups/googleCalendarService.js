import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../../lib/firebase";

const GOOGLE_TOKEN_KEY = "echonix_google_calendar_token";
const GOOGLE_TOKEN_EXPIRY = "echonix_google_calendar_token_expiry";

/**
 * Check if Google Calendar OAuth token exists and is valid
 */
export function getSavedGoogleToken() {
  try {
    const token = localStorage.getItem(GOOGLE_TOKEN_KEY);
    const expiry = localStorage.getItem(GOOGLE_TOKEN_EXPIRY);
    if (!token) return null;
    if (expiry && Date.now() > Number(expiry)) {
      localStorage.removeItem(GOOGLE_TOKEN_KEY);
      localStorage.removeItem(GOOGLE_TOKEN_EXPIRY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Save Google OAuth access token
 */
export function saveGoogleToken(token, expiresInSeconds = 3600) {
  try {
    localStorage.setItem(GOOGLE_TOKEN_KEY, token);
    const expiryTime = Date.now() + (expiresInSeconds - 60) * 1000;
    localStorage.setItem(GOOGLE_TOKEN_EXPIRY, String(expiryTime));
  } catch (err) {
    console.error("Could not store token:", err);
  }
}

/**
 * Remove saved Google token
 */
export function clearGoogleToken() {
  try {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_TOKEN_EXPIRY);
  } catch {}
}

/**
 * Connect user's Google Account with Google Calendar API scope
 */
export async function connectGoogleCalendar() {
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/calendar.events");
  // Request offline access if needed
  provider.setCustomParameters({
    prompt: "consent",
    access_type: "online",
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (accessToken) {
    saveGoogleToken(accessToken);
    return { success: true, token: accessToken, user: result.user };
  }

  throw new Error("Could not retrieve Google Calendar access token.");
}

/**
 * Automatically create an event in user's primary Google Calendar via REST API
 */
export async function createGoogleCalendarEvent(accessToken, followup) {
  if (!accessToken) {
    throw new Error("No Google access token provided.");
  }

  const { date, time, name, phone, area, type, requirement, notes } = followup;

  // Build Start and End ISO DateTime strings
  // Format: "YYYY-MM-DDTHH:mm:ss"
  const timeStr = time || "10:00";
  const [h, m] = timeStr.split(":");
  const startHour = h.padStart(2, "0");
  const startMin = (m || "00").padStart(2, "0");

  const startIso = `${date}T${startHour}:${startMin}:00`;

  // Default duration: 1 hour
  const endHourNum = (parseInt(h, 10) + 1) % 24;
  const endHour = String(endHourNum).padStart(2, "0");
  const endIso = `${date}T${endHour}:${startMin}:00`;

  // Get local timezone, e.g. "Asia/Kolkata"
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";

  const eventPayload = {
    summary: `[ECHONIX] ${type || "Site Visit"}: ${name}`,
    location: area || "",
    description: `Customer: ${name}\nPhone: ${phone || "N/A"}\nType: ${type || "Site Visit"}\nRequirement: ${requirement || "Solar Project"}\nNotes: ${notes || "None"}\n\nScheduled via ECHONIX Field Sales App`,
    start: {
      dateTime: `${startIso}+05:30`, // default to IST offset or ISO
      timeZone: timeZone,
    },
    end: {
      dateTime: `${endIso}+05:30`,
      timeZone: timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 }, // 30 minutes before on mobile
        { method: "popup", minutes: 60 }, // 1 hour before
      ],
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData?.error?.message ||
      `Google Calendar API error (HTTP ${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();
  return {
    success: true,
    eventId: data.id,
    htmlLink: data.htmlLink,
  };
}
