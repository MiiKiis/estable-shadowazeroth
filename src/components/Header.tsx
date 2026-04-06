'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, User, Menu, X, Wallet } from 'lucide-react';
import CurrencyDisplay, { EstelaIcon } from './CurrencyDisplay';
import ParallaxImage from './ParallaxImage';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [donationPoints, setDonationPoints] = useState(0);
  const [estelas, setEstelas] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  useEffect(() => {
    const syncAuthState = () => {
      const raw = localStorage.getItem('user');
      if (raw) {
        try {
          interface UserData {
            id: string | number;
            username: string;
          }
          const parsed = JSON.parse(raw) as UserData;
          setIsLoggedIn(true);
          setUsername(parsed.username || '');
          setAccountId(Number(parsed.id) || null);
        } catch {
          setIsLoggedIn(false);
          setUsername('');
          setAccountId(null);
          setDonationPoints(0);
          setEstelas(0);
        }
      } else {
        setIsLoggedIn(false);
        setUsername('');
        setAccountId(null);
        setDonationPoints(0);
        setEstelas(0);
      }
    };

    syncAuthState();
    window.addEventListener('storage', syncAuthState);
    window.addEventListener('focus', syncAuthState);
    window.addEventListener('pageshow', syncAuthState);
    document.addEventListener('visibilitychange', syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('focus', syncAuthState);
      window.removeEventListener('pageshow', syncAuthState);
      document.removeEventListener('visibilitychange', syncAuthState);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isLoggedIn || !accountId) {
      setDonationPoints(0);
      setEstelas(0);
      return;
    }

    let cancelled = false;

    const loadPoints = async () => {
      try {
        const response = await fetch(`/api/account/points?accountId=${accountId}`, { cache: 'no-store' });
        interface PointsData {
          dp?: number;
          vp?: number;
          error?: string;
        }
        const data = await response.json() as PointsData;

        if (!response.ok) {
          throw new Error(data?.error || 'No se pudo obtener los puntos');
        }

        if (!cancelled) {
          setDonationPoints(Number(data?.dp || 0));
          setEstelas(Number(data?.vp || 0));
        }
      } catch {
        if (!cancelled) {
          setDonationPoints(0);
          setEstelas(0);
        }
      }
    };

    loadPoints();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, accountId]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUsername('');
    setAccountId(null);
    setDonationPoints(0);
    setEstelas(0);
    setMenuOpen(false);
    setWalletOpen(false);
    router.push('/');
  };

  const navLinks = [
    { name: 'Inicio', href: '/' },
    ...(isLoggedIn ? [{ name: 'Marketplace', href: '/armory/marketplace' }] : []),
    { name: 'Noticias', href: '/news' },
    { name: 'Foro', href: '/forum' },
    { name: 'Addons', href: '/addons' },
    { name: 'Staff', href: '/staff' },
  ];

  return (
    <header className="fixed top-0 left-0 w-full z-[80] shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#06080f] via-[#0b0e1c] to-[#0e0817] border-b border-white/10" />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-2xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-2 sm:gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 group">
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-600/40 blur-md scale-110 group-hover:opacity-100 opacity-70 transition-opacity duration-300" />
            <div className="absolute inset-0 rounded-full border border-cyan-300/40" />
            <ParallaxImage
              src="/shadow-azeroth.png"
              alt="Shadow Azeroth"
              width={64}
              height={64}
              scale={1.4}
              delay={0.2}
              className="object-cover rounded-full"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-sm sm:text-lg tracking-wider text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
              SHADOW AZEROTH
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-[0.2em] text-cyan-300/70 font-semibold uppercase">
              WotLK 3.3.5a
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`relative px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-bold uppercase tracking-widest transition-all duration-200 ${isActive
                    ? 'text-white bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/8'
                  }`}
              >
                {link.name}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side: Auth + Currency */}
        <div className="flex items-center gap-2 shrink-0">
          {isLoggedIn ? (
            <>
              {/* ─── DESKTOP CURRENCY DISPLAY ─── */}
              <div className="hidden lg:block">
                <CurrencyDisplay dp={donationPoints} estelas={estelas} />
              </div>

              {/* ─── TABLET: compact display (sm..lg) ─── */}
              <div className="hidden sm:flex lg:hidden items-center">
                <CurrencyDisplay dp={donationPoints} estelas={estelas} compact />
              </div>

              {/* ─── MOBILE: wallet toggle button ─── */}
              <div className="relative sm:hidden">
                <button
                  type="button"
                  id="mobile-wallet-toggle"
                  onClick={() => setWalletOpen((prev) => !prev)}
                  aria-label="Ver monedas"
                  className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-black/40 border border-violet-500/30 hover:border-violet-400/60 transition-all"
                >
                  <Wallet className="w-4 h-4 text-violet-300" />
                  {/* dot indicator */}
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                </button>

                {/* Wallet dropdown for mobile */}
                {walletOpen && (
                  <div className="absolute top-11 right-0 z-50 w-56 rounded-2xl border border-white/15 bg-[#0a0c14]/97 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.7)] p-3 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 px-1 pb-1 border-b border-white/8">
                      Tu Billetera
                    </p>
                    {/* DP row */}
                    <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-black/30 border border-yellow-600/20">
                      <Image src="/coin.png" alt="Donaciones" width={26} height={26} className="rounded-full ring-1 ring-yellow-500/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase tracking-widest text-yellow-200/60 font-black">Donaciones</p>
                        <p className="text-sm font-black text-[#f3dc90] tabular-nums">{donationPoints.toLocaleString()}</p>
                      </div>
                    </div>
                    {/* Estelas row */}
                    <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-black/30 border border-violet-500/20 animate-estela-pulse">
                      <span className="shrink-0 flex items-center justify-center w-[26px] h-[26px] rounded-full bg-violet-900/40 ring-1 ring-violet-500/40">
                        <EstelaIcon size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase tracking-widest text-violet-300/60 font-black">Estelas <span className="normal-case text-violet-400/50">(Soulbound)</span></p>
                        <p className="text-sm font-black text-violet-300 tabular-nums">{estelas.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="pt-1 border-t border-white/8">
                      <Link
                        href="/donate"
                        onClick={() => setWalletOpen(false)}
                        className="flex items-center justify-center gap-1.5 w-full h-8 rounded-lg bg-violet-700/20 border border-violet-500/30 text-violet-300 text-[10px] font-black uppercase tracking-widest hover:bg-violet-700/35 transition-colors"
                      >
                        Comprar Estelas
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* User badge — hidden on mobile */}
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/8 border border-white/12 hover:bg-white/14 transition-all duration-200"
              >
                <User className="w-4 h-4 text-cyan-300" />
                <span className="text-sm font-bold text-white max-w-[100px] truncate hidden md:inline">{username}</span>
              </Link>
            </>
          ) : null}

          {/* Mobile hamburger */}
          <button
            type="button"
            id="mobile-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg bg-white/8 border border-white/12 hover:bg-white/14 transition-colors text-slate-200"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="relative md:hidden border-t border-white/10 bg-[#07090f]/97 backdrop-blur-2xl">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${isActive
                      ? 'text-white bg-white/10'
                      : 'text-slate-300 hover:text-white hover:bg-white/8'
                    }`}
                >
                  {link.name}
                </Link>
              );
            })}

            {isLoggedIn && (
              <>
                <div className="mt-2 pt-2 border-t border-white/8 flex gap-2">
                  {/* Donaciones compact */}
                  <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl bg-black/35 border border-yellow-600/25">
                    <Image src="/coin.png" alt="Donaciones" width={20} height={20} className="rounded-full ring-1 ring-yellow-500/40 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] uppercase tracking-widest text-yellow-200/60 font-black leading-none">Donaciones</p>
                      <p className="text-sm font-black text-[#f3dc90] tabular-nums">{donationPoints.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Estelas compact */}
                  <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl bg-black/35 border border-violet-500/25 animate-estela-pulse">
                    <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-violet-900/30">
                      <EstelaIcon size={12} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[8px] uppercase tracking-widest text-violet-300/60 font-black leading-none">Estelas</p>
                      <p className="text-sm font-black text-violet-300 tabular-nums">{estelas.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 px-4 py-3 rounded-xl text-sm font-bold text-cyan-300 hover:text-white hover:bg-white/8 transition-all flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  {username || 'Mi cuenta'}
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-3 rounded-xl text-sm font-bold text-rose-400 hover:text-white hover:bg-rose-900/20 transition-all flex items-center gap-2 text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
