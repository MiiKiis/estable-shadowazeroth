'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, MessageSquare, Pin, Lock, Eye,
  Send, AlertTriangle, Clock, ShieldCheck,
  Edit2, Trash2, CornerUpLeft,
} from 'lucide-react';

type Author = {
  id: number;
  username: string;
  avatar: string | null;
  role: string;
  roleColor: string;
};

type Comment = {
  id: number;
  comment: string;
  created_at: string;
  updated_at: string;
  author: Author;
};

type Topic = {
  id: number;
  title: string;
  category: string;
  pinned: boolean;
  locked: boolean;
  completed: boolean;
  views: number;
  created_at: string;
  author: { id: number; username: string };
};

const ROLE_BADGE: Record<string, string> = {
  GM:        'bg-amber-900/50 border-amber-500/50 text-amber-300',
  Moderador: 'bg-cyan-900/50  border-cyan-500/50  text-cyan-300',
  Jugador:   'bg-purple-900/50 border-purple-500/40 text-purple-300',
};

const CATEGORY_LABELS: Record<string, string> = {
  announcements: 'Anuncios',
  support: 'Soporte',
  guides:  'Guías',
  guild:   'Hermandades',
  reports: 'Denuncias',
  suggestions: 'Sugerencias',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'ahora mismo';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function parseBBCode(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, '<br/>')
    .replace(/\[b\](.*?)\[\/b\]/gi, "<strong>$1</strong>")
    .replace(/\[i\](.*?)\[\/i\]/gi, "<em>$1</em>")
    .replace(/\[u\](.*?)\[\/u\]/gi, "<u>$1</u>")
    .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, "<div class='text-center'>$1</div>")
    .replace(/\[img\](.*?)\[\/img\]/gi, "<img src='$1' class='max-w-full rounded-md shadow-[0_0_15px_rgba(168,85,247,0.4)] my-2 border border-purple-500/30' alt='Imagen adjunta' />")
    .replace(/\[color=(.*?)\](.*?)\[\/color\]/gi, "<span style='color:$1'>$2</span>")
    .replace(/\[size=(.*?)\](.*?)\[\/size\]/gi, "<span style='font-size:$1'>$2</span>")
    .replace(/\[font=(.*?)\](.*?)\[\/font\]/gi, "<span style='font-family:$1'>$2</span>");
}

function renderCommentContent(comment: string, role: string) {
  if (role === 'GM' || role === 'Moderador') {
    return <div className="text-gray-100 leading-relaxed break-words text-[15px] max-w-none" dangerouslySetInnerHTML={{ __html: parseBBCode(comment) }} />;
  }
  return <p className="text-gray-100 leading-relaxed whitespace-pre-wrap break-words text-[15px]">{comment}</p>;
}

