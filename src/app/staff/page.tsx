'use client';

import { useState } from 'react';
import { Crown, Shield, Wand2, Headphones, Code2, X, Send, CheckCircle, ChevronRight } from 'lucide-react';

/* ─── Types ─── */
type RoleKey = 'developer' | 'gamemaster' | 'moderator' | 'support';

interface RoleConfig {
  key: RoleKey;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  primaryColor: string;
  secondaryColor: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  requirements: string[];
  questions: { id: string; label: string; placeholder: string; type: 'text' | 'textarea' | 'select'; options?: string[] }[];
}

/* ─── Role Configurations ─── */
const ROLES: RoleConfig[] = [
  {
    key: 'developer',
    label: 'Developer',
    subtitle: 'Programador',
    icon: Code2,
    primaryColor: '#FFD700',
    secondaryColor: '#00FFFF',
    gradientFrom: 'from-yellow-400',
    gradientTo: 'to-cyan-400',
    glowColor: 'rgba(255,215,0,0.35)',
    borderColor: 'border-yellow-500/40',
    badgeBg: 'bg-yellow-900/30',
    badgeText: 'text-yellow-400',
    description: 'Encargado del desarrollo técnico del servidor: scripts, sistemas custom, bases de datos y la web oficial.',
    requirements: ['Conocimiento en scripting (C++ / Lua / Python)', 'Experiencia con bases de datos MySQL', 'Disponibilidad para trabajo en equipo', 'Portfolio de proyectos previos'],
    questions: [
      { id: 'lenguajes', label: '¿Qué lenguajes de programación dominas?', placeholder: 'Ej: C++, Lua, Python, TypeScript...', type: 'textarea' },
      { id: 'experiencia_wow', label: '¿Tienes experiencia con desarrollo en servidores WoW/AzerothCore?', placeholder: 'Describe tu experiencia...', type: 'textarea' },
      { id: 'portfolio', label: '¿Tienes un portfolio o proyectos que puedas compartir?', placeholder: 'Links a GitHub, proyectos, etc...', type: 'textarea' },
      { id: 'motivacion', label: '¿Por qué quieres ser Developer de Shadow Azeroth?', placeholder: 'Tu motivación...', type: 'textarea' },
    ],
  },
  {
    key: 'gamemaster',
    label: 'Game Master',
    subtitle: 'GM',
    icon: Wand2,
    primaryColor: '#8B0000',
    secondaryColor: '#FF4444',
    gradientFrom: 'from-red-900',
    gradientTo: 'to-red-600',
    glowColor: 'rgba(139,0,0,0.5)',
    borderColor: 'border-red-700/40',
    badgeBg: 'bg-red-950/30',
    badgeText: 'text-red-400',
    description: 'Responsable de mantener el orden y la experiencia de juego: atender tickets, resolver problemas y velar por el fair play.',
    requirements: ['Conocimiento profundo del juego WoW 3.3.5a', 'Experiencia previa como GM (deseable)', 'Carácter neutral y profesional', 'Alta disponibilidad'],
    questions: [
      { id: 'experiencia_gm', label: '¿Has sido GM en algún servidor privado antes?', placeholder: 'Describe tu experiencia como GM...', type: 'textarea' },
      { id: 'situacion', label: 'Un jugador acusa a otro de usar hacks. ¿Cómo procedes?', placeholder: 'Describe tu forma de actuar...', type: 'textarea' },
      { id: 'conocimiento', label: '¿Cuánto conoces del servidor Shadow Azeroth y sus sistemas?', placeholder: 'Tu conocimiento del servidor...', type: 'textarea' },
      { id: 'disponibilidad_horas', label: '¿Cuántas horas a la semana puedes dedicar al rol?', placeholder: 'Ej: 15 horas semanales...', type: 'text' },
    ],
  },
  {
    key: 'moderator',
    label: 'Mod / Eventos',
    subtitle: 'Moderador',
    icon: Shield,
    primaryColor: '#BF00FF',
    secondaryColor: '#9B59B6',
    gradientFrom: 'from-purple-700',
    gradientTo: 'to-fuchsia-600',
    glowColor: 'rgba(191,0,255,0.4)',
    borderColor: 'border-purple-500/40',
    badgeBg: 'bg-purple-950/30',
    badgeText: 'text-purple-400',
    description: 'Mantiene la comunidad sana en Discord y en el juego, además de organizar y ejecutar eventos especiales para los jugadores.',
    requirements: ['Presencia activa en Discord y servidor', 'Creatividad para diseñar eventos', 'Capacidad de resolución de conflictos', 'Buena comunicación'],
    questions: [
      { id: 'idea_evento', label: 'Describe un evento que organizarías en Shadow Azeroth', placeholder: 'Sé creativo, cuenta el evento completo...', type: 'textarea' },
      { id: 'conflicto', label: 'Dos jugadores tienen un conflicto en el chat. ¿Cómo lo manejas?', placeholder: 'Describe tu forma de actuar...', type: 'textarea' },
      { id: 'comunidad', label: '¿Qué ideas tienes para mejorar la comunidad de Shadow Azeroth?', placeholder: 'Tus ideas...', type: 'textarea' },
      { id: 'anterior', label: '¿Has moderado en Discord o foros antes?', placeholder: 'Tu experiencia previa...', type: 'textarea' },
    ],
  },
  {
    key: 'support',
    label: 'Soporte Técnico',
    subtitle: 'Support',
    icon: Headphones,
    primaryColor: '#5DADE2',
    secondaryColor: '#85C1E9',
    gradientFrom: 'from-sky-500',
    gradientTo: 'to-blue-400',
    glowColor: 'rgba(93,173,226,0.4)',
    borderColor: 'border-sky-500/40',
    badgeBg: 'bg-sky-950/30',
    badgeText: 'text-sky-400',
    description: 'Ayuda a los jugadores con problemas técnicos: instalación, conexión, bugs y configuración del cliente.',
    requirements: ['Conocimiento técnico básico de WoW 3.3.5a', 'Paciencia y empatía', 'Capacidad de explicar soluciones claramente', 'Disponibilidad para atender tickets'],
    questions: [
      { id: 'problema_comun', label: '¿Cuál es el problema más común al conectarse a un servidor privado y cómo lo solucionarías?', placeholder: 'Tu respuesta técnica...', type: 'textarea' },
      { id: 'instalacion', label: '¿Puedes guiar a alguien paso a paso para instalar el cliente y conectarse?', placeholder: 'Describe el proceso...', type: 'textarea' },
      { id: 'paciencia', label: 'Un jugador lleva 2 horas intentando conectarse y está frustrado. ¿Cómo lo atiendes?', placeholder: 'Tu forma de manejar la situación...', type: 'textarea' },
      { id: 'conocimiento_tecnico', label: '¿Qué conocimientos técnicos (PC, redes, etc.) tienes que te ayudarían en el rol?', placeholder: 'Tus conocimientos...', type: 'textarea' },
    ],
  },
];

