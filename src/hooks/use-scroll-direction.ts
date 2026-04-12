"use client";

import { useEffect, useState } from "react";

export function useScrollDirection() {
  const [scrollDir, setScrollDir] = useState<"up" | "down">("up");

  useEffect(() => {
    let lastY = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      if (Math.abs(currentY - lastY) < 5) return;
      setScrollDir(currentY > lastY ? "down" : "up");
      lastY = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return scrollDir;
}
