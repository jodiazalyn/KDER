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
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    // Tear down any prior instance before starting fresh.
    recognitionRef.current?.abort();

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;

    let finalText = "";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += text;
        else interim += text;
      }
      setTranscript((finalText + interim).trim());
    };

    rec.onerror = () => {
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      const settled = finalText.trim();
      if (settled.length > 0) onFinalRef.current(settled);
      setTranscript("");
    };

    recognitionRef.current = rec;
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
