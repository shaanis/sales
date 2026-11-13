import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, Download, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNetworkStatus, usePwaInstallPrompt } from "../pwa/registerServiceWorker";

export default function NetworkStatusBadge({ variant = "badge" }) {
  const { isOnline, wasOffline } = useNetworkStatus();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstallPrompt();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    function handleUpdate() {
      setUpdateAvailable(true);
    }
    window.addEventListener("echonix-pwa-update", handleUpdate);
    return () => window.removeEventListener("echonix-pwa-update", handleUpdate);
  }, []);

  function handleRefreshUpdate() {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  }

  async function handleInstallClick() {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  }

  // 1. Full-width top banner for offline status
  if (variant === "banner") {
    if (!isOnline) {
      return (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md transition-all animate-fade-in">
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="animate-pulse shrink-0" />
            <span>
              <strong>Offline Mode:</strong> No internet connection. You can continue creating reports, leads, and expenses — all data is saved securely to your device and will sync automatically when back online.
            </span>
          </div>
          <span className="shrink-0 bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2">
            Local Storage Active
          </span>
        </div>
      );
    }

    if (wasOffline && isOnline) {
      return (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md transition-all animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>
              <strong>Back Online:</strong> Internet connection restored. Local changes are syncing to cloud.
            </span>
          </div>
          <span className="shrink-0 bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2">
            Synced
          </span>
        </div>
      );
    }

    if (updateAvailable) {
      return (
        <div className="bg-teal-700 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md transition-all">
          <div className="flex items-center gap-2">
            <RefreshCw size={15} className="animate-spin shrink-0" />
            <span>A new version of ECHONIX Sales is available.</span>
          </div>
          <button
            onClick={handleRefreshUpdate}
            className="bg-white text-teal-800 hover:bg-teal-50 px-3 py-1 rounded-lg text-xs font-bold transition shadow-sm"
          >
            Update Now
          </button>
        </div>
      );
    }

    return null;
  }

  // 2. Sidebar / Header Widget
  return (
    <div className="space-y-2">
      {/* Install Button (Shows if app is installable) */}
      {isInstallable && !isInstalled && (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:from-teal-600 hover:to-emerald-700 active:scale-95 disabled:opacity-70"
          title="Install ECHONIX Sales app on your device for fast offline access"
        >
          <Download size={15} className="animate-bounce" />
          <span>{installing ? "Installing..." : "Install App on Device"}</span>
        </button>
      )}

      {/* Online / Offline Status Indicator */}
      <div
        className={`flex items-center justify-between rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
          isOnline
            ? "bg-[#183940] text-[#a4c2c5]"
            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
        }`}
      >
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
            </span>
          )}
          <span>{isOnline ? "Online · Cloud Sync" : "Offline · Local Storage"}</span>
        </div>

        {isOnline ? (
          <Wifi size={13} className="text-emerald-400 opacity-80" />
        ) : (
          <WifiOff size={13} className="text-amber-400" />
        )}
      </div>

      {/* Update Available notification button */}
      {updateAvailable && (
        <button
          type="button"
          onClick={handleRefreshUpdate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600/30 border border-teal-400/40 px-3 py-2 text-xs font-bold text-teal-200 hover:bg-teal-600/50 transition"
        >
          <RefreshCw size={13} />
          <span>Update Available (Tap)</span>
        </button>
      )}
    </div>
  );
}