/* ─── Application Form Modal ─── */
function ApplicationModal({
  role,
  onClose,
}: {
  role: RoleConfig;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [discord, setDiscord] = useState('');
  const [edad, setEdad] = useState('');
  const [disponibilidad, setDisponibilidad] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [country, setCountry] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discord.trim()) { setError('El usuario de Discord es obligatorio.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/staff/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role.key, discord, edad, country, whatsapp, disponibilidad, experiencia, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error desconocido');
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar la postulación');
    } finally {
      setLoading(false);
    }
  };

  const Icon = role.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border"
        style={{
          background: 'linear-gradient(135deg, rgba(10,10,20,0.98) 0%, rgba(20,10,30,0.98) 100%)',
          borderColor: role.primaryColor + '40',
          boxShadow: `0 0 60px ${role.glowColor}, 0 0 120px ${role.glowColor}40`,
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4"
          style={{
            background: 'linear-gradient(180deg, rgba(10,10,20,1) 80%, transparent 100%)',
            borderBottom: `1px solid ${role.primaryColor}20`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${role.primaryColor}30, ${role.secondaryColor}20)`, border: `1px solid ${role.primaryColor}60` }}
            >
              <Icon className="w-6 h-6" style={{ color: role.primaryColor }} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Postulación — {role.label}</h2>
              <p className="text-xs" style={{ color: role.primaryColor }}>Completa el formulario con honestidad</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {success ? (
          /* Success screen */
          <div className="flex flex-col items-center justify-center p-12 text-center gap-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center animate-pulse"
              style={{ background: `${role.primaryColor}20`, border: `2px solid ${role.primaryColor}60` }}
            >
              <CheckCircle className="w-10 h-10" style={{ color: role.primaryColor }} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">¡Postulación Enviada!</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Tu postulación para <span className="font-bold" style={{ color: role.primaryColor }}>{role.label}</span> fue enviada con éxito al equipo de Staff.<br />
                Revisa tu Discord para novedades. ¡Gracias por querer ser parte del equipo!
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-8 py-3 rounded-xl font-bold text-black transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${role.primaryColor}, ${role.secondaryColor})` }}
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-5">
            {/* Basic info */}
            <div
              className="rounded-xl p-4 space-y-4"
              style={{ background: `${role.primaryColor}08`, border: `1px solid ${role.primaryColor}20` }}
            >
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: role.primaryColor }}>Información básica</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                    Usuario de Discord <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={discord}
                    onChange={(e) => setDiscord(e.target.value)}
                    placeholder="Ej: ShadowPlayer#1234"
                    className="w-full px-4 py-2.5 rounded-lg bg-black/50 border text-white text-sm placeholder-gray-600 outline-none transition-all focus:border-opacity-100"
                    style={{ borderColor: `${role.primaryColor}30` }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Edad</label>
                  <input
                    type="number"
                    value={edad}
                    onChange={(e) => setEdad(e.target.value)}
                    placeholder="Tu edad"
                    min={13}
                    max={80}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/50 border text-white text-sm placeholder-gray-600 outline-none transition-all"
                    style={{ borderColor: `${role.primaryColor}30` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">País</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Ej: España, México, etc."
                    className="w-full px-4 py-2.5 rounded-lg bg-black/50 border text-white text-sm placeholder-gray-600 outline-none transition-all"
                    style={{ borderColor: `${role.primaryColor}30` }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">WhatsApp / Contacto</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Ej: +54 9 11 1234-5678"
                    className="w-full px-4 py-2.5 rounded-lg bg-black/50 border text-white text-sm placeholder-gray-600 outline-none transition-all"
                    style={{ borderColor: `${role.primaryColor}30` }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Disponibilidad horaria semanal</label>
                <input
                  type="text"
                  value={disponibilidad}
                  onChange={(e) => setDisponibilidad(e.target.value)}
                  placeholder="Ej: Lunes a Viernes de 18:00 a 22:00 (GMT-4)"
                  className="w-full px-4 py-2.5 rounded-lg bg-black/50 border text-white text-sm placeholder-gray-600 outline-none transition-all"
                  style={{ borderColor: `${role.primaryColor}30` }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Experiencia previa en staff (general)</label>
                <textarea
                  value={experiencia}
                  onChange={(e) => setExperiencia(e.target.value)}
                  rows={2}
                  placeholder="¿Has tenido algún rol de staff en otros servidores o comunidades?"
                  className="w-full px-4 py-2.5 rounded-lg bg-black/50 border text-white text-sm placeholder-gray-600 outline-none transition-all resize-none"
                  style={{ borderColor: `${role.primaryColor}30` }}
                />
              </div>
            </div>

            {/* Role-specific questions */}
            <div
              className="rounded-xl p-4 space-y-4"
              style={{ background: `${role.primaryColor}08`, border: `1px solid ${role.primaryColor}20` }}
            >
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: role.primaryColor }}>
                Preguntas específicas — {role.label}
              </p>
              {role.questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">{q.label}</label>
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    rows={3}
                    placeholder={q.placeholder}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/50 border text-white text-sm placeholder-gray-600 outline-none transition-all resize-none"
                    style={{ borderColor: `${role.primaryColor}30` }}
                  />
                </div>
              ))}
            </div>

            {error && (
              <div className="rounded-lg p-3 bg-red-900/30 border border-red-500/40 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${role.primaryColor}, ${role.secondaryColor})`,
                color: '#000',
                boxShadow: `0 0 20px ${role.glowColor}`,
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Postulación
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── Main Staff Page ─── */
export default function StaffPage() {
  const [activeRole, setActiveRole] = useState<RoleKey>('developer');
  const [applyModal, setApplyModal] = useState<RoleConfig | null>(null);

  const currentRole = ROLES.find((r) => r.key === activeRole)!;

  return (
    <main
      className="min-h-screen pt-28 pb-24 text-white font-sans relative overflow-x-hidden"
      style={{
        backgroundImage: "url('/fono.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Animated bg glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${currentRole.glowColor} 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">

        {/* ── Hero heading ── */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-bold uppercase tracking-widest"
            style={{ background: `${currentRole.primaryColor}15`, border: `1px solid ${currentRole.primaryColor}40`, color: currentRole.primaryColor }}>
            <Crown className="w-3.5 h-3.5" />
            Únete al Equipo
          </div>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight text-white drop-shadow-2xl mb-4"
            style={{ textShadow: `0 0 40px ${currentRole.glowColor}` }}>
            Nuestro <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${currentRole.primaryColor}, ${currentRole.secondaryColor})` }}>Staff</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
            Selecciona el rol al que deseas postularte y completa el formulario. Nuestro equipo revisará tu solicitud.
          </p>
        </div>

        {/* ── Role Tabs ── */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isActive = activeRole === role.key;
            return (
              <button
                key={role.key}
                onClick={() => setActiveRole(role.key)}
                className="relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 cursor-pointer hover:scale-105"
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${role.primaryColor}30, ${role.secondaryColor}20)`
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? role.primaryColor + '70' : 'rgba(255,255,255,0.08)'}`,
                  color: isActive ? role.primaryColor : '#9ca3af',
                  boxShadow: isActive ? `0 0 20px ${role.glowColor}` : 'none',
                }}
              >
                <Icon className="w-4 h-4" />
                {role.label}
                {isActive && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1/2 h-0.5 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${role.primaryColor}, ${role.secondaryColor})` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Role Card ── */}
        <div
          key={currentRole.key}
          className="rounded-2xl overflow-hidden mb-8 transition-all duration-500"
          style={{
            border: `1px solid ${currentRole.primaryColor}30`,
            background: 'linear-gradient(135deg, rgba(10,10,20,0.9) 0%, rgba(15,10,25,0.9) 100%)',
            boxShadow: `0 0 50px ${currentRole.glowColor}`,
          }}
        >
          {/* Top color bar */}
          <div
            className="h-1.5 w-full"
            style={{ background: `linear-gradient(90deg, ${currentRole.primaryColor}, ${currentRole.secondaryColor})` }}
          />

          <div className="p-8 md:p-10">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Icon & title */}
              <div className="flex-shrink-0 flex flex-col items-center md:items-start gap-4">
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${currentRole.primaryColor}25, ${currentRole.secondaryColor}15)`,
                    border: `2px solid ${currentRole.primaryColor}50`,
                    boxShadow: `0 0 30px ${currentRole.glowColor}`,
                  }}
                >
                  <currentRole.icon className="w-12 h-12" style={{ color: currentRole.primaryColor }} />
                </div>
                <div className="text-center md:text-left">
                  <h2 className="text-3xl font-black uppercase text-white tracking-tight">{currentRole.label}</h2>
                  <p className="text-sm font-semibold" style={{ color: currentRole.primaryColor }}>{currentRole.subtitle}</p>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 space-y-6">
                <p className="text-gray-300 leading-relaxed">{currentRole.description}</p>

                {/* Requirements */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: currentRole.primaryColor }}>
                    Requisitos
                  </p>
                  <ul className="space-y-2">
                    {currentRole.requirements.map((req, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-gray-300">
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: currentRole.primaryColor }} />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Questions preview */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: currentRole.primaryColor }}>
                    Preguntas del formulario
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentRole.questions.map((q, i) => (
                      <div
                        key={q.id}
                        className="flex items-start gap-2 text-xs text-gray-400 py-2 px-3 rounded-lg"
                        style={{ background: `${currentRole.primaryColor}08`, border: `1px solid ${currentRole.primaryColor}15` }}
                      >
                        <span className="font-bold mt-0.5" style={{ color: currentRole.primaryColor }}>{i + 1}.</span>
                        {q.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Apply CTA */}
            <div className="mt-8 pt-6 flex items-center justify-between gap-4 flex-wrap"
              style={{ borderTop: `1px solid ${currentRole.primaryColor}20` }}>
              <p className="text-sm text-gray-500">
                ¿Cumples los requisitos? Postúlate y el equipo revisará tu solicitud.
              </p>
              <button
                onClick={() => setApplyModal(currentRole)}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all hover:scale-105 cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${currentRole.primaryColor}, ${currentRole.secondaryColor})`,
                  color: '#000',
                  boxShadow: `0 0 25px ${currentRole.glowColor}`,
                }}
              >
                <Send className="w-4 h-4" />
                Postularme como {currentRole.label}
              </button>
            </div>
          </div>
        </div>

        {/* ── All roles overview ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.key}
                onClick={() => { setActiveRole(role.key); setApplyModal(role); }}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl transition-all hover:scale-105 cursor-pointer text-center"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${role.primaryColor}20`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    background: `${role.primaryColor}15`,
                    border: `1px solid ${role.primaryColor}40`,
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color: role.primaryColor }} />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">{role.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: role.primaryColor }}>Aplicar →</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Appreciation Section ── */}
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(10,10,20,0.8) 0%, rgba(20,10,30,0.8) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-3 opacity-70" />
          <p className="text-gray-300 leading-relaxed max-w-2xl mx-auto mb-2">
            <span className="font-bold text-yellow-400">Agradecemos profundamente</span> a cada miembro del staff por su dedicación y esfuerzo en mantener Shadow Azeroth como un lugar acogedor y seguro para la comunidad.
          </p>
          <p className="text-sm text-gray-600 italic">
            🎖️ Sin ustedes, esto no sería posible. ¡Gracias por ser los guardianes de nuestro reino!
          </p>
        </div>

      </div>

      {/* ── Application Modal ── */}
      {applyModal && (
        <ApplicationModal role={applyModal} onClose={() => setApplyModal(null)} />
      )}
    </main>
  );
}
