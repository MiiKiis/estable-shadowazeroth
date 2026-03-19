'use client';

import { useEffect, useState } from 'react';
import { Flame, Newspaper } from 'lucide-react';

export default function NewsPage() {
  const [news, setNews] = useState<{ id: number; title: string; content: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        setNews(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <main 
      className="min-h-screen pt-32 pb-20 text-white selection:bg-purple-600/30 font-sans relative overflow-hidden"
      style={{
        backgroundImage: "url('/fono.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <Flame className="w-8 h-8 text-purple-500 animate-pulse" />
          <h1 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">NOTICIAS</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-purple-900 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-20 bg-black/40 border border-purple-900/30 rounded-2xl backdrop-blur-md">
            <Newspaper className="w-16 h-16 text-purple-900 mx-auto mb-4" />
            <p className="text-xl font-black text-gray-400 uppercase tracking-widest">No hay noticias publicadas</p>
          </div>
        ) : (
          <div className="space-y-12">
            {news.map((n) => (
            <section key={n.id} className="p-8 bg-black/40 border border-purple-900/30 rounded-sm backdrop-blur-md group hover:border-purple-600/40 transition-all shadow-[0_0_40px_rgba(105,55,180,0.2)]">
              <div className="text-purple-600 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{formatDate(n.created_at)}</div>
              <h2 className="text-2xl font-black italic text-gray-100 group-hover:text-purple-500 transition-colors mb-4">{n.title}</h2>
              <div 
                className="space-y-4 text-gray-400 leading-relaxed font-light prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: n.content }}
              />
            </section>
          ))}
        </div>
        )}
      </div>
    </main>
  );
}
