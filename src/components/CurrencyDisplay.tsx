'use client';

import Image from 'next/image';

/**
 * CurrencyDisplay
 * Muestra los contadores de Donaciones y Estelas de forma responsiva.
 * En desktop: icono + etiqueta + número.
 * En mobile: solo icono + número (compacto).
 */

interface CurrencyDisplayProps {
  /** Donation Points (mostrado como "Donaciones" en la UI) */
  dp: number;
  estelas: number;
  /** Si true, muestra la versión compacta (solo icono + número) */
  compact?: boolean;
}

export function EstelaIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="estela-icon"
    >
      {/* Outer spectral ring */}
      <circle cx="12" cy="12" r="10" stroke="url(#estelaGrad)" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.7" />
      {/* Inner soul swirl */}
      <path
        d="M12 4 C8 4 5 7 5 11 C5 15 8 18 12 18 C16 18 18 15 18 12 C18 9 16 6 14 6 C12 6 10 8 10 10 C10 12 11.5 13 12 13"
        stroke="url(#estelaGrad)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Central spark */}
      <circle cx="12" cy="12" r="2.2" fill="url(#estelaCenter)" />
      {/* Sparkle top */}
      <line x1="12" y1="2" x2="12" y2="4" stroke="#c4b5fd" strokeWidth="1.4" strokeLinecap="round" />
      {/* Sparkle bottom */}
      <line x1="12" y1="20" x2="12" y2="22" stroke="#a78bfa" strokeWidth="1.4" strokeLinecap="round" />
      {/* Sparkle left */}
      <line x1="2" y1="12" x2="4" y2="12" stroke="#818cf8" strokeWidth="1.4" strokeLinecap="round" />
      {/* Sparkle right */}
      <line x1="20" y1="12" x2="22" y2="12" stroke="#818cf8" strokeWidth="1.4" strokeLinecap="round" />
      <defs>
        <linearGradient id="estelaGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <radialGradient id="estelaCenter" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#a78bfa" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export default function CurrencyDisplay({ dp, estelas, compact = false }: CurrencyDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Donaciones Compact */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/40 border border-[#d4af37]/30 shadow-[0_0_10px_rgba(212,175,55,0.15)]"
          title="Donaciones — Transferibles"
        >
          <Image
            src="/coin.png"
            alt="Donaciones"
            width={18}
            height={18}
            className="rounded-full ring-1 ring-yellow-500/40 shrink-0"
          />
          <span className="text-[11px] font-black text-[#f3dc90] tabular-nums leading-none">
            {dp.toLocaleString()}
          </span>
        </div>

        {/* Estelas Compact */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/40 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.2)] animate-estela-pulse"
          title="Estelas (Soulbound)"
        >
          <span className="shrink-0 flex items-center justify-center w-[18px] h-[18px]">
            <EstelaIcon size={18} />
          </span>
          <span className="text-[11px] font-black text-violet-300 tabular-nums leading-none">
            {estelas.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Donaciones Full */}
      <div
        className="flex items-center gap-2.5 px-3 pr-4 py-2 rounded-xl bg-black/35 border border-[#d4af37]/35 shadow-[0_0_14px_rgba(212,175,55,0.18)] hover:border-[#d4af37]/60 transition-all duration-300 group/dp"
        title="Donaciones — Transferibles. Úsalos para regalos, equipo y servicios."
      >
        <Image
          src="/coin.png"
          alt="Donaciones"
          width={28}
          height={28}
          className="rounded-full ring-2 ring-yellow-600/40 shadow-[0_0_12px_rgba(212,175,55,0.35)] shrink-0 group-hover/dp:shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-shadow duration-300"
        />
        <div className="leading-tight hidden lg:block">
          <p className="text-[9px] uppercase tracking-[0.2em] text-yellow-200/70 font-black">Donaciones</p>
          <p className="text-sm font-black text-[#f3dc90] tabular-nums">{dp.toLocaleString()}</p>
        </div>
        {/* Mobile: solo número */}
        <span className="text-[11px] font-black text-[#f3dc90] tabular-nums lg:hidden">{dp.toLocaleString()}</span>
      </div>

      {/* Estelas Full */}
      <div
        className="flex items-center gap-2.5 px-3 pr-4 py-2 rounded-xl bg-black/35 border border-violet-500/30 shadow-[0_0_14px_rgba(139,92,246,0.2)] hover:border-violet-400/60 transition-all duration-300 animate-estela-pulse group/estela"
        title="Estelas — Soulbound (Ligadas al alma). Solo para tu cuenta."
      >
        <span className="shrink-0 flex items-center justify-center w-[28px] h-[28px] rounded-full bg-violet-900/30 ring-2 ring-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.35)] group-hover/estela:shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-shadow duration-300">
          <EstelaIcon size={16} />
        </span>
        <div className="leading-tight hidden lg:block">
          <p className="text-[9px] uppercase tracking-[0.2em] text-violet-300/70 font-black">Estelas</p>
          <p className="text-sm font-black text-violet-300 tabular-nums">{estelas.toLocaleString()}</p>
        </div>
        {/* Mobile: solo número */}
        <span className="text-[11px] font-black text-violet-300 tabular-nums lg:hidden">{estelas.toLocaleString()}</span>
      </div>
    </div>
  );
}
