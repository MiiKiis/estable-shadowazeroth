'use client';

import React, { useEffect, useState } from 'react';
import { PlusCircle, Trash2, Edit2, MessageSquare, Save, X, ChevronRight, Tag, Hash, Layers, Type, Palette } from 'lucide-react';

interface ForumSection {
  id: string;
  label: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  border: string | null;
  text_color: string | null;
  parent_id: string | null;
  order_index: number;
}

const EMPTY_SECTION: Omit<ForumSection, 'order_index'> = {
  id: '',
  label: '',
  description: '',
  icon: 'MessageSquare',
  color: 'from-purple-700 to-indigo-700',
  border: 'border-purple-700/50',
  text_color: 'text-purple-300',
  parent_id: null,
};

const PRESET_COLORS = [
  { name: 'Morado', color: 'from-fuchsia-700 to-fuchsia-900', border: 'border-fuchsia-700/50', text: 'text-fuchsia-300', dot: 'bg-fuchsia-500' },
  { name: 'Rojo', color: 'from-rose-700 to-rose-900', border: 'border-rose-700/50', text: 'text-rose-300', dot: 'bg-rose-500' },
  { name: 'Cyan', color: 'from-cyan-700 to-cyan-900', border: 'border-cyan-700/50', text: 'text-cyan-300', dot: 'bg-cyan-500' },
  { name: 'Granate', color: 'from-red-700 to-red-900', border: 'border-red-700/50', text: 'text-red-300', dot: 'bg-red-500' },
  { name: 'Verde', color: 'from-emerald-700 to-emerald-900', border: 'border-emerald-700/50', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  { name: 'Azul', color: 'from-blue-700 to-blue-900', border: 'border-blue-700/50', text: 'text-blue-300', dot: 'bg-blue-500' },
  { name: 'Naranja', color: 'from-amber-700 to-amber-900', border: 'border-amber-700/50', text: 'text-amber-300', dot: 'bg-amber-500' },
  { name: 'Gris', color: 'from-slate-600 to-slate-800', border: 'border-slate-600/50', text: 'text-slate-300', dot: 'bg-slate-400' },
];

export default function AdminForumSections() {
  const [sections, setSections] = useState<ForumSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ForumSection, 'order_index'>>(EMPTY_SECTION);

  const getStoredUser = () => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  };

  const fetchSections = async () => {
    setLoading(true);
    try {
      const user = getStoredUser();
      const res = await fetch(`/api/forum/sections?userId=${user?.id || 0}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSections(data.sections || []);
    } catch (err: any) {
      setError('Error al cargar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSections(); }, []);

  const openNew = () => {
    setForm(EMPTY_SECTION);
    setEditingId(null);
    setIsEditing(true);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = (s: ForumSection) => {
    setForm({
      id: s.id,
      label: s.label,
      description: s.description || '',
      icon: s.icon || 'MessageSquare',
      color: s.color || 'from-purple-700 to-indigo-700',
      border: s.border || 'border-purple-700/50',
      text_color: s.text_color || 'text-purple-300',
      parent_id: s.parent_id || null,
    });
    setEditingId(s.id);
    setIsEditing(true);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setForm(EMPTY_SECTION);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = getStoredUser();
    if (!user?.id) { setError('No autenticado'); return; }
    if (!form.id || !form.label) { setError('ID y Nombre son obligatorios.'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/forum/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          id: form.id.trim(),
          label: form.label.trim(),
          description: form.description?.trim() || null,
          icon: form.icon || 'MessageSquare',
          color: form.color,
          border: form.border,
          text_color: form.text_color,
          parent_id: form.parent_id?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar.');
      setSuccess(editingId ? 'Sección actualizada.' : 'Sección creada.');
      setIsEditing(false);
      setEditingId(null);
      fetchSections();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const user = getStoredUser();
    if (!user?.id) return;
    if (!window.confirm('¿Eliminar esta sección? Los temas creados en ella NO se pierden, pero quedarán sin categoría activa.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/forum/sections?userId=${user.id}&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      setSuccess('Sección eliminada.');
      fetchSections();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const mainSections = sections.filter(s => !s.parent_id);

  return (
    <div className="max-w-6xl mx-auto py-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-purple-400" /> Secciones del Foro
        </h2>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white px-5 py-3 rounded-xl font-black text-sm uppercase tracking-wider shadow-[0_4px_20px_rgba(91,33,182,0.4)] transition-all"
        >
          <PlusCircle className="w-4 h-4" /> Nueva Sección
        </button>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-900/20 text-rose-300 font-bold animate-pulse">{error}</div>}
      {success && <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-900/20 text-emerald-300 font-bold">{success}</div>}

      {/* ── FORM ── */}
      {isEditing && (
        <div className="mb-12 bg-black/40 border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <MessageSquare className="w-24 h-24" />
          </div>
          <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-purple-300">
            {editingId ? <Edit2 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            {editingId ? `Editando: ${form.label}` : 'Crear Nueva Sección o Subsección'}
          </h3>

          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-purple-500" /> ID Único (URL)
              </label>
              <input
                className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 text-sm font-mono disabled:opacity-50"
                placeholder="ej: pve-avanzado"
                value={form.id}
                disabled={!!editingId}
                onChange={e => setForm({ ...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Type className="w-3 h-3 text-purple-500" /> Nombre Visible
              </label>
              <input
                className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 text-sm"
                placeholder="ej: PvE Avanzado"
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-purple-500" /> Categoría Padre (Subsección)
              </label>
              <select
                className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 text-sm cursor-pointer"
                value={form.parent_id || ''}
                onChange={e => setForm({ ...form, parent_id: e.target.value || null })}
              >
                <option value="">-- Ninguna (Sección Principal) --</option>
                {mainSections.filter(s => s.id !== editingId).map(s => (
                  <option key={s.id} value={s.id}>{s.label} ({s.id})</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción</label>
              <textarea
                className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 text-sm min-h-[70px]"
                placeholder="Describe brevemente el propósito de esta sección..."
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="md:col-span-3 space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Palette className="w-3 h-3 text-purple-500" /> Color y Estilo de la Card
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setForm({ ...form, color: p.color, border: p.border, text_color: p.text })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold transition-all ${
                      form.color === p.color
                        ? 'border-white/40 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)] ring-2 ring-white/20'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${p.dot}`} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-full flex gap-3 pt-4 border-t border-white/5">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-black px-8 py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" /> {saving ? 'Guardando...' : (editingId ? 'Actualizar Sección' : 'Crear Sección')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-4 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── LIST as CARDS ── */}
      {loading ? (
        <div className="flex flex-col items-center py-20 gap-4 opacity-50">
          <div className="w-10 h-10 border-4 border-purple-900 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm font-bold uppercase tracking-widest">Cargando secciones...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {mainSections.length === 0 ? (
            <div className="text-center py-20 bg-black/20 rounded-3xl border border-dashed border-white/10">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No hay secciones configuradas aún.</p>
            </div>
          ) : (
            mainSections.map(parent => {
              const subs = sections.filter(s => s.parent_id === parent.id);
              return (
                <div key={parent.id}>
                  {/* Parent Card */}
                  <div className={`group bg-[#0a0a1a] border border-white/5 p-6 rounded-2xl hover:border-purple-500/30 transition-all shadow-xl`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${parent.color || 'from-purple-700 to-indigo-700'} border ${parent.border || 'border-purple-500/50'} flex items-center justify-center shadow-lg shrink-0`}>
                          <MessageSquare className="w-6 h-6 text-white opacity-90" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`font-black text-lg text-white truncate`}>{parent.label}</h4>
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-black uppercase tracking-tighter shrink-0">
                              SECCIÓN PRINCIPAL
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                            <span>ID: {parent.id}</span>
                            <span>•</span>
                            <span className={parent.text_color || 'text-purple-400'}>{subs.length} Subsecciones</span>
                            {parent.description && <><span>•</span><span className="text-gray-600 truncate max-w-[200px]">{parent.description}</span></>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(parent)}
                          className="p-3 rounded-xl bg-white/5 text-gray-400 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(parent.id)}
                          className="p-3 rounded-xl bg-rose-900/10 text-rose-400 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Sub-section CARDS */}
                    {subs.length > 0 && (
                      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pl-4 border-l-2 border-purple-500/10">
                        {subs.map(sub => (
                          <div
                            key={sub.id}
                            className={`relative group/sub bg-black/40 rounded-2xl border ${sub.border || 'border-cyan-500/20'} overflow-hidden hover:border-cyan-400/50 transition-all shadow-md`}
                            style={{ minHeight: 100 }}
                          >
                            <div className={`h-2 w-full bg-gradient-to-r ${sub.color || 'from-cyan-700 to-blue-900'}`} />
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h5 className={`font-black text-sm ${sub.text_color || 'text-cyan-300'}`}>{sub.label}</h5>
                                  <p className="text-[10px] text-gray-600 font-mono mt-0.5">{sub.id}</p>
                                  {sub.description && <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{sub.description}</p>}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity shrink-0">
                                  <button onClick={() => openEdit(sub)} className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-purple-300 transition-all">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDelete(sub.id)} className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-rose-400 transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <span className="inline-block mt-2 text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 font-bold uppercase tracking-tighter">SUBSECCIÓN</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
