'use client';

import { MessageSquare, Youtube, Map, FileText, Zap } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  const socialLinks = [
    { name: 'Discord', icon: MessageSquare, href: '/forum', color: 'text-[#5865F2]' },
    { name: 'YouTube', icon: Youtube, href: '/news', color: 'text-red-600' },
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
                <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-[#d4af37]/30 to-red-900/30 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="font-black text-xl tracking-tighter text-[#d4af37] text-glow">
                    SHADOW AZEROTH
                  </h3>
                  <p className="text-[#8b2e35] text-xs font-black uppercase tracking-wider">WotLK 3.3.5a</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                La experiencia definitiva de World of Warcraft. Únete a la Horda y escribe tu leyenda en Rasganorte.
              </p>
            </div>

            {/* Center: Quick Links */}
            <div className="space-y-6">
              <h4 className="font-black text-xs uppercase tracking-[0.3em] text-[#d4af37] text-glow">
                Navegación Rápida
              </h4>
              <nav className="grid grid-cols-2 gap-3">
                {footerLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="text-gray-500 hover:text-[#d4af37] transition-colors text-sm font-bold uppercase tracking-wider"
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right: Community */}
            <div className="space-y-6">
              <h4 className="font-black text-xs uppercase tracking-[0.3em] text-[#d4af37] text-glow">
                Comunidad
              </h4>
              <div className="flex gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className={`p-3 rounded-sm border border-[#d4af37]/20 bg-[#8b2e35]/10 ${link.color} 
                               hover:bg-[#8b2e35]/30 hover:border-[#d4af37]/50 transition-all hover:scale-110 duration-300`}
                    aria-label={link.name}
                    title={link.name}
                  >
                    <link.icon className="w-5 h-5" />
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
              <br />
              <span className="text-xs text-amber-400 mt-2 block">
                Si ves un error de hidratación, ignóralo. Es causado por extensiones como Dark Reader y no afecta el funcionamiento del sitio.
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-gray-700 text-[0.7rem] font-bold uppercase tracking-widest">
              <Link href="/disclaimer" className="hover:text-[#d4af37] transition-colors">Disclaimer Legal</Link>
              <span className="text-[#d4af37]/30">|</span>
              <Link href="/disclaimer" className="hover:text-[#d4af37] transition-colors">Privacidad</Link>
              <span className="text-[#d4af37]/30">|</span>
              <Link href="/forum" className="hover:text-[#d4af37] transition-colors">Soporte</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
