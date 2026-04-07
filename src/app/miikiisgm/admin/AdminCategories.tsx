"use client";
import React, { useEffect, useState } from 'react';
import { Tag, Trash2, PlusCircle, Save, Layers, Image as ImageIcon, Type, Hash, ChevronRight, Edit3 } from 'lucide-react';

interface Category {
  id: number;
  slug: string;
  name: string;
  label: string; // Alias for UI compatibility
  icon: string;
  image_url: string | null;
  image?: string; // Alias
  description: string | null;
  parent_id: number | null;
  order_index: number;
}

function normalizeParentId(parentId: number | null | undefined): number | null {
  const parsed = Number(parentId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => {
    const orderDiff = Number(a.order_index || 0) - Number(b.order_index || 0);
    if (orderDiff !== 0) return orderDiff;
    return Number(a.id) - Number(b.id);
  });
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    slug: '',
    name: '',
    icon: 'Package',
    image_url: '',
    description: '',
    parent_id: '',
    order_index: '0'
  });

  const fetchCategories = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shop/categories?userId=${user.id}`);
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories || []);
      } else {
        setError(data.error || 'Error al cargar categorías');
      }
    } catch (err) {
      setError('Error de conexión al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      slug: cat.slug,
      name: cat.name,
      icon: cat.icon,
      image_url: cat.image_url || '',
      description: cat.description || '',
      parent_id: cat.parent_id ? String(cat.parent_id) : '',
      order_index: String(cat.order_index)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({
      slug: '',
      name: '',
      icon: 'Package',
      image_url: '',
      description: '',
      parent_id: '',
      order_index: '0'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/shop/categories', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: editingId,
          userId: user.id,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          order_index: Number(form.order_index) || 0
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(editingId ? 'Categoría actualizada' : 'Categoría creada');
        handleCancel();
        await fetchCategories();
      } else {
        setError(data.error || 'Error al guardar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Seguro que quieres eliminar esta categoría?')) return;
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/shop/categories?id=${id}&userId=${user.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Categoría eliminada');
        await fetchCategories();
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const orderedCategories = sortCategories(categories);
  const rootCategories = orderedCategories.filter(c => normalizeParentId(c.parent_id) === null);

  const getChildren = (parentId: number | null) =>
    orderedCategories.filter(c => normalizeParentId(c.parent_id) === (parentId === null ? null : Number(parentId)));

  const getDescendantIds = (parentId: number, visited = new Set<number>()): Set<number> => {
    for (const child of getChildren(parentId)) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      getDescendantIds(child.id, visited);
    }
    return visited;
  };

  const blockedParentIds = new Set<number>();
  if (editingId) {
    blockedParentIds.add(editingId);
    for (const descendantId of getDescendantIds(editingId)) blockedParentIds.add(descendantId);
  }

  const buildParentOptions = (parentId: number | null, depth = 0, path = new Set<number>()): JSX.Element[] => {
    const out: JSX.Element[] = [];
    const nodes = getChildren(parentId);

    for (const node of nodes) {
      if (path.has(node.id)) continue;

      if (!blockedParentIds.has(node.id)) {
        const prefix = depth > 0 ? `${'\u00A0\u00A0'.repeat(depth)}↳ ` : '';
        out.push(
          <option key={node.id} value={node.id}>
            {prefix}{node.name}
          </option>
        );
      }

      const nextPath = new Set(path);
      nextPath.add(node.id);
      out.push(...buildParentOptions(node.id, depth + 1, nextPath));
    }

    return out;
  };

  const handleCreateChild = (parent: Category) => {
    setEditingId(null);
    setForm(prev => ({
      ...prev,
      slug: '',
      name: '',
      description: '',
      parent_id: String(parent.id),
      order_index: '0',
    }));
    setSuccess(`Creando subcategoría dentro de: ${parent.name}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderSchema = (parentId: number | null, depth = 0, path = new Set<number>()): JSX.Element[] => {
    const rows: JSX.Element[] = [];
    const nodes = getChildren(parentId);

    for (const node of nodes) {
      if (path.has(node.id)) continue;
      const nextPath = new Set(path);
      nextPath.add(node.id);

      const prefix = depth === 0 ? '•' : `${'│  '.repeat(Math.max(0, depth - 1))}└─`;

      rows.push(
        <div key={node.id} className="rounded-xl border border-white/10 bg-[#090d18] px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-fuchsia-400/90 whitespace-pre">{prefix}</span>
              <span className="font-bold text-sm text-white truncate">{node.name}</span>
              <span className="text-[10px] text-gray-400 font-mono truncate">{node.slug}</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-mono">
              id:{node.id} · parent:{normalizeParentId(node.parent_id) ?? 'root'} {node.image_url ? '· img:url' : ''}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleCreateChild(node)}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all text-[10px] font-black uppercase"
              title="Crear subcategoría"
            >
              + hija
            </button>
            <button
              onClick={() => handleEdit(node)}
              className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all"
              title="Editar"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(node.id)}
              className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-rose-400 transition-all"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      );

      rows.push(...renderSchema(node.id, depth + 1, nextPath));
    }

    return rows;
  };

  return (
    <div className="max-w-6xl mx-auto py-6 text-white">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <Layers className="w-8 h-8 text-fuchsia-400" /> Gestión de Tienda
        </h2>
        <div className="text-xs text-gray-500 uppercase tracking-widest font-bold bg-white/5 px-4 py-2 rounded-full border border-white/10">
          Personalización de Secciones
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-900/20 text-rose-300 font-bold animate-pulse">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-900/20 text-emerald-300 font-bold">
          {success}
        </div>
      )}

      {/* FORM */}
      <div className="mb-12 bg-black/40 border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
           <Tag className="w-24 h-24" />
        </div>
        
        <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-fuchsia-300">
          {editingId ? <Edit3 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
          {editingId ? `Modificando: ${form.name}` : 'Crear Nueva Sección o Subsección'}
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-fuchsia-500" /> Slug Único (ID)
            </label>
            <input 
              className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 transition-all text-sm font-mono" 
              placeholder="pve-gear" 
              value={form.slug} 
              onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} 
              required 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Type className="w-3 h-3 text-fuchsia-500" /> Nombre Visible
            </label>
            <input 
              className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 transition-all text-sm" 
              placeholder="Ej: Armas Heroicas" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              required 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Tag className="w-3 h-3 text-fuchsia-500" /> Icono (opcional)
            </label>
            <input 
              className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 transition-all text-sm" 
              placeholder="Ej: Swords, Shield, Star" 
              value={form.icon} 
              onChange={e => setForm({...form, icon: e.target.value})} 
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <ImageIcon className="w-3 h-3 text-fuchsia-500" /> URL de Imagen (recomendado)
            </label>
            <input 
              className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 transition-all text-sm" 
              placeholder="https://tupagina.com/imagen.webp" 
              value={form.image_url} 
              onChange={e => setForm({...form, image_url: e.target.value})} 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-fuchsia-500" /> Categoría Padre (subnivel infinito)
            </label>
            <select 
              className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 transition-all text-sm cursor-pointer"
              value={form.parent_id}
              onChange={e => setForm({...form, parent_id: e.target.value})}
            >
              <option value="">-- Ninguna (Es sección principal) --</option>
              {buildParentOptions(null)}
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
               Descripción / Info Adicional
            </label>
            <textarea 
              className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 transition-all text-sm min-h-[80px]" 
              placeholder="Describe brevemente lo que se encuentra en esta sección..." 
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})} 
            />
          </div>

          <div className="md:col-span-full flex gap-3 pt-4 border-t border-white/5">
            <button 
              className="flex-1 bg-gradient-to-r from-fuchsia-700 to-purple-700 hover:from-fuchsia-600 hover:to-purple-600 text-white font-black px-8 py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50" 
              type="submit"
              disabled={saving}
            >
              <PlusCircle className="w-5 h-5" /> {editingId ? 'Actualizar Sección' : 'Crear Nueva Sección'}
            </button>
            {editingId && (
              <button 
                onClick={handleCancel}
                className="px-6 py-4 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all"
                type="button"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* LIST */}
      <div className="space-y-6">
        <h3 className="text-xl font-black mb-4 flex items-center gap-2">
          Estructura Actual
          <span className="text-xs bg-fuchsia-900/40 text-fuchsia-300 px-2 py-1 rounded-md border border-fuchsia-500/30">{categories.length}</span>
        </h3>

        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4 opacity-50">
            <div className="w-10 h-10 border-4 border-fuchsia-900 border-t-fuchsia-500 rounded-full animate-spin" />
            <p className="text-sm font-bold uppercase tracking-widest">Sincronizando base de datos...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {renderSchema(null)}
            {rootCategories.length === 0 && (
              <div className="text-center py-20 bg-black/20 rounded-3xl border border-dashed border-white/10">
                <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No has configurado ninguna sección aún.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
