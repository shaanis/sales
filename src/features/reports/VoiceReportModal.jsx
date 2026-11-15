import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  X,
  Volume2,
  AlertCircle,
  Copy,
  RotateCcw,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

import {
  isSpeechRecognitionSupported,
  playVoiceFeedbackSound,
  parseVoiceSalesNotes,
} from "./voiceAssistant";

export default function VoiceReportModal({ isOpen, onClose, onApplyExtracted }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [parsedData, setParsedData] = useState({});
  const recognitionRef = useRef(null);

  const supported = isSpeechRecognitionSupported();

  // Initialize SpeechRecognition on mount/open
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      return;
    }

    if (supported && typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // Indian English phonetics

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg("");
        playVoiceFeedbackSound("start");
      };

      recognition.onresult = (event) => {
        let current = "";
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript + " ";
        }
        setTranscript(current.trim());
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone permission denied. Please enable mic access or type below.");
        } else if (event.error !== "no-speech") {
          setErrorMsg(`Voice recognition: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      stopListening();
    };
  }, [isOpen, supported]);

  // Continuously parse transcript as it updates
  useEffect(() => {
    if (transcript) {
      const result = parseVoiceSalesNotes(transcript);
      setParsedData(result.extracted);
    } else {
      setParsedData({});
    }
  }, [transcript]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setErrorMsg("");
    try {
      recognitionRef.current.start();
    } catch {
      // If already started
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        playVoiceFeedbackSound("stop");
      } catch {
        // Ignored
      }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleApply = () => {
    if (Object.keys(parsedData).length === 0) {
      alert("No report fields were recognized. Please speak or type your daily notes.");
      return;
    }
    playVoiceFeedbackSound("success");
    onApplyExtracted(parsedData, transcript);
    onClose();
  };

  const loadSample = (sampleText) => {
    setTranscript(sampleText);
    stopListening();
  };

  if (!isOpen) return null;

  const extractedKeys = Object.keys(parsedData);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 animate-slide-up flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#102b32] to-[#164e57] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-teal-300">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-teal-500/30 text-teal-200">
                AI FIELD VOICE ASSISTANT
              </div>
              <h3 className="text-lg font-black tracking-tight text-white mt-0.5">
                Voice-to-Report Dictation
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 no-scrollbar">
          {/* Big Mic Button Centerpiece */}
          <div className="flex flex-col items-center justify-center pt-2">
            <div className="relative flex items-center justify-center">
              {/* Pulsing rings when listening */}
              {isListening && (
                <>
                  <span className="absolute w-24 h-24 rounded-full bg-rose-500/20 animate-ping" />
                  <span className="absolute w-28 h-28 rounded-full bg-rose-500/10 animate-pulse" />
                </>
              )}

              <button
                type="button"
                onClick={toggleListening}
                className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform active:scale-90 ${
                  isListening
                    ? "bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-500/40"
                    : "bg-gradient-to-tr from-[#12a594] to-teal-700 text-white shadow-teal-700/30 hover:scale-105"
                }`}
              >
                {isListening ? (
                  <MicOff size={32} className="animate-pulse" />
                ) : (
                  <Mic size={32} />
                )}
              </button>
            </div>

            <span className="mt-3 text-xs font-black tracking-wider uppercase">
              {isListening ? (
                <span className="text-rose-600 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  Listening... Speak your daily update
                </span>
              ) : (
                <span className="text-slate-600">
                  Tap microphone to speak or type notes
                </span>
              )}
            </span>

            {errorMsg && (
              <div className="mt-2 text-xs text-rose-600 font-semibold flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Quick Prompts / Samples */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Try saying or tap to test:
            </span>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() =>
                  loadSample(
                    "Worked at Kuttippuram with Ashraf. New leads 3, site survey 2 completed, collected KSEB bill. Payment collected 10000 rupees. Tomorrow focus Kuttippuram bank submission."
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition text-left"
              >
                ⚡ "Worked at Kuttippuram with Ashraf. New leads 3, site survey 2..."
              </button>

              <button
                type="button"
                onClick={() =>
                  loadSample(
                    "Visited Edappal and Tirur. Completed 1 site survey, 2 revisits. PO count 1 closed. Advance 15000 collected. Tomorrow focus customer meeting at Valanchery."
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition text-left"
              >
                ⚡ "Visited Edappal & Tirur. 1 site survey, 2 revisits, 1 PO..."
              </button>
            </div>
          </div>

          {/* Speech Transcript Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Recognized Speech / Notes</span>
                {isListening && (
                  <span className="text-[10px] text-teal-600 font-semibold animate-pulse">
                    (Streaming...)
                  </span>
                )}
              </label>
              {transcript && (
                <button
                  type="button"
                  onClick={() => setTranscript("")}
                  className="text-[11px] text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your spoken words will appear here in real time. You can also paste text from WhatsApp or voice notes..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-xs text-slate-900 outline-none focus:border-teal-600 focus:bg-white transition"
            />
          </div>

          {/* Extracted Fields Live Preview Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-teal-600" />
                Parsed Report Fields ({extractedKeys.length})
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Auto-extracted by AI parser
              </span>
            </div>

            {extractedKeys.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">
                Speak or paste your day summary above to extract fields automatically.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {parsedData.area && (
                  <div className="p-2 rounded-xl bg-teal-50/70 border border-teal-100">
                    <span className="text-[10px] font-bold text-teal-800 block uppercase">
                      Area Worked
                    </span>
                    <strong className="text-slate-900 truncate block">
                      {parsedData.area}
                    </strong>
                  </div>
                )}

                {parsedData.newLeads && (
                  <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-800 block uppercase">
                      New Leads
                    </span>
                    <strong className="text-slate-900">
                      {parsedData.newLeads}
                    </strong>
                  </div>
                )}

                {parsedData.siteSurvey && (
                  <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-100">
                    <span className="text-[10px] font-bold text-amber-800 block uppercase">
                      Site Survey Done
                    </span>
                    <strong className="text-slate-900">
                      {parsedData.siteSurvey}
                    </strong>
                  </div>
                )}

                {parsedData.revisits && (
                  <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-700 block uppercase">
                      Re-visits
                    </span>
                    <strong className="text-slate-900">
                      {parsedData.revisits}
                    </strong>
                  </div>
                )}

                {parsedData.poCount && (
                  <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-800 block uppercase">
                      PO Count Today
                    </span>
                    <strong className="text-emerald-700 font-black">
                      {parsedData.poCount}
                    </strong>
                  </div>
                )}

                {parsedData.paymentCollected && (
                  <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-800 block uppercase">
                      Payment Collected
                    </span>
                    <strong className="text-emerald-700 font-black">
                      {parsedData.paymentCollected}
                    </strong>
                  </div>
                )}

                {parsedData.documentsCollected && (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                    <span className="text-[10px] font-bold text-slate-700 block uppercase">
                      Documents Collected
                    </span>
                    <strong className="text-slate-900">
                      {parsedData.documentsCollected}
                    </strong>
                  </div>
                )}

                {parsedData.focus1 && (
                  <div className="p-2 rounded-xl bg-purple-50/70 border border-purple-100 col-span-2">
                    <span className="text-[10px] font-bold text-purple-800 block uppercase">
                      Tomorrow's Focus
                    </span>
                    <strong className="text-slate-900 block truncate">
                      1. {parsedData.focus1}
                    </strong>
                    {parsedData.focus2 && (
                      <span className="text-slate-700 block text-[11px] truncate">
                        2. {parsedData.focus2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={extractedKeys.length === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-black text-white flex items-center gap-2 shadow-sm transition active:scale-95 ${
              extractedKeys.length > 0
                ? "bg-teal-700 hover:bg-teal-800 shadow-teal-700/20"
                : "bg-slate-300 cursor-not-allowed text-slate-500"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Apply to Today's Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
