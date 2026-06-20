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

// Auto-submit when the speaker goes quiet, so finishing a sentence makes
// Cleopatra react without a second tap. A short grace absorbs natural
// thinking-pauses with no UI; after that a visible countdown gives the
// speaker a beat to keep talking (which cancels) before we finalize. Each
// new speech result resets both, so only a real end-of-turn silence submits.
const SILENCE_GRACE_MS = 1200;
const COUNTDOWN_MS = 1500;
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
  // 0 when idle; ramps 0→1 over COUNTDOWN_MS once the speaker goes quiet, so
  // the UI can draw a "about to send" ring that the speaker can cancel by
  // talking again.
  const [countdownProgress, setCountdownProgress] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  // The user explicitly tapped stop (vs. the engine auto-ending). Only an
  // intentional stop finalizes + submits; an engine-initiated `onend` resumes.
  const intentionalStopRef = useRef(false);
  // Accumulated final transcript, kept in a ref so it survives the engine's
  // periodic auto-restarts (Chrome ends recognition even in continuous mode).
  const finalTextRef = useRef("");
  // Silence-endpointing timers: a grace timeout before the countdown starts,
  // and the interval that drives the countdown ring + the eventual submit.
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Cancel any pending silence-submit and hide the countdown ring. Called on
  // every new speech result (they're still talking), on manual stop, and on
  // teardown.
  const clearEndpointing = useCallback(() => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownProgress(0);
  }, []);

  // Finalize the current utterance as if the user tapped stop: route through
  // the engine's `onend` (intentional branch) so the finalize/submit logic
  // lives in exactly one place.
  const finalizeNow = useCallback(() => {
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // (Re)start the silence clock. After SILENCE_GRACE_MS of quiet we begin a
  // visible COUNTDOWN_MS ring; if it completes without new speech, we submit.
  const scheduleEndpointing = useCallback(() => {
    clearEndpointing();
    graceTimerRef.current = setTimeout(() => {
      const startedAt = Date.now();
      countdownIntervalRef.current = setInterval(() => {
        const p = Math.min((Date.now() - startedAt) / COUNTDOWN_MS, 1);
        setCountdownProgress(p);
        if (p >= 1) {
          clearEndpointing();
          finalizeNow();
        }
      }, 50);
    }, SILENCE_GRACE_MS);
  }, [clearEndpointing, finalizeNow]);

  useEffect(() => {
    // Detect capability after mount, not during render — `window` isn't
    // available on the server and reading it in render would cause a
    // hydration mismatch on the mic button.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getRecognitionCtor() != null);
    return () => {
      // Detach handlers so teardown can't resurrect, finalize, or setState
      // after unmount; then abort.
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
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
    clearEndpointing();
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    setListening(false);
  }, [clearEndpointing]);

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
      // They're still talking — reset the silence clock so we only auto-submit
      // after a genuine end-of-turn pause.
      if (finalTextRef.current.trim() || interim.trim()) scheduleEndpointing();
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
        // User tapped stop, the silence countdown fired, or we're tearing
        // down: finalize once.
        clearEndpointing();
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
    clearEndpointing();
    setTranscript("");
    setListening(true);
    try {
      rec.start();
    } catch {
      // start() throws if called while already running — ignore.
      setListening(false);
    }
  }, [clearEndpointing, scheduleEndpointing]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return {
    supported,
    listening,
    transcript,
    countdownProgress,
    start,
    stop,
    toggle,
  };
}
