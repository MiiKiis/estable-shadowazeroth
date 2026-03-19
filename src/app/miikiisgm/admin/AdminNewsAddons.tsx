"use client";
import { useEffect, useState } from 'react';
import { Newspaper, Trash2, Puzzle, ExternalLink, PlusCircle } from 'lucide-react';

export default function AdminNewsAddons({ show = 'news' }: { show?: 'news' | 'addons' }) {
  // Noticias
  const [news, setNews] = useState<{ title: string; content: string }[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  // Addons
  const [addons, setAddons] = useState<{ name: string; url: string }[]>([]);
  const [addonName, setAddonName] = useState('');
  const [addonUrl, setAddonUrl] = useState('');

  // Load data
  useEffect(() => {
    fetch('/api/news').then(res => res.json()).then(setNews).catch(() => setNews([]));
    fetch('/api/addons').then(res => res.json()).then(setAddons).catch(() => setAddons([]));
  }, []);

  // Add news
  const handleAddNews = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    const updated = [{ title: newTitle.trim(), content: newContent.trim() }, ...news];
    await fetch('/api/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    setNews(updated);
    setNewTitle('');
    setNewContent('');
  };

  // Add addon
  const handleAddAddon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addonName.trim() || !addonUrl.trim()) return;
    const body = { name: addonName.trim(), url: addonUrl.trim() };
    await fetch('/api/addons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setAddons([...addons, body]);
    setAddonName('');
    setAddonUrl('');
  };

  // Delete addon
  const handleDeleteAddon = async (idx: number) => {
    await fetch('/api/addons', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: idx }) });
    setAddons(addons.filter((_, i) => i !== idx));
  };

  // Delete news
  const handleDeleteNews = async (idx: number) => {
    const updated = news.filter((_, i) => i !== idx);
    await fetch('/api/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    setNews(updated);
  };

  return (
    <div className="max-w-4xl mx-auto py-10 text-white">
      {show === 'news' && (
        <>
          <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
            <Newspaper className="w-8 h-8 text-cyan-400" /> Gestión de Noticias
          </h2>
          <form onSubmit={handleAddNews} className="mb-10 bg-black/40 border border-white/10 p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Título de la noticia</label>
              <input 
                className="bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all" 
                placeholder="Ej: Nuevo evento de Arena" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)} 
                required 
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contenido (Markdown soportado)</label>
              <textarea 
                className="bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white min-h-[120px] focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all" 
                placeholder="Cuéntanos las novedades..." 
                value={newContent} 
                onChange={e => setNewContent(e.target.value)} 
                required 
              />
            </div>
            <button className="bg-gradient-to-r from-purple-700 to-cyan-700 hover:from-purple-600 hover:to-cyan-600 text-white font-black px-8 py-3 rounded-xl transition-all shadow-lg self-start flex items-center gap-2" type="submit">
              <PlusCircle className="w-4 h-4" /> Publicar noticia
            </button>
          </form>
          <div className="space-y-4">
            {news.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No hay noticias publicadas aún.</p>
            ) : (
              news.map((n, i) => (
                <div key={i} className="group relative bg-[#0a0a1a] border border-white/5 p-6 rounded-2xl hover:border-cyan-500/30 transition-all shadow-lg">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-black text-xl text-cyan-100 group-hover:text-cyan-300 transition-colors">{n.title}</h3>
                    <button 
                      onClick={() => handleDeleteNews(i)}
                      className="p-2 rounded-lg bg-rose-900/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {show === 'addons' && (
        <>
          <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
            <Puzzle className="w-8 h-8 text-pink-400" /> Gestión de Addons
          </h2>
          <form onSubmit={handleAddAddon} className="mb-10 bg-black/40 border border-white/10 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre del addon</label>
              <input 
                className="bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/50 transition-all" 
                placeholder="Ej: QuestHelper" 
                value={addonName} 
                onChange={e => setAddonName(e.target.value)} 
                required 
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">URL de descarga</label>
              <input 
                className="bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/50 transition-all" 
                placeholder="https://..." 
                value={addonUrl} 
                onChange={e => setAddonUrl(e.target.value)} 
                required 
              />
            </div>
            <button className="md:col-span-2 bg-gradient-to-r from-pink-700 to-rose-700 hover:from-pink-600 hover:to-rose-600 text-white font-black px-8 py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2" type="submit">
              <PlusCircle className="w-4 h-4" /> Agregar addon
            </button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addons.length === 0 ? (
              <p className="sm:col-span-2 text-gray-500 italic text-center py-8">No hay addons registrados.</p>
            ) : (
              addons.map((a, i) => (
                <div key={i} className="group relative bg-[#0a0a1a] border border-white/5 p-5 rounded-2xl hover:border-pink-500/30 transition-all shadow-lg flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-pink-100 group-hover:text-pink-300 transition-colors truncate">{a.name}</p>
                    <a href={a.url} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 truncate">
                      <ExternalLink className="w-3 h-3" /> Ver enlace
                    </a>
                  </div>
                  <button 
                    onClick={() => handleDeleteAddon(i)}
                    className="p-2 rounded-lg bg-rose-900/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

