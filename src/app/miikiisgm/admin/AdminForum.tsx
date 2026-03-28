'use client';

import { useState, useRef } from 'react';
import { 
  Send, Bold, Italic, Underline, AlignCenter, 
  Image as ImageIcon, Type, Palette, MessageSquare, Pin
} from 'lucide-react';

export default function AdminForum() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('announcements');
  const [comment, setComment] = useState('');
  const [pinned, setPinned] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const CATEGORIES = [
    { id: 'announcements', label: 'Anuncios'},
    { id: 'support', label: 'Soporte'},
    { id: 'guides', label: 'Guías'},
    { id: 'reports', label: 'Denuncias'},
    { id: 'suggestions', label: 'Sugerencias'},
  ];

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
    setComment(newText);
    
    // Reposition cursor
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + openTag.length + selected.length, start + openTag.length + selected.length);
    }, 0);
  };

  const insertPromptTag = (tag: string, promptText: string) => {
    const val = window.prompt(promptText);
    if (!val) return;
    if (tag === 'img') insertBBCode(`[img]${val}[/img]`, '');
    if (tag === 'color') insertBBCode(`[color=${val}]`, '[/color]');
    if (tag === 'size') insertBBCode(`[size=${val}px]`, '[/size]');
    if (tag === 'font') insertBBCode(`[font=${val}]`, '[/font]');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !comment.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }

    let user;
    try {
      const stored = localStorage.getItem('user');
      user = stored ? JSON.parse(stored) : null;
    } catch {}

    if (!user || (!user.id && user.id !== 0)) {
      setError('No se pudo encontrar tu sesión de usuario.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: title.trim(),
          category,
          comment: comment.trim(),
          pinned
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error al crear tema');
      
      setSuccess('¡El tema ha sido publicado exitosamente en el foro!');
      setTitle('');
      setComment('');
      setCategory('announcements');
      setPinned(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-purple-500/20 bg-[#060a13]/75 backdrop-blur-xl p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <h2 className="text-xl font-black flex items-center gap-2 mb-6 text-purple-300">
          <MessageSquare className="w-5 h-5 text-purple-400" /> Nuevo Post en el Foro
        </h2>

        {success && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-900/20 text-emerald-300 font-bold">
            {success}
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-900/20 text-rose-300 font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Título del Tema</label>
              <input 
                type="text" 
                maxLength={200}
                placeholder="Título de la publicación..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-5 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/60 transition-all font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Categoría</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/60 transition-all cursor-pointer font-bold"
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-xs uppercase tracking-wider ${
                pinned 
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Pin className={`w-4 h-4 ${pinned ? 'fill-amber-300' : ''}`} />
              {pinned ? 'Tema Fijado' : 'Fijar Tema'}
            </button>
            <p className="text-[10px] text-gray-500 italic">
              * Los temas fijados aparecerán al principio de la lista en el foro.
            </p>
          </div>

          <div className="bg-[#03060d]/60 border border-purple-500/20 rounded-2xl overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="border-b border-purple-500/20 bg-purple-900/10 p-2 flex flex-wrap gap-1">
              <button type="button" onClick={() => insertBBCode('[b]', '[/b]')} className="p-2 hover:bg-purple-900/40 rounded-lg text-gray-300 hover:text-white transition-colors" title="Negrita"><Bold className="w-4 h-4" /></button>
              <button type="button" onClick={() => insertBBCode('[i]', '[/i]')} className="p-2 hover:bg-purple-900/40 rounded-lg text-gray-300 hover:text-white transition-colors" title="Cursiva"><Italic className="w-4 h-4" /></button>
              <button type="button" onClick={() => insertBBCode('[u]', '[/u]')} className="p-2 hover:bg-purple-900/40 rounded-lg text-gray-300 hover:text-white transition-colors" title="Subrayado"><Underline className="w-4 h-4" /></button>
              <div className="w-px h-6 bg-purple-500/20 mx-1 self-center" />
              <button type="button" onClick={() => insertBBCode('[center]', '[/center]')} className="p-2 hover:bg-purple-900/40 rounded-lg text-gray-300 hover:text-white transition-colors" title="Centrar"><AlignCenter className="w-4 h-4" /></button>
              <div className="w-px h-6 bg-purple-500/20 mx-1 self-center" />
              <button type="button" onClick={() => insertPromptTag('color', 'Introduce color hex (ej: #ff0000 o red):')} className="p-2 hover:bg-purple-900/40 rounded-lg text-cyan-300 hover:text-cyan-200 transition-colors" title="Color de Texto"><Palette className="w-4 h-4" /></button>
              <button type="button" onClick={() => insertPromptTag('size', 'Introduce tamaño numérico en px (ej: 24):')} className="p-2 hover:bg-purple-900/40 rounded-lg text-cyan-300 hover:text-cyan-200 transition-colors" title="Tamaño de Fuente"><Type className="w-4 h-4" /></button>
              <button type="button" onClick={() => insertPromptTag('img', 'Introduce URL de la imagen:')} className="p-2 hover:bg-purple-900/40 rounded-lg text-fuchsia-400 hover:text-fuchsia-300 transition-colors" title="Insertar Imagen"><ImageIcon className="w-4 h-4" /></button>
            </div>
            
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={12}
              placeholder="Contenido del área de texto. Usa los botones superiores para añadir estilos."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full bg-transparent px-5 py-4 text-white placeholder:text-gray-500 focus:outline-none resize-y text-[15px] font-mono leading-relaxed"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-[0_8px_24px_rgba(91,33,182,0.4)] ${
                loading
                  ? 'bg-purple-800/50 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600'
              }`}
            >
              <Send className="w-4 h-4" />
              {loading ? 'PUBLICANDO...' : 'PUBLICAR EN EL FORO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
