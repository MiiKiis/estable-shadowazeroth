'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, User, Menu, X } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [donationPoints, setDonationPoints] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const syncAuthState = () => {
      const raw = localStorage.getItem('user');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setIsLoggedIn(true);
          setUsername(parsed.username || '');
          setAccountId(Number(parsed.id) || null);
        } catch {
          setIsLoggedIn(false);
          setUsername('');
          setAccountId(null);
          setDonationPoints(0);
        }
      } else {
        setIsLoggedIn(false);
        setUsername('');
        setAccountId(null);
        setDonationPoints(0);
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
      return;
    }

    let cancelled = false;

    const loadDonationPoints = async () => {
      try {
        const response = await fetch(`/api/account/points?accountId=${accountId}`, { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'No se pudo obtener los creditos');
        }

        if (!cancelled) {
          setDonationPoints(Number(data?.dp || data?.credits || 0));
        }
      } catch {
        if (!cancelled) {
          setDonationPoints(0);
        }
      }
    };

    loadDonationPoints();

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
    setMenuOpen(false);
    router.push('/');
  };

  const navLinks = [
    { name: 'Inicio', href: '/' },
    { name: 'Noticias', href: '/news' },
    { name: 'Foro', href: '/forum' },
    { name: 'Addons', href: '/addons' },
    { name: 'Staff', href: '/staff' },
  ];

  return (
    <header className="fixed top-0 left-0 w-full z-[80] shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
      {/* Background layer */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#06080f] via-[#0b0e1c] to-[#0e0817] border-b border-white/10" />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-2xl" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <div className="relative w-16 h-16 shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-600/40 blur-md scale-110 group-hover:opacity-100 opacity-70 transition-opacity duration-300" />
            <div className="absolute inset-0 rounded-full border border-cyan-300/40" />
            <Image
              src="/shadow_azeroth.png"
              alt="Shadow Azeroth"
              fill
              className="object-cover rounded-full"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-base sm:text-lg tracking-wider text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
              SHADOW AZEROTH
            </span>
            <span className="text-[10px] tracking-[0.2em] text-cyan-300/70 font-semibold uppercase">
              WotLK 3.3.5a
            </span>
          </div>
        </Link>

        {/* Desktop Navigation - always visible */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`relative px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest transition-all duration-200 ${isActive
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

        {/* Right side: Auth */}
        <div className="flex items-center gap-3 shrink-0">
          {isLoggedIn ? (
            <>
              <div className="hidden lg:flex items-center gap-3 px-3 pr-4 py-2 rounded-xl bg-black/35 border border-cyan-400/30">
                <Image
                  src="/coin.png"
                  alt="Créditos"
                  width={30}
                  height={30}
                  className="rounded-full ring-2 ring-purple-400/40 shadow-[0_0_18px_rgba(168,85,247,0.45)] shrink-0"
                />
                <div className="leading-tight">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80 font-black">Créditos</p>
                  <p className="text-sm font-black text-white">{donationPoints.toLocaleString()}</p>
                </div>
              </div>

              {/* User badge */}
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 border border-white/12 hover:bg-white/14 transition-all duration-200"
              >
                <User className="w-4 h-4 text-cyan-300" />
                <span className="text-sm font-bold text-white max-w-[120px] truncate">{username}</span>
              </Link>
              {/* Botón de cerrar sesión eliminado, ya está abajo */}
            </>
          ) : null}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg bg-white/8 border border-white/12 hover:bg-white/14 transition-colors text-slate-200"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="relative md:hidden border-t border-white/10 bg-[#07090f]/95 backdrop-blur-2xl">
          <nav className="max-w-7xl mx-auto px-5 py-4 flex flex-col gap-1">
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
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="mt-2 px-4 py-3 rounded-xl text-sm font-bold text-cyan-300 hover:text-white hover:bg-white/8 transition-all flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                {username || 'Mi cuenta'}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
