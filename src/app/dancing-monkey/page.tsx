"use client";

import Lottie from "lottie-react";
import dancingMonkeyAnimation from "@/assets/Dancing Monkey.json";

export default function DancingMonkeyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-md">
        <Lottie animationData={dancingMonkeyAnimation} loop />
      </div>
    </main>
  );
}
