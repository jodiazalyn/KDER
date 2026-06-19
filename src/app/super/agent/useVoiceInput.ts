"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser voice-input hook for the Super Dashboard analyst.
 *
 * Wraps the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
 * so a cofounder can dictate a question instead of typing. Recognition runs
 * entirely client-side in the browser — nothing is uploaded by us. We stream
 * interim results into `transcript` so the input field updates live, and call
 * `onFinal` once with the settled text when the user stops talking.
 *
 * `supported` is false on browsers without the API (e.g. Firefox) — callers
 * should hide the mic button in that case rather than show a dead control.
 */

// The Web Speech API isn't in the TS DOM lib yet; describe the slice we use.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

// Errors that mean "give up" — anything else is transient and we resume.
const FATAL_SPEECH_ERRORS = new Set(["not-allowed", "service-not-allowed"]);
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  // The user explicitly tapped stop (vs. the engine auto-ending). Only an
  // intentional stop finalizes + submits; an engine-initiated `onend` resumes.
  const intentionalStopRef = useRef(false);
  // Accumulated final transcript, kept in a ref so it survives the engine's
  // periodic auto-restarts (Chrome ends recognition even in continuous mode).
  const finalTextRef = useRef("");

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    // Detect capability after mount, not during render — `window` isn't
    // available on the server and reading it in render would cause a
    // hydration mismatch on the mic button.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getRecognitionCtor() != null);
    return () => {
      // Detach handlers so teardown can't resurrect, finalize, or setState
      // after unmount; then abort.
      const rec = recognitionRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      }
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    // Tear down any prior instance before starting fresh. Detach its
    // handlers first so a stale onend can't race and resurrect/finalize.
    const prev = recognitionRef.current;
    if (prev) {
      prev.onresult = null;
      prev.onerror = null;
      prev.onend = null;
      prev.abort();
    }

    const rec = new Ctor();
    rec.lang = "en-US";
    // Stay open across natural pauses — `false` would auto-stop (and, via the
    // panel's onFinal wiring, auto-submit) on the first brief silence.
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) finalTextRef.current += text;
        else interim += text;
      }
      setTranscript((finalTextRef.current + interim).trim());
    };

    rec.onerror = (e) => {
      // Permission/service errors are fatal — stop cleanly, no restart loop.
      // Everything else (no-speech, aborted, network blips) is transient and
      // handled by the resume path in onend.
      if (e?.error && FATAL_SPEECH_ERRORS.has(e.error)) {
        intentionalStopRef.current = true;
        setListening(false);
      }
    };

    rec.onend = () => {
      if (intentionalStopRef.current) {
        // User tapped stop (or we're tearing down): finalize once.
        intentionalStopRef.current = false;
        setListening(false);
        const settled = finalTextRef.current.trim();
        finalTextRef.current = "";
        setTranscript("");
        if (settled.length > 0) onFinalRef.current(settled);
        return;
      }
      // Engine auto-ended while the user still intends to dictate — resume
      // without firing onFinal, preserving the accumulated transcript.
      try {
        rec.start();
      } catch {
        // start() throws if it's already running — safe to ignore.
      }
    };

    recognitionRef.current = rec;
    finalTextRef.current = "";
    intentionalStopRef.current = false;
    setTranscript("");
    setListening(true);
    try {
      rec.start();
    } catch {
      // start() throws if called while already running — ignore.
      setListening(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, transcript, start, stop, toggle };
}
