'use client';

import { MessageSquare, Youtube, Map, FileText, Zap } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const socialLinks = [
    { name: 'Facebook', icon: '/facebook.png', href: '#', color: 'hover:border-[#1877F2]/50 hover:bg-[#1877F2]/5' },
    { name: 'TikTok', icon: '/tiktok.png', href: '#', color: 'hover:border-white/30 hover:bg-white/5' },
    { name: 'YouTube', icon: '/youtube.png', href: '#', color: 'hover:border-[#FF0000]/50 hover:bg-[#FF0000]/5' },
  ];

  const footerLinks = [
    { name: 'Inicio', href: '/' },
    { name: 'Noticias', href: '/news' },
    { name: 'Foro', href: '/forum' },
    { name: 'Addons', href: '/addons' },
    { name: 'Staff', href: '/staff' },
    { name: 'Donaciones', href: '/donate' },
    { name: 'Disclaimer', href: '/disclaimer' },
  ];

  return (
    <footer className="relative bg-[#050505] border-t border-[#d4af37]/10 pt-20 pb-10 z-10 px-6 mt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent opacity-50" />
      <div className="relative">
        <div className="max-w-7xl mx-auto">
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
            {/* Left: Branding */}
            <div className="space-y-6 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <div className="relative w-12 h-12 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-600/40 blur-md scale-110 opacity-70" />
                  <div className="absolute inset-0 rounded-full border border-cyan-300/40" />
                  <Image
                    src="/shadow-azeroth.png"
                    alt="Shadow Azeroth"
                    fill
                    className="object-cover rounded-full"
                  />
                </div>
                <div>
                  <h3 className="font-black text-xl tracking-tighter text-[#d4af37] text-glow uppercase">
                    SHADOW AZEROTH
                  </h3>
                  <p className="text-[#8b2e35] text-xs font-black uppercase tracking-wider">WotLK 3.3.5a</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                La experiencia definitiva de World of Warcraft. Únete a la Horda o a la alianza y escribe tu leyenda en Rasganorte.
              </p>
            </div>

            {/* Center: Quick Links */}
            <div className="space-y-6 flex flex-col items-center md:items-start lg:pl-10">
              <h4 className="font-black text-xs uppercase tracking-[0.3em] text-[#d4af37] text-glow">
                Navegación Rápida
              </h4>
              <nav className="grid grid-cols-2 gap-x-12 gap-y-3">
                {footerLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="text-gray-500 hover:text-[#d4af37] transition-colors text-[10px] font-black uppercase tracking-widest"
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right: Community */}
            <div className="space-y-6">
              <h4 className="font-black text-xs uppercase tracking-[0.3em] text-[#d4af37] text-glow text-center md:text-left">
                Comunidad Oficial
              </h4>
              
              {/* Prominent Discord CTA */}
              <a 
                href="https://discord.gg/FfPcExmrZW" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group relative flex items-center gap-4 p-5 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/20 hover:border-[#5865F2]/50 transition-all duration-300 overflow-hidden"
              >
                {/* Pulse Glow */}
                <div className="absolute inset-0 bg-[#5865F2]/5 animate-pulse group-hover:bg-[#5865F2]/10 transition-colors" />
                
                <div className="relative w-14 h-14 shrink-0 bg-[#2c2f33] rounded-xl flex items-center justify-center p-2 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Image src="/discord.png" alt="Discord" width={44} height={44} />
                </div>
                
                <div className="relative">
                  <p className="text-white font-black text-[10px] uppercase tracking-widest leading-none mb-1">Únete ahora</p>
                  <p className="text-[#5865F2] font-black text-sm uppercase tracking-tighter group-hover:text-white transition-colors">Discord Oficial</p>
                </div>
                
                <div className="ml-auto relative w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center group-hover:bg-[#5865F2] transition-colors">
                  < Zap className="w-4 h-4 text-white" />
                </div>
              </a>

              {/* Other social icons bar */}
              <div className="flex justify-center md:justify-start items-center gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className={`w-14 h-14 p-2 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center transition-all hover:scale-110 duration-300 shadow-xl ${link.color}`}
                    aria-label={link.name}
                    title={link.name}
                  >
                    <Image src={link.icon} alt={link.name} width={36} height={36} className="group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#d4af37]/10 my-12" />

          {/* Bottom Info */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
            <div className="text-gray-600 text-[0.7rem] font-bold uppercase tracking-widest">
              © 2026 SHADOW AZEROTH • Servidor Educativo • World of Warcraft® es marca registrada de Blizzard Entertainment, Inc.
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-gray-700 text-[0.7rem] font-bold uppercase tracking-widest">
              <Link href="/disclaimer" className="hover:text-[#d4af37] transition-colors text-[10px]">Disclaimer Legal</Link>
              <span className="text-[#d4af37]/30">|</span>
              <Link href="/disclaimer" className="hover:text-[#d4af37] transition-colors text-[10px]">Privacidad</Link>
              <span className="text-[#d4af37]/30">|</span>
              <Link href="/forum" className="hover:text-[#d4af37] transition-colors text-[10px]">Soporte</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
