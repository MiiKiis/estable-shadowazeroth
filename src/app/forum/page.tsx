
'use client';

// Status filter options
const STATUS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendiente' },
  { id: 'review', label: 'En revisión' },
  { id: 'solved', label: 'Solucionado' },
  { id: 'active', label: 'Activo' },
];

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Pin, Lock, PlusCircle, ChevronRight, Users, Clock, Globe, Wrench, BookOpen, Shield, AlertTriangle, Edit2, Trash2, CornerUpLeft, AlertOctagon, Megaphone, Lightbulb, LifeBuoy, Sparkles, Search, SlidersHorizontal } from 'lucide-react';
import Image from 'next/image';

type Topic = {
  id: number;
  title: string;
  category: string;
  pinned: boolean;
  locked: boolean;
  completed: boolean;
  views: number;
  created_at: string;
};











export default function ForumPage() {
    const router = useRouter();
  // --- MISSING STATE AND CONSTANTS ---
  // Category and UI state
  const [activeCategory, setActiveCategory] = useState('all');
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Category definitions (example, adjust as needed)
  const CATEGORIES = [
    { id: 'all', label: 'Todos', desc: 'Todos los temas', color: 'from-purple-700 to-indigo-700', border: 'border-purple-700', text: 'text-purple-300' },
    { id: 'announcements', label: 'Anuncios', desc: 'Novedades oficiales', color: 'from-fuchsia-700 to-fuchsia-900', border: 'border-fuchsia-700', text: 'text-fuchsia-300' },
    { id: 'general', label: 'General', desc: 'Discusión general', color: 'from-purple-700 to-indigo-700', border: 'border-purple-700', text: 'text-purple-300' },
    { id: 'support', label: 'Soporte', desc: 'Ayuda y soporte', color: 'from-rose-700 to-rose-900', border: 'border-rose-700', text: 'text-rose-300' },
    { id: 'guides', label: 'Guías', desc: 'Guías y tutoriales', color: 'from-cyan-700 to-cyan-900', border: 'border-cyan-700', text: 'text-cyan-300' },
    { id: 'reports', label: 'Reportes', desc: 'Reporta bugs', color: 'from-red-700 to-red-900', border: 'border-red-700', text: 'text-red-300' },
    { id: 'suggestions', label: 'Sugerencias', desc: 'Ideas y sugerencias', color: 'from-emerald-700 to-emerald-900', border: 'border-emerald-700', text: 'text-emerald-300' },
  ];
  // Category icons (example, adjust as needed)
  const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    all: <Globe className="w-5 h-5" />,
    announcements: <Megaphone className="w-5 h-5" />,
    general: <BookOpen className="w-5 h-5" />,
    support: <LifeBuoy className="w-5 h-5" />,
    guides: <Lightbulb className="w-5 h-5" />,
    reports: <AlertOctagon className="w-5 h-5" />,
    suggestions: <Sparkles className="w-5 h-5" />
  };

  // Templates
  const SUPPORT_TEMPLATE = 'Describe tu problema, pasos para reproducirlo, y adjunta evidencia.';
  const REPORT_TEMPLATE = 'Describe el bug, incluye IDs, pasos y evidencia.';

  // Types
  type TopicStatusFilter = 'all' | 'pending' | 'review' | 'solved' | 'active';
  type TopicSort = 'latest' | 'popular' | 'replies';
  interface RealmStats { totalAccounts: number; totalCharacters: number; }

  // Utility function (placeholder)
  function inferTopicTag(topic: any) {
    // Example logic, adjust as needed
    if (topic.completed) return { label: 'SOLUCIONADO', style: 'border-emerald-700/40 text-emerald-300' };
    if (topic.locked) return { label: 'EN REVISION', style: 'border-amber-700/40 text-amber-300' };
    if (topic.pinned) return { label: 'ACTIVO', style: 'border-cyan-700/40 text-cyan-300' };
    return { label: 'PENDIENTE', style: 'border-gray-700/40 text-gray-300' };
  }

  // Utility function (placeholder)
  function timeAgo(dateString: string) {
    // Simple time ago, adjust as needed
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    return `${Math.floor(diff/86400)}d`;
  }
  const [newTitle, setNewTitle]     = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [realmStats, setRealmStats] = useState<RealmStats | null>(null);

  const openNewTopic = () => {
    // Pre-select the currently active category (skip 'all')
    if (activeCategory !== 'all') setNewCategory(activeCategory);
    else setNewCategory('general');
    setShowNewTopic(v => !v);
  };
  const [newBody, setNewBody]       = useState('');
  const [posting, setPosting]       = useState(false);
  const [postError, setPostError]   = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TopicStatusFilter>('all');
  const [sortBy, setSortBy] = useState<TopicSort>('latest');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [onlyLocked, setOnlyLocked] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) { try { setUser(JSON.parse(raw)); } catch {} }
  }, []);

  useEffect(() => {
    fetch('/api/stats/global')
      .then(r => r.json())
      .then(d => setRealmStats(d?.stats || null))
      .catch(() => setRealmStats(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = activeCategory === 'all'
      ? '/api/forum/topics'
      : `/api/forum/topics?category=${activeCategory}`;
    fetch(url)
      .then(r => r.json())
      .then(d => setTopics(Array.isArray(d.topics) ? d.topics : []))
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => {
    if (newBody.trim().length > 0) return;
    if (newCategory === 'support') {
      setNewBody(SUPPORT_TEMPLATE);
    } else if (newCategory === 'reports') {
      setNewBody(REPORT_TEMPLATE);
    }
  }, [newCategory, newBody]);

  const handleNewTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/'); return; }
    setPosting(true);
    setPostError('');
    try {
      const res = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: newTitle, category: newCategory, comment: newBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando tema');
      router.push(`/forum/${data.topicId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creando tema';
      setPostError(message);
    } finally {
      setPosting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const items = topics
      .filter((topic) => activeCategory === 'all' || topic.category === activeCategory)
      .filter((topic) => {
        if (!q) return true;
        return (
          topic.title.toLowerCase().includes(q) ||
          topic.author.username.toLowerCase().includes(q) ||
          topic.category.toLowerCase().includes(q)
        );
      })
      .filter((topic) => {
        if (onlyPinned && !topic.pinned) return false;
        if (onlyLocked && !topic.locked) return false;

        const tag = inferTopicTag(topic).label;
        if (statusFilter === 'pending') return tag === 'PENDIENTE';
        if (statusFilter === 'review') return tag === 'EN REVISION';
        if (statusFilter === 'solved') return tag === 'SOLUCIONADO';
        if (statusFilter === 'active') return tag === 'ACTIVO';
        return true;
      });

    const sorted = [...items];
    if (sortBy === 'popular') {
      sorted.sort((a, b) => b.views - a.views);
    } else if (sortBy === 'replies') {
      sorted.sort((a, b) => b.comment_count - a.comment_count);
    } else {
      sorted.sort((a, b) => {
        const aTs = new Date(a.last_reply_at || a.created_at).getTime();
        const bTs = new Date(b.last_reply_at || b.created_at).getTime();
        return bTs - aTs;
      });
    }

    return sorted;
  }, [topics, activeCategory, searchQuery, statusFilter, sortBy, onlyPinned, onlyLocked]);
  const latestTopics = topics.slice(0, 5);
  const categoryMeta = CATEGORIES.find(c => c.id === activeCategory);

  return (
    <main
      className="min-h-screen pt-32 pb-20 text-white selection:bg-purple-600/30 font-sans relative overflow-x-hidden"
      style={{
        backgroundImage: "url('/fono.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="max-w-[1640px] mx-auto px-4 sm:px-6 xl:px-8 2xl:px-10 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-purple-400 animate-pulse" />
            <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              FORO
            </h1>
          </div>
          {user && (
            <button
              onClick={openNewTopic}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Nuevo Tema
            </button>
          )}
        </div>

        {/* New Topic Form */}
        {showNewTopic && user && (
          <div className="mb-8 rounded-3xl border border-purple-900/40 bg-black/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(105,55,180,0.25)]">
            <h2 className="text-xl font-black mb-5 text-purple-300">Crear nuevo tema</h2>
            <form onSubmit={handleNewTopic} className="space-y-4">
              <input
                type="text"
                placeholder="Título del tema"
                className="w-full bg-black/60 border border-purple-900/50 rounded-2xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={200}
                required
              />

              {/* Visual category picker */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">¿Dónde va este tema?</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewCategory(cat.id)}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border transition-all text-center ${
                        newCategory === cat.id
                          ? `bg-gradient-to-br ${cat.color} ${cat.border} ${cat.text} shadow-[0_0_14px_rgba(0,0,0,0.5)]`
                          : 'bg-black/30 border-purple-900/30 text-gray-500 hover:text-gray-300 hover:border-purple-800/50'
                      }`}
                    >
                      <span className={newCategory === cat.id ? cat.text : 'text-gray-600'}>
                        {CATEGORY_ICONS[cat.id]}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-wide leading-tight">{cat.label}</span>
                      <span className="text-[9px] leading-tight opacity-70 hidden sm:block">{cat.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                placeholder="Escribe tu mensaje aquí..."
                rows={5}
                className="w-full bg-black/60 border border-purple-900/50 rounded-2xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60 resize-none"
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                required
              />
              {postError && <p className="text-rose-400 text-sm">{postError}</p>}
              <div className="rounded-2xl border border-purple-500/35 bg-gradient-to-r from-purple-950/40 to-indigo-950/30 p-2.5">
                <button
                  type="submit"
                  disabled={posting}
                  className={`w-full py-4 rounded-xl font-black uppercase tracking-[0.16em] text-sm transition-all border ${posting ? 'bg-purple-800/60 animate-pulse cursor-not-allowed border-purple-400/20 text-purple-100' : 'bg-gradient-to-r from-fuchsia-700 via-purple-600 to-indigo-600 hover:from-fuchsia-600 hover:to-indigo-500 border-purple-200/40 text-white shadow-[0_0_28px_rgba(168,85,247,0.55)] hover:shadow-[0_0_40px_rgba(168,85,247,0.75)]'}`}
                >
                  {posting ? 'PUBLICANDO...' : 'CLICK AQUI PARA PUBLICAR TEMA'}
                </button>
                {!posting && (
                  <p className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-300/90 mt-2">
                    Confirma tu tema con este botón
                  </p>
                )}
              </div>
            </form>
          </div>
        )}

        {activeCategory === 'all' && (
          <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setActiveCategory('announcements')}
              className="text-left rounded-2xl border border-fuchsia-600/40 bg-gradient-to-br from-fuchsia-950/45 to-purple-950/25 p-4 hover:border-fuchsia-400/60 transition-all"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-fuchsia-300">Bloque de anuncios</p>
              <p className="text-white font-black mt-2">Novedades oficiales del servidor</p>
              <p className="text-gray-400 text-sm mt-1">Solo el staff publica aquí para mantener información clara y ordenada.</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('guides')}
              className="text-left rounded-2xl border border-cyan-600/40 bg-gradient-to-br from-cyan-950/35 to-purple-950/20 p-4 hover:border-cyan-400/60 transition-all"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-cyan-300">Guía de inicio rápido</p>
              <p className="text-white font-black mt-2">¿Nuevo en Shadow Azeroth?</p>
              <p className="text-gray-400 text-sm mt-1">Cliente, conexión, reglas y primeros pasos para no perderte en tu llegada.</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCategory('support');
                setShowNewTopic(true);
                setNewCategory('support');
                setNewBody(SUPPORT_TEMPLATE);
              }}
              className="text-left rounded-2xl border border-rose-600/40 bg-gradient-to-br from-rose-950/35 to-purple-950/20 p-4 hover:border-rose-400/60 transition-all"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-rose-300">Soporte con plantilla</p>
              <p className="text-white font-black mt-2">Reporta bugs de forma útil</p>
              <p className="text-gray-400 text-sm mt-1">Incluye pasos, IDs y evidencia para que el staff pueda resolver más rápido.</p>
            </button>
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_340px] 2xl:grid-cols-[320px_minmax(0,1fr)_360px] gap-6 items-start">
          <aside className="rounded-2xl border border-purple-900/35 bg-black/45 backdrop-blur-sm p-4 space-y-4 xl:sticky xl:top-28">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-purple-300 mb-2 flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
              </p>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar tema o autor"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-black/50 border border-purple-900/40 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/60"
                />
                {STATUS_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id as TopicStatusFilter)}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-black uppercase tracking-wide transition-colors ${
                      statusFilter === item.id
                        ? 'border-cyan-500/60 text-cyan-200 bg-cyan-900/30'
                        : 'border-purple-900/40 text-gray-400 hover:text-white hover:border-purple-700/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-amber-300 mb-2">Vista</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSortBy('latest')}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wide text-left ${sortBy === 'latest' ? 'border-amber-500/60 text-amber-200 bg-amber-900/25' : 'border-purple-900/40 text-gray-400 hover:text-white hover:border-purple-700/60'}`}
                >
                  Más recientes
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('popular')}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wide text-left ${sortBy === 'popular' ? 'border-amber-500/60 text-amber-200 bg-amber-900/25' : 'border-purple-900/40 text-gray-400 hover:text-white hover:border-purple-700/60'}`}
                >
                  Más vistos
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('replies')}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wide text-left ${sortBy === 'replies' ? 'border-amber-500/60 text-amber-200 bg-amber-900/25' : 'border-purple-900/40 text-gray-400 hover:text-white hover:border-purple-700/60'}`}
                >
                  Más respuestas
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={onlyPinned} onChange={(e) => setOnlyPinned(e.target.checked)} />
                Solo fijados
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={onlyLocked} onChange={(e) => setOnlyLocked(e.target.checked)} />
                Solo cerrados
              </label>
            </div>
          </aside>

          <section>
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2 mb-3">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
                    activeCategory === cat.id
                      ? 'bg-gradient-to-r ' + cat.color + ' border-purple-500/60 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-black/30 border-purple-900/30 text-gray-400 hover:text-white hover:border-purple-700/50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {categoryMeta && <p className="text-xs text-gray-400 mb-5">{categoryMeta.desc}</p>}

            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-purple-900/30 bg-black/25 px-3 py-2">
              <p className="text-xs text-gray-400">
                Mostrando <span className="text-white font-bold">{filtered.length}</span> tema{filtered.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setSortBy('latest');
                  setOnlyPinned(false);
                  setOnlyLocked(false);
                }}
                className="text-[10px] uppercase tracking-[0.18em] text-purple-300 hover:text-white font-black"
              >
                Limpiar filtros
              </button>
            </div>

            {/* Topics List */}
            <div className="space-y-2">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl border border-purple-900/20 bg-black/40 animate-pulse" />
                ))
              ) : filtered.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No hay temas en esta categoría todavía.</p>
                  {user && <p className="text-sm mt-1">¡Sé el primero en crear uno!</p>}
                </div>
              ) : (
                filtered.map(topic => (
                  <Link
                    key={topic.id}
                    href={`/forum/${topic.id}`}
                    className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-purple-900/30 bg-black/40 backdrop-blur-sm hover:bg-black/60 hover:border-purple-600/50 transition-all group"
                  >
                    <div className="shrink-0 relative w-10 h-10 rounded-full overflow-hidden border-2 border-purple-700/60 group-hover:border-purple-400/80 transition-colors">
                      {topic.author.avatar ? (
                        <Image src={`/avatares/${topic.author.avatar}`} alt={topic.author.username} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center text-xs font-black text-purple-300">
                          {topic.author.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {topic.pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                        {topic.locked && <Lock className="w-3 h-3 text-rose-400 shrink-0" />}
                        <span className="font-black text-white group-hover:text-purple-200 transition-colors truncate">
                          {topic.title}
                        </span>
                        {(() => {
                          const tag = inferTopicTag(topic);
                          return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${tag.style}`}>{tag.label}</span>;
                        })()}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          topic.category === 'announcements' ? 'border-fuchsia-700/40 text-fuchsia-300' :
                          topic.category === 'general' ? 'border-purple-700/40 text-purple-400' :
                          topic.category === 'support' ? 'border-rose-700/40 text-rose-400' :
                          topic.category === 'guides'  ? 'border-cyan-700/40 text-cyan-400' :
                          topic.category === 'reports' ? 'border-red-700/50 text-red-400' :
                          topic.category === 'suggestions' ? 'border-emerald-700/50 text-emerald-400' :
                          'border-amber-700/40 text-amber-400'
                        }`}>
                          {CATEGORIES.find(c => c.id === topic.category)?.label ?? topic.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        por <span className="text-purple-400 font-semibold">{topic.author.username}</span>
                        {' · '}{timeAgo(topic.created_at)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right hidden sm:block">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{topic.comment_count}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{topic.views}</span>
                      </div>
                      {topic.last_reply_at && (
                        <p className="text-[10px] text-gray-600 mt-1 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />{timeAgo(topic.last_reply_at)}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 shrink-0 transition-colors" />
                  </Link>
                ))
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-purple-900/35 bg-black/45 backdrop-blur-sm p-4 space-y-5 xl:sticky xl:top-28">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-300 mb-2">Estado del Reino</p>
              <div className="rounded-xl border border-cyan-700/30 bg-cyan-950/20 p-3">
                <p className="text-sm font-black text-emerald-300">Operativo</p>
                <p className="text-xs text-gray-400 mt-1">Cuentas: {realmStats?.totalAccounts ?? '...'} · Personajes: {realmStats?.totalCharacters ?? '...'}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-purple-300 mb-2">Últimos temas</p>
              <div className="space-y-2">
                {latestTopics.length === 0 ? (
                  <p className="text-xs text-gray-500">Aún no hay actividad reciente.</p>
                ) : (
                  latestTopics.map((topic) => (
                    <Link
                      key={`latest-${topic.id}`}
                      href={`/forum/${topic.id}`}
                      className="block rounded-lg border border-purple-900/30 bg-black/30 px-3 py-2 hover:border-purple-700/50 transition-colors"
                    >
                      <p className="text-xs font-bold text-white truncate">{topic.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{timeAgo(topic.created_at)}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-amber-300 mb-2">Enlaces rápidos</p>
              <div className="space-y-2 text-xs">
                <Link href="/armory" className="flex items-center gap-2 text-slate-300 hover:text-white"><Sparkles className="w-3.5 h-3.5" /> Armería</Link>
                <Link href="/donate" className="flex items-center gap-2 text-slate-300 hover:text-white"><Sparkles className="w-3.5 h-3.5" /> Tienda / Donaciones</Link>
                <a href="https://discord.gg/FfPcExmrZW" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-300 hover:text-white"><LifeBuoy className="w-3.5 h-3.5" /> Discord</a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