function AvatarColumn({ author, postIndex }: { author: Author; postIndex: number }) {
  return (
    <div className="flex flex-col items-center gap-2 w-[130px] shrink-0 pt-1">
      {/* Avatar circle */}
      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-purple-600/70 shadow-[0_0_16px_rgba(147,51,234,0.4)]">
        {author.avatar ? (
          <Image
            src={`/avatares/${author.avatar}`}
            alt={author.username}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center text-xl font-black text-purple-300">
            {author.username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Username */}
      <span className="font-black text-sm text-white text-center leading-tight break-all">
        {author.username}
      </span>

      {/* Role badge */}
      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${ROLE_BADGE[author.role] ?? ROLE_BADGE['Jugador']}`}>
        {author.role}
      </span>

      {/* Post number tag */}
      <span className="text-[10px] text-gray-600 mt-auto">
        #{postIndex + 1}
      </span>
    </div>
  );
}

export default function TopicPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = Number(params.id);

  const [topic,    setTopic]    = useState<Topic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [user,     setUser]     = useState<{ id: number; username: string } | null>(null);

  const [reply,        setReply]        = useState('');
  const [posting,      setPosting]      = useState(false);
  const [postError,    setPostError]    = useState('');
  const [postSuccess,  setPostSuccess]  = useState(false);

  const [editingId,    setEditingId]    = useState<number | null>(null);
  const [editText,     setEditText]     = useState('');
  const [editSaving,   setEditSaving]   = useState(false);
  const [editError,    setEditError]    = useState('');
  const [isGM,         setIsGM]         = useState(false);
  const [isStaff,      setIsStaff]      = useState(false);
  const [deletingTopic, setDeletingTopic] = useState(false);
  const [togglingCompleted, setTogglingCompleted] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const replyRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) { try { setUser(JSON.parse(raw)); } catch {} }
  }, []);

  const loadData = async () => {
    try {
      const raw = localStorage.getItem('user');
      const currentUser = raw ? JSON.parse(raw) : null;
      const userIdParam = currentUser?.id ? `?userId=${currentUser.id}` : '';

      const [topicRes, commentsRes] = await Promise.all([
        fetch(`/api/forum/topics/${topicId}`),
        fetch(`/api/forum/topics/${topicId}/comments${userIdParam}`),
      ]);
      const topicData    = await topicRes.json();
      const commentsData = await commentsRes.json();
      if (!topicRes.ok)    throw new Error(topicData.error   || 'Tema no encontrado');
      if (!commentsRes.ok) throw new Error(commentsData.error || 'Error cargando comentarios');
      setTopic(topicData.topic);
      setComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
      setIsGM(!!commentsData.isGM);
      setIsStaff(!!commentsData.isStaff);
    } catch (e: any) {
      setError(e.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!topicId) { setError('ID de tema inválido'); setLoading(false); return; }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const handleQuote = (c: Comment) => {
    const lines = c.comment.split('\n').map(l => `> ${l}`).join('\n');
    setReply(prev => (prev ? `${prev}\n\n` : '') + `> **${c.author.username}** escribió:\n${lines}\n\n`);
    replyRef.current?.focus();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleEditStart = (c: Comment) => {
    setEditingId(c.id);
    setEditText(c.comment);
    setEditError('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditText('');
    setEditError('');
  };

  const handleEditSave = async (commentId: number) => {
    if (!user) return;
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/forum/topics/${topicId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, commentId, comment: editText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al editar');
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!user) return;
    if (!confirm('¿Estás seguro de que quieres eliminar este comentario?')) return;
    try {
      const res = await fetch(
        `/api/forum/topics/${topicId}/comments?commentId=${commentId}&userId=${user.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTopic = async () => {
    if (!user || !isGM) return;
    if (!confirm('¿Seguro que quieres borrar ESTE TEMA COMPLETO? Esta acción elimina también todos los comentarios y no se puede deshacer.')) return;

    setDeletingTopic(true);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}?userId=${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error eliminando tema');
      router.push('/forum');
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el tema');
    } finally {
      setDeletingTopic(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/'); return; }

    setPosting(true);
    setPostError('');
    setPostSuccess(false);

    try {
      const res = await fetch(`/api/forum/topics/${topicId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, comment: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error publicando');
      setReply('');
      setPostSuccess(true);
      await loadData();
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setPostSuccess(false);
      }, 200);
    } catch (err: any) {
      setPostError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleToggleCompleted = async () => {
    if (!user || !isStaff || !topic) return;
    setTogglingCompleted(true);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, completed: !topic.completed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el estado del tema');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error actualizando estado del tema');
    } finally {
      setTogglingCompleted(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#04040a]">
        <div className="w-14 h-14 rounded-full border-4 border-purple-900 border-t-purple-400 animate-spin" />
      </main>
    );
  }

  /* ── Error ── */
  if (error || !topic) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#04040a] text-white px-6">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <p className="text-lg font-bold text-rose-300">{error || 'Tema no encontrado'}</p>
          <Link href="/forum" className="mt-4 inline-block text-purple-400 hover:text-purple-300 underline text-sm">
            Volver al foro
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen pt-28 pb-20 text-white selection:bg-purple-600/30 relative overflow-x-hidden"
      style={{
        backgroundImage: "url('/fono.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/65" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">

        {/* Back + breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
          <Link href="/forum" className="inline-flex items-center gap-1 hover:text-purple-300 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Foro
          </Link>
          <span>/</span>
          <span className="text-gray-500">{CATEGORY_LABELS[topic.category] ?? topic.category}</span>
          <span>/</span>
          <span className="text-gray-300 truncate max-w-xs">{topic.title}</span>
        </div>

        {/* Topic header panel */}
        <div className="rounded-3xl border border-purple-900/40 bg-black/50 backdrop-blur-xl px-6 py-5 mb-6 shadow-[0_0_40px_rgba(105,55,180,0.2)]">
          <div className="flex items-start gap-3 flex-wrap">
            {topic.pinned && <Pin  className="w-5 h-5 text-amber-400 shrink-0 mt-1" />}
            {topic.locked && <Lock className="w-5 h-5 text-rose-400  shrink-0 mt-1" />}
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight flex-1">
              {topic.title}
            </h1>
            {user && isStaff && (
              <button
                onClick={handleToggleCompleted}
                disabled={togglingCompleted}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  topic.completed
                    ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
                    : 'border-cyan-700/60 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/45'
                }`}
                title="Marcar tema como completado"
              >
                <ShieldCheck className="w-4 h-4" />
                {togglingCompleted ? 'ACTUALIZANDO...' : topic.completed ? 'MARCADO COMPLETADO' : 'MARCAR COMPLETADO'}
              </button>
            )}
            {user && isGM && (
              <button
                onClick={handleDeleteTopic}
                disabled={deletingTopic}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-700/60 bg-rose-950/40 text-rose-300 hover:text-rose-200 hover:bg-rose-900/50 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-black uppercase tracking-wider transition-all"
                title="Borrar tema completo"
              >
                <Trash2 className="w-4 h-4" />
                {deletingTopic ? 'BORRANDO...' : 'BORRAR TEMA'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {comments.length} {comments.length === 1 ? 'respuesta' : 'respuestas'}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {topic.views} vistas
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(topic.created_at)}
            </span>
            {topic.locked && (
              <span className="flex items-center gap-1 text-rose-400 font-semibold">
                <Lock className="w-3.5 h-3.5" /> Tema cerrado
              </span>
            )}
            {topic.completed && (
              <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Completado por staff
              </span>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="space-y-4 mb-8">
          {comments.map((c, idx) => (
            <div
              key={c.id}
              className="rounded-3xl border border-purple-900/40 bg-black/45 backdrop-blur-sm overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            >
              <div className="flex gap-0">
                {/* Left: profile column */}
                <div className="hidden sm:flex flex-col items-center gap-2 px-5 py-5 border-r border-purple-900/30 bg-black/30 w-[150px] shrink-0">
                  <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-purple-600/70 shadow-[0_0_16px_rgba(147,51,234,0.35)]">
                    {c.author.avatar ? (
                      <Image
                        src={`/avatares/${c.author.avatar}`}
                        alt={c.author.username}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center text-xl font-black text-purple-300">
                        {c.author.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="font-black text-sm text-white text-center break-all leading-tight">
                    {c.author.username}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${ROLE_BADGE[c.author.role] ?? ROLE_BADGE['Jugador']}`}>
                    {c.author.role}
                  </span>
                  <span className="text-[10px] text-gray-600 mt-auto">#{idx + 1}</span>
                </div>

                {/* Right: message */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Post header bar */}
                  <div className="flex items-center justify-between gap-2 px-5 py-2 border-b border-purple-900/25 bg-purple-950/20">
                    {/* Mobile: show username here */}
                    <div className="flex items-center gap-2 sm:hidden">
                      <div className="relative w-7 h-7 rounded-full overflow-hidden border border-purple-600/60">
                        {c.author.avatar ? (
                          <Image src={`/avatares/${c.author.avatar}`} alt={c.author.username} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center text-xs font-black text-purple-300">
                            {c.author.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-sm text-white">{c.author.username}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROLE_BADGE[c.author.role] ?? ROLE_BADGE['Jugador']}`}>
                        {c.author.role}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500 ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(c.created_at)}
                      <span className="hidden sm:inline ml-1 text-gray-600">· {formatDate(c.created_at)}</span>
                    </span>
                  </div>

                  {/* Message body */}
                  <div className="px-5 py-5 bg-gray-900/30 flex-1">
                    {editingId === c.id ? (
                      <div className="space-y-3">
                        <textarea
                          rows={6}
                          className="w-full bg-black/60 border border-purple-900/50 rounded-2xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60 resize-none text-[15px] leading-relaxed"
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          disabled={editSaving}
                        />
                        {editError && (
                          <p className="text-rose-400 text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {editError}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditSave(c.id)}
                            disabled={editSaving || !editText.trim()}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-black uppercase tracking-wider transition-all"
                          >
                            {editSaving ? 'GUARDANDO...' : 'GUARDAR'}
                          </button>
                          <button
                            onClick={handleEditCancel}
                            disabled={editSaving}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 text-xs font-bold uppercase tracking-wider transition-all"
                          >
                            CANCELAR
                          </button>
                        </div>
                      </div>
                    ) : (
                      renderCommentContent(c.comment, c.author.role)
                    )}

                    {/* Action bar */}
                    {editingId !== c.id && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                        {user && !topic.locked && (
                          <button
                            onClick={() => handleQuote(c)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-purple-300 hover:bg-purple-900/20 transition-all"
                            title="Citar"
                          >
                            <CornerUpLeft className="w-3.5 h-3.5" /> Citar
                          </button>
                        )}
                        {user && user.id === c.author.id && !topic.locked && (
                          <button
                            onClick={() => handleEditStart(c)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-cyan-300 hover:bg-cyan-900/20 transition-all"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                          </button>
                        )}
                        {user && (user.id === c.author.id || isGM) && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-rose-400 hover:bg-rose-900/20 transition-all ml-auto"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div ref={bottomRef} />

        {/* Reply box */}
        {!topic.locked ? (
          user ? (
            <div className="rounded-3xl border border-purple-900/40 bg-black/50 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(105,55,180,0.2)]">
              <h2 className="flex items-center gap-2 text-lg font-black text-purple-300 mb-4">
                <MessageSquare className="w-5 h-5" /> Publicar Respuesta
              </h2>
              <form onSubmit={handlePost} className="space-y-4">
                <textarea
                  ref={replyRef}
                  placeholder="Escribe tu respuesta aquí..."
                  rows={6}
                  className="w-full bg-black/60 border border-purple-900/50 rounded-2xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60 resize-none text-[15px] leading-relaxed"
                  value={reply}
                  onChange={e => { setReply(e.target.value); setPostError(''); }}
                  disabled={posting}
                />
                {postError && (
                  <div className="flex items-center gap-2 text-rose-300 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{postError}
                  </div>
                )}
                {postSuccess && (
                  <p className="text-emerald-400 text-sm">¡Comentario publicado!</p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">{reply.length} / 10.000</span>
                  <button
                    type="submit"
                    disabled={posting || !reply.trim()}
                    className={`inline-flex items-center gap-2 px-7 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-[0_8px_24px_rgba(91,33,182,0.4)] ${
                      posting || !reply.trim()
                        ? 'bg-purple-800/50 cursor-not-allowed opacity-60'
                        : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    {posting ? 'PUBLICANDO...' : 'PUBLICAR COMENTARIO'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-3xl border border-purple-900/40 bg-black/40 backdrop-blur-sm px-6 py-8 text-center">
              <p className="text-gray-400 mb-3">Debes iniciar sesión para responder.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 font-black text-sm uppercase tracking-wider transition-all"
              >
                <ShieldCheck className="w-4 h-4" /> Iniciar Sesión
              </Link>
            </div>
          )
        ) : (
          <div className="rounded-3xl border border-rose-900/40 bg-rose-950/20 backdrop-blur-sm px-6 py-5 flex items-center gap-3 text-rose-300">
            <Lock className="w-5 h-5 shrink-0" />
            <p className="font-semibold">Este tema está cerrado. No se pueden publicar más respuestas.</p>
          </div>
        )}
      </div>
    </main>
  );
}
