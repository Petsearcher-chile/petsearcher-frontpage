"use client";

import { useEffect } from "react";

export default function BrowserLanguageLogger() {
  useEffect(() => {
    console.log("Browser language:", navigator.language);
    console.log("Browser languages:", navigator.languages);
  }, []);

  return null;
}
