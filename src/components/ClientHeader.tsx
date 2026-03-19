"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
const Header = dynamic(() => import("./Header"), { ssr: false });

export default function ClientHeader() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    // Evita renderizar en SSR y durante la hidratación
    return null;
  }
  return <Header />;
}