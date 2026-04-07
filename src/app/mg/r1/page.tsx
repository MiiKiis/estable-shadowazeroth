'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Package, Puzzle, Send, ShieldCheck } from 'lucide-react';

type R1Tab = 'shop' | 'addons' | 'forum';

type Submission = {
  id: number;
  submission_type: 'shop' | 'addon' | 'forum';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  review_note?: string | null;
};

type CharacterOption = {
  guid: number;
  name: string;
  level: number;
};

export default function GmR1PanelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<R1Tab>('shop');
  const [userId, setUserId] = useState<number>(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [shopCategories, setShopCategories] = useState<Array<{ id: number; slug: string; name: string; parent_id?: number | null }>>([]);
  const [shopForm, setShopForm] = useState({
    name: '',
    priceDp: '',
    priceVp: '',
    category: 'misc',
    image: '',
    description: '',
    bundleItems: [{ id: '', count: '1' }],
  });
  const [categorySearch, setCategorySearch] = useState('');

  const [addonForm, setAddonForm] = useState({ name: '', url: '' });
  const [forumSections, setForumSections] = useState<Array<{ id: string; label: string; parent_id?: string | null }>>([]);
  const [forumCharacters, setForumCharacters] = useState<CharacterOption[]>([]);
  const [forumForm, setForumForm] = useState({ title: '', category: 'announcements', comment: '', characterName: '' });

  const statusCount = useMemo(() => {
    const base = { pending: 0, approved: 0, rejected: 0 };
    for (const s of submissions) base[s.status] += 1;
    return base;
  }, [submissions]);

  const normalizeParentId = (value: number | null | undefined): number | null => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  const orderedShopCategories = [...shopCategories].sort((a, b) => Number(a.id) - Number(b.id));
  const categoryById = new Map(orderedShopCategories.map((c) => [Number(c.id), c]));

  const categoryOptions = orderedShopCategories.map((cat) => {
    const parts = [cat.name];
    const visited = new Set<number>([Number(cat.id)]);
    let parentId = normalizeParentId(cat.parent_id);

    while (parentId !== null) {
      if (visited.has(parentId)) break;
      visited.add(parentId);
      const parent = categoryById.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = normalizeParentId(parent.parent_id);
    }

    return {
      id: cat.id,
      slug: cat.slug,
      label: parts.join(' / '),
    };
  });

  const filteredCategoryOptions = categoryOptions.filter((opt) =>
    opt.label.toLowerCase().includes(categorySearch.trim().toLowerCase())
  );

  const selectedCategoryPath = categoryOptions.find((c) => c.slug === shopForm.category)?.label || 'Sin categoría seleccionada';

  const loadSubmissions = async (uid: number) => {
    const res = await fetch(`/api/gm/r1/submissions?userId=${uid}`);
    const data = await res.json();
    if (res.ok) {
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        const uid = Number(user?.id || 0);
        const username = String(user?.username || '').toLowerCase();
        const allowedUsers = new Set(['soporte1', 'gmsoporte1']);
        if (!uid) {
          router.replace('/');
          return;
        }

        const pointsRes = await fetch(`/api/account/points?accountId=${uid}`);
        const pointsData = await pointsRes.json();
        const gmLevel = Number(pointsData?.gmlevel || 0);
        if (gmLevel < 1 && !allowedUsers.has(username)) {
          router.replace('/dashboard');
          return;
        }

        setUserId(uid);

        const [catRes, sectionRes, charRes] = await Promise.all([
          fetch('/api/shop/categories'),
          fetch('/api/forum/sections'),
          fetch(`/api/characters?accountId=${uid}`),
        ]);
        const catData = await catRes.json();
        const sectionData = await sectionRes.json();
        const charData = await charRes.json();
        setShopCategories(Array.isArray(catData) ? catData : []);
        const sections = Array.isArray(sectionData?.sections) ? sectionData.sections : [];
        const chars = Array.isArray(charData?.characters) ? charData.characters : [];
        const charOptions: CharacterOption[] = chars
          .map((c: any) => ({ guid: Number(c?.guid || 0), name: String(c?.name || ''), level: Number(c?.level || 0) }))
          .filter((c: CharacterOption) => c.guid > 0 && c.name.length > 0)
          .sort((a: CharacterOption, b: CharacterOption) => a.name.localeCompare(b.name));
        setForumCharacters(charOptions);
        setForumSections(sections);
        setForumForm((p) => ({
          ...p,
          category: sections.length > 0 ? sections[0].id : p.category,
          characterName: charOptions.length > 0 ? charOptions[0].name : '',
        }));

        await loadSubmissions(uid);
      } catch {
        setError('No se pudo inicializar el panel R1');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const sendSubmission = async (type: 'shop' | 'addon' | 'forum', payload: any) => {
    setError('');
    setSuccess('');
    const res = await fetch('/api/gm/r1/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type, payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo enviar solicitud');
    setSuccess('Solicitud enviada a revisión del admin.');
    await loadSubmissions(userId);
  };

  const handleSubmitShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedItems = shopForm.bundleItems
        .map((row) => ({
          id: Number(String(row.id || '').trim()),
          count: Math.max(1, Number(String(row.count || '1').trim()) || 1),
        }))
        .filter((x) => x.id > 0);

      if (parsedItems.length === 0) {
        throw new Error('Añade al menos un item al bundle.');
      }

      await sendSubmission('shop', {
        ...shopForm,
        quality: 'comun',
        soapCount: 1,
        itemId: parsedItems?.[0]?.id || 0,
        bundleItems: parsedItems,
      });
      setShopForm({
        name: '',
        priceDp: '',
        priceVp: '',
        category: shopForm.category,
        image: '',
        description: '',
        bundleItems: [{ id: '', count: '1' }],
      });
    } catch (err: any) {
      setError(err.message || 'Error enviando solicitud de tienda');
    }
  };

  const handleSubmitAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendSubmission('addon', addonForm);
      setAddonForm({ name: '', url: '' });
    } catch (err: any) {
      setError(err.message || 'Error enviando solicitud de addon');
    }
  };

  const handleSubmitForum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!forumForm.characterName.trim()) {
        throw new Error('Debes seleccionar un personaje para publicar en foro.');
      }
      await sendSubmission('forum', forumForm);
      setForumForm((p) => ({ ...p, title: '', comment: '' }));
    } catch (err: any) {
      setError(err.message || 'Error enviando solicitud de foro');
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-black text-white flex items-center justify-center">Cargando panel R1...</main>;
  }

  return (
    <main className="min-h-screen text-white pt-10 pb-12 px-4 md:px-8 bg-[#05070f]">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-cyan-300" />
          <h1 className="text-3xl font-black">Panel GM R1</h1>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'shop', label: 'Tienda', icon: <Package className="w-4 h-4" /> },
            { id: 'addons', label: 'Addons', icon: <Puzzle className="w-4 h-4" /> },
            { id: 'forum', label: 'Post Foro', icon: <MessageSquare className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as R1Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold ${activeTab === tab.id ? 'bg-cyan-700/30 border-cyan-400/40' : 'bg-white/5 border-white/10'}`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {(error || success) && (
          <div className={`rounded-xl px-4 py-3 border font-bold ${error ? 'border-rose-500/40 bg-rose-900/20 text-rose-300' : 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300'}`}>
            {error || success}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-[#0b1020] p-5">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-black">Resumen de solicitudes</p>
          <div className="mt-2 flex gap-2 text-xs font-black">
            <span className="px-2 py-1 rounded bg-amber-900/40 text-amber-300">Pendientes: {statusCount.pending}</span>
            <span className="px-2 py-1 rounded bg-emerald-900/40 text-emerald-300">Aprobadas: {statusCount.approved}</span>
            <span className="px-2 py-1 rounded bg-rose-900/40 text-rose-300">Rechazadas: {statusCount.rejected}</span>
          </div>
        </div>

        {activeTab === 'shop' && (
          <form onSubmit={handleSubmitShop} className="rounded-2xl border border-white/10 bg-[#0b1020] p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" placeholder="Nombre del pack/item" value={shopForm.name} onChange={(e) => setShopForm((p) => ({ ...p, name: e.target.value }))} required />
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" placeholder="Icono o URL imagen" value={shopForm.image} onChange={(e) => setShopForm((p) => ({ ...p, image: e.target.value }))} />
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" type="number" placeholder="Precio DP" value={shopForm.priceDp} onChange={(e) => setShopForm((p) => ({ ...p, priceDp: e.target.value }))} />
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" type="number" placeholder="Precio VP" value={shopForm.priceVp} onChange={(e) => setShopForm((p) => ({ ...p, priceVp: e.target.value }))} />
            <input
              className="md:col-span-2 bg-black/40 border border-cyan-500/30 rounded-xl px-4 py-3 text-cyan-100"
              placeholder="Buscar categoría o subcategoría (ej: horda, warrior, tier 9...)"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
            />
            <div className="md:col-span-2 rounded-xl border border-white/10 bg-black/30 p-2 max-h-56 overflow-y-auto">
              {filteredCategoryOptions.length === 0 ? (
                <p className="px-3 py-2 text-xs font-bold text-amber-300">No se encontraron categorías con ese filtro.</p>
              ) : (
                filteredCategoryOptions.map((c) => {
                  const isSelected = shopForm.category === c.slug;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setShopForm((p) => ({ ...p, category: c.slug }))}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${isSelected ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100' : 'bg-white/[0.02] border-white/5 text-gray-200 hover:bg-white/[0.06] hover:border-white/20'}`}
                    >
                      <p className="text-sm font-bold leading-tight">{c.label}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-1">slug: {c.slug}</p>
                    </button>
                  );
                })
              )}
            </div>
            <div className="md:col-span-2 bg-purple-900/10 border border-purple-500/20 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-purple-300 font-bold uppercase tracking-wider">Items del bundle</label>
                <button
                  type="button"
                  onClick={() => setShopForm((p) => ({ ...p, bundleItems: [...p.bundleItems, { id: '', count: '1' }] }))}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white text-[11px] font-black uppercase tracking-wider"
                >
                  + Añadir item
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {shopForm.bundleItems.map((bi, idx) => (
                  <div key={idx} className="flex items-stretch rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                    <input
                      type="number"
                      min={1}
                      placeholder="ID del item (ej: 49623)"
                      value={bi.id}
                      onChange={(e) => {
                        const next = [...shopForm.bundleItems];
                        next[idx].id = e.target.value;
                        setShopForm((p) => ({ ...p, bundleItems: next }));
                      }}
                      className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none"
                      required
                    />
                    <div className="w-24 border-l border-white/10 bg-white/5">
                      <input
                        type="number"
                        min={1}
                        title="Cantidad"
                        placeholder="Cant"
                        value={bi.count}
                        onChange={(e) => {
                          const next = [...shopForm.bundleItems];
                          next[idx].count = e.target.value;
                          setShopForm((p) => ({ ...p, bundleItems: next }));
                        }}
                        className="w-full h-full bg-transparent px-2 py-3 text-center text-gray-200 focus:outline-none"
                        required
                      />
                    </div>
                    {shopForm.bundleItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...shopForm.bundleItems];
                          next.splice(idx, 1);
                          setShopForm((p) => ({ ...p, bundleItems: next }));
                        }}
                        className="px-3 bg-rose-900/40 hover:bg-rose-600/70 text-rose-200"
                        title="Quitar item"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">Puedes agregar todas las piezas que necesites para el pack.</p>
            </div>
            <div className="md:col-span-2 rounded-xl border border-cyan-500/30 bg-cyan-900/10 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-cyan-300 font-black">Destino final del item</p>
              <p className="text-sm text-cyan-100 font-semibold">{selectedCategoryPath}</p>
            </div>
            <textarea className="md:col-span-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 min-h-[90px]" placeholder="Descripción" value={shopForm.description} onChange={(e) => setShopForm((p) => ({ ...p, description: e.target.value }))} />
            <button className="md:col-span-2 bg-gradient-to-r from-cyan-700 to-indigo-700 rounded-xl px-4 py-3 font-black flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Enviar Solicitud de Tienda</button>
          </form>
        )}

        {activeTab === 'addons' && (
          <form onSubmit={handleSubmitAddon} className="rounded-2xl border border-white/10 bg-[#0b1020] p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" placeholder="Nombre addon" value={addonForm.name} onChange={(e) => setAddonForm((p) => ({ ...p, name: e.target.value }))} required />
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" placeholder="URL addon" value={addonForm.url} onChange={(e) => setAddonForm((p) => ({ ...p, url: e.target.value }))} required />
            <button className="md:col-span-2 bg-gradient-to-r from-pink-700 to-rose-700 rounded-xl px-4 py-3 font-black flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Enviar Solicitud de Addon</button>
          </form>
        )}

        {activeTab === 'forum' && (
          <form onSubmit={handleSubmitForum} className="rounded-2xl border border-white/10 bg-[#0b1020] p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="md:col-span-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3" placeholder="Titulo del post" value={forumForm.title} onChange={(e) => setForumForm((p) => ({ ...p, title: e.target.value }))} required />
            <select
              className="bg-black/40 border border-amber-500/40 rounded-xl px-4 py-3"
              value={forumForm.characterName}
              onChange={(e) => setForumForm((p) => ({ ...p, characterName: e.target.value }))}
              required
            >
              {forumCharacters.length === 0 ? (
                <option value="">Sin personajes disponibles</option>
              ) : (
                forumCharacters.map((c) => <option key={c.guid} value={c.name}>{c.name} (lvl {c.level})</option>)
              )}
            </select>
            <select className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" value={forumForm.category} onChange={(e) => setForumForm((p) => ({ ...p, category: e.target.value }))}>
              {forumSections.map((s) => <option key={s.id} value={s.id}>{s.parent_id ? `↳ ${s.label}` : s.label}</option>)}
            </select>
            <div className="md:col-span-2 text-xs text-amber-300 flex items-center">Por seguridad, el post se publica con nombre de personaje (no con nombre de cuenta).</div>
            <textarea className="md:col-span-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 min-h-[120px]" placeholder="Mensaje" value={forumForm.comment} onChange={(e) => setForumForm((p) => ({ ...p, comment: e.target.value }))} required />
            <button disabled={!forumForm.characterName || forumCharacters.length === 0} className="md:col-span-2 bg-gradient-to-r from-purple-700 to-indigo-700 rounded-xl px-4 py-3 font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-4 h-4" /> Enviar Solicitud de Post</button>
          </form>
        )}
      </div>
    </main>
  );
}
