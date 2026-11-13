import React, { useState, useEffect } from "react";
import { Download, Share, X, Sparkles } from "lucide-react";
import { usePwaInstallPrompt } from "../pwa/registerServiceWorker";

export default function MobileInstallBanner() {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone ||
      document.referrer.includes("android-app://");

    setStandalone(Boolean(isStandaloneMode));

    // Check if device is iOS (iPhone/iPad)
    const userAgent = window.navigator.userAgent || "";
    const isAppleDevice =
      /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    setIsIos(isAppleDevice);

    // Check if dismissed previously in session
    if (sessionStorage.getItem("echonix-install-dismissed") === "true") {
      setDismissed(true);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem("echonix-install-dismissed", "true");
  }

  // Do not show if already installed, running in standalone mode, or user dismissed it
  if (standalone || isInstalled || dismissed) {
    return null;
  }

  // Only show on mobile devices (or when installable)
  if (!isInstallable && !isIos) {
    return null;
  }

  return (
    <div className="relative mx-3.5 my-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f766e] via-[#115e59] to-[#042f2e] p-3.5 text-white shadow-lg border border-teal-500/30 lg:hidden animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md shadow-inner text-amber-300">
            <Sparkles size={22} />
          </div>

          <div className="min-w-0 pr-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300 mb-1">
              Mobile App Available
            </div>
            <h4 className="text-xs font-black tracking-tight leading-tight text-white">
              Install ECHONIX on your Phone
            </h4>
            <p className="mt-0.5 text-[11px] text-teal-100/90 leading-snug">
              Works 100% offline on field sites. Open full-screen with 1 tap from your home screen.
            </p>

            {/* Android / Chrome Install Button */}
            {isInstallable && (
              <button
                type="button"
                onClick={promptInstall}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 px-3.5 py-1.5 text-xs font-black text-slate-950 shadow-md transition active:scale-95"
              >
                <Download size={14} />
                <span>Install Now</span>
              </button>
            )}

            {/* iOS Safari instructions */}
            {isIos && !isInstallable && (
              <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-black/25 px-2.5 py-1.5 text-[10px] font-semibold text-teal-100">
                <Share size={12} className="text-amber-300 shrink-0" />
                <span>
                  Tap <strong>Share</strong> in Safari ➔ <strong>'Add to Home Screen'</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-1 text-teal-200/70 hover:bg-white/10 hover:text-white transition shrink-0"
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
