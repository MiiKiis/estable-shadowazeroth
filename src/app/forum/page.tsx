
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
import { MessageSquare, Pin, Lock, Unlock, PlusCircle, ChevronRight, Users, Clock, Globe, Wrench, BookOpen, Shield, AlertTriangle, Edit2, Trash2, CornerUpLeft, AlertOctagon, Megaphone, Lightbulb, LifeBuoy, Sparkles, Search, SlidersHorizontal, Bold, Italic, Underline, AlignCenter, Image as ImageIcon, Type, Palette, ArrowRight, Settings, Plus, FolderPlus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

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

type CharacterOption = {
  guid: number;
  name: string;
  level: number;
  race: number;
  classId: number;
  gender: number;
  online: number;
};

function getForumCharacterStorageKey(userId: number): string {
  return `forum_selected_character_${userId}`;
}

const CLASS_LABELS: Record<number, string> = {
  1: 'Guerrero',
  2: 'Paladin',
  3: 'Cazador',
  4: 'Picaro',
  5: 'Sacerdote',
  6: 'DK',
  7: 'Chaman',
  8: 'Mago',
  9: 'Brujo',
  11: 'Druida',
};

const CLASS_IMAGE_BY_ID: Record<number, string> = {
  1: '/clases/warrior.png',
  2: '/clases/paladin.png',
  3: '/clases/hunter.png',
  4: '/clases/rogue.png',
  5: '/clases/priest.png',
  6: '/clases/deathknight.png',
  7: '/clases/shaman.png',
  8: '/clases/mage.png',
  9: '/clases/warlock.png',
  11: '/clases/druid.png',
};

const RACE_LABELS: Record<number, string> = {
  1: 'Humano',
  2: 'Orco',
  3: 'Enano',
  4: 'Elfo Noche',
  5: 'No-muerto',
  6: 'Tauren',
  7: 'Gnomo',
  8: 'Trol',
  10: 'Elfo Sangre',
  11: 'Draenei',
};

function getFactionByRace(race: number): 'Aliado' | 'Horda' | 'Neutral' {
  if ([1, 3, 4, 7, 11].includes(race)) return 'Aliado';
  if ([2, 5, 6, 8, 10].includes(race)) return 'Horda';
  return 'Neutral';
}











export default function ForumPage() {
    const router = useRouter();
  // Hierarchical Sections State
  const [sections, setSections] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('announcements');
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStaffGM, setIsStaffGM] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

  // Form for new section
  const [sectionForm, setSectionForm] = useState({
    id: '', label: '', desc: '', icon: 'MessageSquare', parent_id: null as string | null
  });

  // Derived sections
  const activeSectionObj = sections.find(s => s.id === activeCategory);
  const activeMainCategoryId = activeSectionObj?.parent_id ? activeSectionObj.parent_id : activeCategory;

  const mainSections = sections.filter(s => !s.parent_id);
  const subSections = sections.filter(s => s.parent_id === activeMainCategoryId);

  const CATEGORIES = mainSections; // For compatibility

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
  const [newCategory, setNewCategory] = useState('announcements');
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [selectedCharacterName, setSelectedCharacterName] = useState('');
  const [realmStats, setRealmStats] = useState<RealmStats | null>(null);

  const selectedCharacter = characters.find((c) => c.name === selectedCharacterName) || null;
  const selectedFaction = getFactionByRace(Number(selectedCharacter?.race || 0));

  const openNewTopic = () => {
    // Lock posting category to the section where the user clicked
    setTopicPostCategory(activeCategory);
    setNewCategory(activeCategory);
    setShowNewTopic(v => !v);
  };
  const [newBody, setNewBody]       = useState('');
  const [topicPostCategory, setTopicPostCategory] = useState('announcements');
  const [formatPromptOpen, setFormatPromptOpen] = useState(false);
  const [formatPromptTag, setFormatPromptTag] = useState<'img' | 'color' | 'size' | 'font' | null>(null);
  const [formatPromptTitle, setFormatPromptTitle] = useState('');
  const [formatPromptHint, setFormatPromptHint] = useState('');
  const [formatPromptPlaceholder, setFormatPromptPlaceholder] = useState('');
  const [formatPromptValue, setFormatPromptValue] = useState('');
  const [formatPromptPreviewError, setFormatPromptPreviewError] = useState(false);
  const [posting, setPosting]       = useState(false);
  const [postError, setPostError]   = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftReportId, setDraftReportId] = useState('');
  const [draftReportCharacter, setDraftReportCharacter] = useState('');
  const [draftReportDate, setDraftReportDate] = useState('');
  const [reportIdQuery, setReportIdQuery] = useState('');
  const [reportCharacterQuery, setReportCharacterQuery] = useState('');
  const [reportDateQuery, setReportDateQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TopicStatusFilter>('all');
  const [sortBy, setSortBy] = useState<TopicSort>('latest');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [onlyLocked, setOnlyLocked] = useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertBBCode = (openTag: string, closeTag: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end, text.length);

    const newText = before + openTag + selected + closeTag + after;
    setNewBody(newText);
    
    // Reposition cursor
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + openTag.length + selected.length, start + openTag.length + selected.length);
    }, 0);
  };

  const insertPromptTag = (tag: string) => {
    if (tag === 'img') {
      setFormatPromptTag('img');
      setFormatPromptTitle('Insertar imagen');
      setFormatPromptHint('Pega la URL directa de la imagen (png, jpg, webp, gif).');
      setFormatPromptPlaceholder('https://.../imagen.png');
      setFormatPromptValue('');
      setFormatPromptPreviewError(false);
      setFormatPromptOpen(true);
      return;
    }

    if (tag === 'color') {
      setFormatPromptTag('color');
      setFormatPromptTitle('Color de texto');
      setFormatPromptHint('Usa nombre (red) o formato HEX (#ff0000).');
      setFormatPromptPlaceholder('#ff0000');
      setFormatPromptValue('');
      setFormatPromptPreviewError(false);
      setFormatPromptOpen(true);
      return;
    }

    if (tag === 'size') {
      setFormatPromptTag('size');
      setFormatPromptTitle('Tamaño de fuente');
      setFormatPromptHint('Ingresa solo número en px. Ejemplo: 24');
      setFormatPromptPlaceholder('24');
      setFormatPromptValue('');
      setFormatPromptPreviewError(false);
      setFormatPromptOpen(true);
      return;
    }

    if (tag === 'font') {
      setFormatPromptTag('font');
      setFormatPromptTitle('Fuente de texto');
      setFormatPromptHint('Ejemplo: Georgia, Verdana, Courier New');
      setFormatPromptPlaceholder('Georgia');
      setFormatPromptValue('');
      setFormatPromptPreviewError(false);
      setFormatPromptOpen(true);
    }
  };

  const applyPromptTag = () => {
    const val = formatPromptValue.trim();
    if (!val || !formatPromptTag) return;

    if (formatPromptTag === 'img') insertBBCode(`[img]${val}[/img]`, '');
    if (formatPromptTag === 'color') insertBBCode(`[color=${val}]`, '[/color]');
    if (formatPromptTag === 'size') insertBBCode(`[size=${val}px]`, '[/size]');
    if (formatPromptTag === 'font') insertBBCode(`[font=${val}]`, '[/font]');

    setFormatPromptOpen(false);
    setFormatPromptTag(null);
    setFormatPromptValue('');
    setFormatPromptPreviewError(false);
  };

  useEffect(() => {
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    if (u) setUser(u);

    if (u?.id) {
      fetch(`/api/characters?accountId=${u.id}`)
        .then(r => r.json())
        .then(d => {
          const chars = Array.isArray(d?.characters) ? d.characters : [];
          const parsed: CharacterOption[] = chars
            .map((c: any) => ({
              guid: Number(c?.guid || 0),
              name: String(c?.name || ''),
              level: Number(c?.level || 0),
              race: Number(c?.race || 0),
              classId: Number(c?.class || 0),
              gender: Number(c?.gender || 0),
              online: Number(c?.online || 0),
            }))
            .filter((c: CharacterOption) => c.guid > 0 && c.name.length > 0)
            .sort((a: CharacterOption, b: CharacterOption) => a.name.localeCompare(b.name));
          setCharacters(parsed);

          const saved = String(localStorage.getItem(getForumCharacterStorageKey(Number(u.id))) || '');
          const preferred = parsed.some((p) => p.name === saved) ? saved : (parsed[0]?.name || '');
          setSelectedCharacterName(preferred);
        })
        .catch(() => {
          setCharacters([]);
          setSelectedCharacterName('');
        });
    }

    // Fetch dynamic sections
    const userIdQuery = u?.id ? `?userId=${u.id}` : '';
    fetch(`/api/forum/sections${userIdQuery}`)
      .then(r => r.json())
      .then(d => {
        setSections(Array.isArray(d.sections) ? d.sections : []);
        setIsStaffGM(!!d.isGM);
      })
      .catch(() => {});

    fetch('/api/stats/global')
      .then(r => r.json())
      .then(d => setRealmStats(d?.stats || null))
      .catch(() => setRealmStats(null));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (!selectedCharacterName) return;
    localStorage.setItem(getForumCharacterStorageKey(Number(user.id)), selectedCharacterName);
  }, [selectedCharacterName, user?.id]);

  useEffect(() => {
    setLoading(true);
    const scopedUrl = `/api/forum/topics?category=${activeCategory}`;
    const allUrl = '/api/forum/topics';

    Promise.all([
      fetch(scopedUrl).then((r) => r.json()).catch(() => ({ topics: [] })),
      fetch(allUrl).then((r) => r.json()).catch(() => ({ topics: [] })),
    ])
      .then(([scopedData, allData]) => {
        setTopics(Array.isArray(scopedData?.topics) ? scopedData.topics : []);
        setAllTopics(Array.isArray(allData?.topics) ? allData.topics : []);
      })
      .catch(() => {
        setTopics([]);
        setAllTopics([]);
      })
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => {
    if (newBody.trim().length > 0) return;
    if (topicPostCategory === 'support') {
      setNewBody(SUPPORT_TEMPLATE);
    } else if (topicPostCategory === 'reports') {
      setNewBody(REPORT_TEMPLATE);
    }
  }, [topicPostCategory, newBody]);

  const handleNewTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/'); return; }
    if (!selectedCharacterName.trim()) {
      setPostError('Debes seleccionar un personaje para publicar en el foro.');
      return;
    }
    setPosting(true);
    setPostError('');
    try {
      const res = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: newTitle, category: topicPostCategory, comment: newBody, characterName: selectedCharacterName }),
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

  const applyReportFilters = () => {
    setReportIdQuery(draftReportId);
    setReportCharacterQuery(draftReportCharacter);
    setReportDateQuery(draftReportDate);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const reportId = reportIdQuery.trim();
    const reportCharacter = reportCharacterQuery.trim().toLowerCase();
    const reportDate = reportDateQuery.trim();
    const hasReportControl = !!(reportId || reportCharacter || reportDate);

    const hasSubsections = sections.some(s => s.parent_id === activeCategory);
    const source = hasReportControl
      ? allTopics
      : topics;

    const items = (hasSubsections && !hasReportControl)
      ? []
      : source.filter((topic) => hasReportControl ? true : topic.category === activeCategory)
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
      })
      .filter((topic) => {
        if (!hasReportControl) return true;

        if (reportId && !String(topic.id).includes(reportId)) return false;

        if (reportCharacter && !String(topic?.author?.username || '').toLowerCase().includes(reportCharacter)) {
          return false;
        }

        if (reportDate) {
          const created = new Date(topic.created_at);
          const yyyy = created.getFullYear();
          const mm = String(created.getMonth() + 1).padStart(2, '0');
          const dd = String(created.getDate()).padStart(2, '0');
          const localDate = `${yyyy}-${mm}-${dd}`;
          if (localDate !== reportDate) return false;
        }

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
  }, [topics, allTopics, sections, activeCategory, searchQuery, reportIdQuery, reportCharacterQuery, reportDateQuery, statusFilter, sortBy, onlyPinned, onlyLocked]);
  const latestTopics = topics.slice(0, 5);
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isStaffGM) return;
    try {
      const res = await fetch('/api/forum/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sectionForm, description: sectionForm.desc, userId: user.id }),
      });
      if (res.ok) {
        setShowAddSection(false);
        setSectionForm({ id: '', label: '', desc: '', icon: 'MessageSquare', parent_id: null });
        // Reload sections
        const r = await fetch(`/api/forum/sections?userId=${user.id}`);
        const d = await r.json();
        setSections(d.sections);
      }
    } catch (err) {}
  };

  const handleToggleLock = async (id: string, currentStatus: number) => {
    if (!user || !isStaffGM) return;
    try {
      const res = await fetch('/api/forum/sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, id, is_locked: !currentStatus }),
      });
      if (res.ok) {
        const r = await fetch(`/api/forum/sections?userId=${user.id}`);
        const d = await r.json();
        setSections(Array.isArray(d.sections) ? d.sections : []);
      }
    } catch (err) {}
  };

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
              disabled={activeSectionObj?.is_locked && !isStaffGM}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all ${
                activeSectionObj?.is_locked && !isStaffGM
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50 border border-gray-700/30'
                : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 shadow-[0_0_20px_rgba(168,85,247,0.3)] text-white'
              }`}
            >
              {activeSectionObj?.is_locked && !isStaffGM ? (
                <>
                  <Lock className="w-4 h-4" />
                  Sección Cerrada
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  Nuevo Tema
                </>
              )}
            </button>
          )}
        </div>

        {/* New Topic Form */}
        {showNewTopic && user && (
          <div className="mb-8 rounded-3xl border border-purple-900/40 bg-black/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(105,55,180,0.25)]">
            <h2 className="text-xl font-black mb-5 text-purple-300">Crear nuevo tema</h2>
            <form onSubmit={handleNewTopic} className="space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-amber-300 font-black">Publicando como personaje</p>
                <p className="text-sm text-white font-bold mt-1">{selectedCharacterName || 'Selecciona tu personaje en el panel derecho'}</p>
              </div>

              <input
                type="text"
                placeholder="Título del tema"
                className="w-full bg-black/60 border border-purple-900/50 rounded-2xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={200}
                required
              />

              {/* Locked posting category (no user choice to avoid confusion) */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Publicando en</p>
                <div className="w-full min-h-12 px-4 py-3 rounded-xl bg-black/60 border border-amber-500/35 text-sm text-white font-semibold flex items-center justify-between gap-3">
                  <span className="truncate">
                    {sections.find((s) => s.id === topicPostCategory)?.label || topicPostCategory}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 border border-amber-500/35 rounded-full px-2 py-0.5 shrink-0">
                    Bloqueado
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  La categoría se fija automáticamente según donde abriste “Nuevo Tema”.
                </p>
              </div>
              <div className="bg-[#03060d]/60 border border-purple-500/20 rounded-2xl overflow-hidden flex flex-col">
                <div className="border-b border-purple-500/20 bg-purple-900/10 p-2 flex flex-wrap gap-1">
                  <button type="button" onClick={() => insertBBCode('[b]', '[/b]')} className="p-2 hover:bg-purple-900/40 rounded-lg text-gray-300 hover:text-white transition-colors" title="Negrita"><Bold className="w-4 h-4" /></button>
                  <button type="button" onClick={() => insertBBCode('[i]', '[/i]')} className="p-2 hover:bg-purple-900/40 rounded-lg text-gray-300 hover:text-white transition-colors" title="Cursiva"><Italic className="w-4 h-4" /></button>
                  <button type="button" onClick={() => insertBBCode('[u]', '[/u]')} className="p-2 hover:bg-purple-900/40 rounded-lg text-gray-300 hover:text-white transition-colors" title="Subrayado"><Underline className="w-4 h-4" /></button>
                  <div className="w-px h-6 bg-purple-500/20 mx-1 self-center" />
                  <button type="button" onClick={() => insertBBCode('[center]', '[/center]')} className="p-2 hover:bg-purple-900/40 rounded-lg text-gray-300 hover:text-white transition-colors" title="Centrar"><AlignCenter className="w-4 h-4" /></button>
                  <div className="w-px h-6 bg-purple-500/20 mx-1 self-center" />
                  <button type="button" onClick={() => insertPromptTag('color')} className="p-2 hover:bg-purple-900/40 rounded-lg text-cyan-300 hover:text-cyan-200 transition-colors" title="Color de Texto"><Palette className="w-4 h-4" /></button>
                  <button type="button" onClick={() => insertPromptTag('size')} className="p-2 hover:bg-purple-900/40 rounded-lg text-cyan-300 hover:text-cyan-200 transition-colors" title="Tamaño de Fuente"><Type className="w-4 h-4" /></button>
                  <button type="button" onClick={() => insertPromptTag('img')} className="p-2 hover:bg-purple-900/40 rounded-lg text-fuchsia-400 hover:text-fuchsia-300 transition-colors" title="Insertar Imagen"><ImageIcon className="w-4 h-4" /></button>
                </div>
                <textarea
                  ref={textareaRef}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={6}
                  className="w-full bg-transparent px-5 py-4 text-white placeholder:text-gray-500 focus:outline-none resize-y text-[15px] leading-relaxed block"
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  required
                />
              </div>
              {postError && <p className="text-rose-400 text-sm">{postError}</p>}
              <div className="rounded-2xl border border-purple-500/35 bg-gradient-to-r from-purple-950/40 to-indigo-950/30 p-2.5">
                <button
                  type="submit"
                  disabled={posting || !selectedCharacterName || characters.length === 0}
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



        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_340px] 2xl:grid-cols-[320px_minmax(0,1fr)_360px] gap-6 items-start">
          <aside className="rounded-2xl border border-purple-900/35 bg-black/45 backdrop-blur-sm p-4 space-y-4 xl:sticky xl:top-28">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-purple-300 mb-2 flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
              </p>
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar tema o autor"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-black/50 border border-purple-900/40 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/60"
                />
              </div>
              <div className="flex flex-wrap gap-2">
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


          </aside>

          <section>
            {/* Main Category Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {mainSections.map(cat => {
                const DynamicIcon = (LucideIcons as any)[cat.icon] || LucideIcons.MessageSquare;
                const isActive = activeMainCategoryId === cat.id;
                return (
                  <motion.div
                    key={cat.id}
                    role="button"
                    tabIndex={0}
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveCategory(cat.id); }}
                    onClick={() => {
                      setActiveCategory(cat.id);
                    }}
                    className={`relative group overflow-hidden rounded-2xl border-2 transition-all p-4 flex flex-col items-center text-center gap-2 cursor-pointer ${
                      isActive 
                        ? `bg-gradient-to-br ${cat.color} border-white shadow-[0_0_25px_rgba(168,85,247,0.4)] ring-2 ring-purple-500/50` 
                        : 'bg-[#0d131b]/60 border-purple-900/20 hover:border-purple-600/50'
                    }`}
                  >
                    <div className={`p-3 rounded-2xl ${isActive ? 'bg-white/10' : 'bg-purple-900/10 group-hover:bg-purple-900/20'} transition-colors`}>
                      <DynamicIcon className={`w-6 h-6 ${isActive ? 'text-white' : cat.text_color}`} />
                    </div>
                    <div>
                      <h3 className={`text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-gray-200'}`}>
                        {cat.label}
                      </h3>
                      <p className={`text-[9px] font-bold opacity-60 uppercase tracking-tighter hidden sm:block ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {cat.description}
                      </p>
                    </div>
                    {isActive && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="absolute bottom-0 left-0 right-0 h-1 bg-white"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Sub-sections Grid (Sub-Tree) */}
            {subSections.length > 0 && (
              <div className="mb-10 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
                  <span className="text-[10px] uppercase font-black tracking-[0.4em] text-purple-400 flex items-center gap-2 px-5 py-2 bg-purple-900/10 rounded-full border border-purple-500/10 backdrop-blur-md">
                    <ChevronRight className="w-3.5 h-3.5" /> Sub-Categorías Disponibles
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {subSections.map(sub => {
                    const SubIcon = (LucideIcons as any)[sub.icon] || LucideIcons.MessageSquare;
                    const isSubActive = activeCategory === sub.id;
                    return (
                      <motion.div
                        key={sub.id}
                        role="button"
                        tabIndex={0}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveCategory(sub.id); }}
                        onClick={() => setActiveCategory(sub.id)}
                        className={`relative group overflow-hidden rounded-2xl border-2 transition-all p-5 flex items-center gap-4 text-left cursor-pointer ${
                          isSubActive 
                            ? `bg-gradient-to-br ${sub.color || 'from-purple-600 to-indigo-600'} border-white shadow-[0_0_30px_rgba(168,85,247,0.2)]` 
                            : 'bg-black/40 border-purple-900/20 hover:border-purple-600/40 hover:bg-black/60 shadow-lg'
                        }`}
                      >
                         <div className={`shrink-0 p-3.5 rounded-xl ${isSubActive ? 'bg-white/20' : 'bg-purple-900/20 group-hover:bg-purple-900/30'} transition-all`}>
                            <SubIcon className={`w-5 h-5 ${isSubActive ? 'text-white' : (sub.text_color || 'text-purple-400')}`} />
                         </div>
                         <div className="min-w-0 flex-1">
                            <h4 className={`text-[12px] font-black uppercase tracking-widest leading-none ${isSubActive ? 'text-white' : 'text-gray-100 group-hover:text-white'}`}>
                              {sub.label}
                            </h4>
                            <p className={`text-[10px] font-medium mt-1.5 line-clamp-1 opacity-60 ${isSubActive ? 'text-white' : 'text-gray-400'}`}>
                              {sub.description || 'Hilos y discusiones'}
                            </p>
                         </div>
                         {isSubActive && (
                            <div className="absolute top-3 right-3 flex items-center gap-2">
                               {sub.is_locked ? <Lock className="w-2.5 h-2.5 text-rose-500" /> : null}
                               <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]" />
                            </div>
                         )}
                         {isStaffGM && (
                           <button
                             onClick={(e) => { e.stopPropagation(); handleToggleLock(sub.id, sub.is_locked || 0); }}
                             className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all z-30 ${
                               sub.is_locked ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40 hover:bg-rose-500/30' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                             }`}
                             title={sub.is_locked ? 'Habilitar creación de temas' : 'Bloquear creación de temas'}
                           >
                             {sub.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                           </button>
                         )}
                         <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity ${isSubActive ? 'hidden' : 'block'}`}>
                            <SubIcon size={80} />
                         </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GM Tools for Sections */}
            {isStaffGM && (
              <div className="mb-6">
                {!showAddSection ? (
                  <button 
                    onClick={() => {
                      setShowAddSection(true);
                      setSectionForm({...sectionForm, parent_id: (activeSectionObj && !activeSectionObj.parent_id) ? activeSectionObj.id : null});
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-amber-600/30 text-amber-300 hover:bg-amber-600/10 text-[10px] font-black uppercase tracking-[0.1em] transition-all"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> Crear nueva subsección en {activeSectionObj?.label || 'General'}
                  </button>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl border border-amber-600/40 bg-black/60 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black uppercase text-amber-400">Panel de Gestión de Secciones</h4>
                      <button onClick={() => setShowAddSection(false)} className="text-gray-500 hover:text-white"><Plus className="w-4 h-4 rotate-45" /></button>
                    </div>
                    <form onSubmit={handleAddSection} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase">ID Único (URL)</label>
                        <input className="w-full h-10 px-4 rounded-xl bg-black/60 border border-purple-900/40 text-xs text-white" 
                               placeholder="ej: pj-eliminados" value={sectionForm.id} onChange={e => setSectionForm({...sectionForm, id: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase">Nombre Visible</label>
                        <input className="w-full h-10 px-4 rounded-xl bg-black/60 border border-purple-900/40 text-xs text-white" 
                               placeholder="ej: PJ Eliminados" value={sectionForm.label} onChange={e => setSectionForm({...sectionForm, label: e.target.value})} required />
                      </div>
                      <div className="space-y-2 col-span-full">
                        <label className="text-[10px] font-black text-gray-500 uppercase">Descripción</label>
                        <input className="w-full h-10 px-4 rounded-xl bg-black/60 border border-purple-900/40 text-xs text-white" 
                               placeholder="Detalles sobre esta sección" value={sectionForm.desc} onChange={e => setSectionForm({...sectionForm, desc: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase">Padre (Sub-sección de...)</label>
                        <select className="w-full h-10 px-4 rounded-xl bg-black/60 border border-purple-900/40 text-xs text-white"
                                value={sectionForm.parent_id || ''} onChange={e => setSectionForm({...sectionForm, parent_id: e.target.value || null})}>
                          <option value="">(Raíz / Categoría Principal)</option>
                          {mainSections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button type="submit" className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-black text-[10px] uppercase tracking-wider transition-all shadow-[0_4px_20px_rgba(217,119,6,0.2)]">
                          GUARDAR SECCIÓN
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </div>
            )}

            {activeSectionObj && <p className="text-xs text-gray-400 mb-5">{activeSectionObj.description}</p>}

            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-purple-900/30 bg-black/25 px-3 py-2">
              <p className="text-xs text-gray-400">
                Mostrando <span className="text-white font-bold">{filtered.length}</span> tema{filtered.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDraftReportId('');
                  setDraftReportCharacter('');
                  setDraftReportDate('');
                  setReportIdQuery('');
                  setReportCharacterQuery('');
                  setReportDateQuery('');
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
                <div className="text-center py-24 bg-[#0d131b]/30 rounded-3xl border border-dashed border-purple-900/20 backdrop-blur-sm">
                   {subSections.length > 0 && activeCategory === activeMainCategoryId ? (
                      <>
                        <div className="w-20 h-20 bg-purple-900/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/20">
                           <Sparkles className="w-10 h-10 text-purple-400/50" />
                        </div>
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">Selecciona una Sub-Categoría</h3>
                        <p className="max-w-xs mx-auto text-gray-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                          Para ver los temas y discusiones disponibles, elige una de las tarjetas de arriba.
                        </p>
                      </>
                   ) : (
                      <>
                        <MessageSquare className="w-16 h-16 mx-auto mb-4 text-purple-600/20" />
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-1 select-none">No hay temas aquí todavía.</h3>
                        {user && <p className="text-gray-500 text-xs font-bold uppercase tracking-widest opacity-80">¡Sé el primero en crear uno!</p>}
                      </>
                   )}
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
                          topic.category === 'support' ? 'border-rose-700/40 text-rose-400' :
                          topic.category === 'guides'  ? 'border-cyan-700/40 text-cyan-400' :
                          topic.category === 'reports' ? 'border-red-700/50 text-red-400' :
                          topic.category === 'suggestions' ? 'border-emerald-700/50 text-emerald-400' :
                          topic.category === 'migrations' ? 'border-blue-700/50 text-blue-400' :
                          'border-amber-700/40 text-amber-400'
                        }`}>
                          {sections.find(c => c.id === topic.category)?.label ?? topic.category}
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
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-amber-300 mb-2">Hablar como personaje</p>
              <div className="rounded-xl border border-amber-600/35 bg-amber-950/20 p-3 space-y-2">
                <div className="rounded-xl border border-white/10 bg-black/40 p-3 flex items-center gap-3">
                  <div className={`w-16 h-16 rounded-xl border overflow-hidden flex items-center justify-center ${selectedFaction === 'Horda' ? 'border-red-500/50 bg-red-900/20' : selectedFaction === 'Aliado' ? 'border-blue-500/50 bg-blue-900/20' : 'border-gray-500/40 bg-gray-900/20'}`}>
                    {!!selectedCharacter && !!CLASS_IMAGE_BY_ID[selectedCharacter.classId] ? (
                      <Image
                        src={CLASS_IMAGE_BY_ID[selectedCharacter.classId]}
                        alt={CLASS_LABELS[selectedCharacter.classId] || 'Clase'}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black text-gray-300">?</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-amber-200 truncate">{selectedCharacterName || 'Selecciona tu personaje'}</p>
                    <p className="text-[11px] text-gray-300 truncate">
                      {selectedCharacter ? `${CLASS_LABELS[selectedCharacter.classId] || `Clase ${selectedCharacter.classId}`} · ${RACE_LABELS[selectedCharacter.race] || `Raza ${selectedCharacter.race}`} · Lvl ${selectedCharacter.level}` : 'Sin datos de personaje'}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black uppercase tracking-wider ${selectedFaction === 'Horda' ? 'border-red-500/45 text-red-300 bg-red-900/20' : selectedFaction === 'Aliado' ? 'border-blue-500/45 text-blue-300 bg-blue-900/20' : 'border-gray-500/45 text-gray-300 bg-gray-900/20'}`}>
                        {selectedFaction}
                      </span>
                      {!!selectedCharacter && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black uppercase tracking-wider ${selectedCharacter.online ? 'border-emerald-500/45 text-emerald-300 bg-emerald-900/20' : 'border-gray-500/45 text-gray-300 bg-gray-900/20'}`}>
                          {selectedCharacter.online ? 'Online' : 'Offline'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <select
                  className="w-full bg-black/50 border border-amber-500/45 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/60"
                  value={selectedCharacterName}
                  onChange={(e) => setSelectedCharacterName(e.target.value)}
                >
                  {characters.length === 0 ? (
                    <option value="">Sin personajes disponibles</option>
                  ) : (
                    characters.map((c) => <option key={c.guid} value={c.name}>{c.name} (lvl {c.level})</option>)
                  )}
                </select>
                <p className="text-[11px] text-gray-300">Tus temas y respuestas usaran este PJ en lugar del nombre de cuenta.</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-rose-300 mb-2">Control de denuncias</p>
              <form
                className="rounded-xl border border-rose-700/35 bg-rose-950/20 p-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyReportFilters();
                }}
              >
                <input
                  type="text"
                  value={draftReportId}
                  onChange={(e) => setDraftReportId(e.target.value)}
                  placeholder="ID de denuncia (ej: 154)"
                  className="w-full bg-black/50 border border-rose-500/30 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-rose-400/60"
                />
                <input
                  type="text"
                  value={draftReportCharacter}
                  onChange={(e) => setDraftReportCharacter(e.target.value)}
                  placeholder="Nombre de personaje"
                  className="w-full bg-black/50 border border-rose-500/30 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-rose-400/60"
                />
                <input
                  type="date"
                  value={draftReportDate}
                  onChange={(e) => setDraftReportDate(e.target.value)}
                  className="w-full bg-black/50 border border-rose-500/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-400/60"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-rose-400/50 bg-rose-700/30 hover:bg-rose-700/45 text-rose-100 text-[11px] font-black uppercase tracking-wider py-2"
                >
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftReportId('');
                    setDraftReportCharacter('');
                    setDraftReportDate('');
                    setReportIdQuery('');
                    setReportCharacterQuery('');
                    setReportDateQuery('');
                  }}
                  className="w-full rounded-xl border border-rose-500/40 bg-rose-900/20 hover:bg-rose-800/30 text-rose-200 text-[11px] font-black uppercase tracking-wider py-2"
                >
                  Limpiar control denuncias
                </button>
                <p className="text-[11px] text-gray-300">Puedes usar solo 1 campo. Busca resultados relacionados en todo el foro.</p>
              </form>
            </div>

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

      {formatPromptOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" onClick={() => setFormatPromptOpen(false)}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-3xl border border-amber-400/30 bg-[#0a0f19]/95 shadow-[0_0_40px_rgba(245,158,11,0.25)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-900/25 to-purple-900/25">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Editor Shadow Shop</p>
              <h3 className="text-lg font-black text-white mt-1">{formatPromptTitle}</h3>
              <p className="text-xs text-gray-400 mt-1">{formatPromptHint}</p>
            </div>

            <div className="p-5 space-y-4">
              <input
                autoFocus
                type="text"
                value={formatPromptValue}
                onChange={(e) => {
                  setFormatPromptValue(e.target.value);
                  if (formatPromptTag === 'img') setFormatPromptPreviewError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPromptTag();
                  }
                }}
                placeholder={formatPromptPlaceholder}
                className="w-full h-12 rounded-xl border border-amber-500/30 bg-black/50 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-400/70"
              />

              {formatPromptTag === 'img' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-cyan-300/90 font-semibold">
                    Tip: usa enlaces directos que terminen en formato de imagen para que se vea en el post.
                  </p>
                  {formatPromptValue.trim() ? (
                    <div className="rounded-xl border border-cyan-400/30 bg-black/45 p-2">
                      {!formatPromptPreviewError ? (
                        <img
                          src={formatPromptValue.trim()}
                          alt="Preview"
                          className="max-h-48 w-auto max-w-full object-contain mx-auto rounded-lg"
                          onError={() => setFormatPromptPreviewError(true)}
                        />
                      ) : (
                        <p className="text-xs text-rose-300 text-center py-3 font-semibold">
                          No se pudo cargar la imagen con esa URL.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormatPromptOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/20 text-gray-300 hover:text-white hover:bg-white/5 text-xs font-black uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={applyPromptTag}
                  className="px-4 py-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white hover:from-amber-500 hover:to-orange-500 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                >
                  Insertar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
