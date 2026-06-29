"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";
import wizardAnimation from "@/assets/Hi Wizard.json";

const SPEECH_STEPS = [
  { text: "Hola!", delayMs: 1600 },
  { text: "Talvez sea la primera vez que te veo por acá.", delayMs: 4000 },
  {
    text: "Lamento informarte que este sitio solo es visible desde un computador.",
    delayMs: 6000,
  },
  { text: "Nos vemos allá!", delayMs: 4000 },
] as const;

export default function WarningWizardPage() {
  const [speechIndex, setSpeechIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(true);

  useEffect(() => {
    const timeoutIds: number[] = [];
    let isCancelled = false;
    let currentIndex = 0;

    const scheduleStep = (stepIndex: number) => {
      const step = SPEECH_STEPS[stepIndex];
      const timeoutId = window.setTimeout(() => {
        if (isCancelled) {
          return;
        }

        if (stepIndex < SPEECH_STEPS.length - 1) {
          currentIndex += 1;
          setSpeechIndex(currentIndex);
          scheduleStep(currentIndex);
          return;
        }

        setIsSpeaking(false);
      }, step.delayMs);

      timeoutIds.push(timeoutId);
    };

    scheduleStep(0);

    return () => {
      isCancelled = true;
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="flex w-full max-w-4xl flex-col items-center justify-center gap-6">
        <div
          className={`relative rounded-3xl border border-white/10 bg-white/8 px-6 py-4 text-center shadow-2xl shadow-black/30 backdrop-blur-sm transition-all duration-700 ${
            isSpeaking ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
          }`}
          aria-live="polite"
        >
          <p className="max-w-[28rem] whitespace-pre-line text-lg font-medium leading-relaxed text-zinc-100 sm:text-xl">
            {SPEECH_STEPS[speechIndex].text}
          </p>
          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-10 border-t-10 border-x-transparent border-t-white/8" />
        </div>

        <div className="h-[60vh] w-[min(85vw,60vh)]">
          <Lottie animationData={wizardAnimation} loop />
        </div>
      </section>
    </main>
  );
}
