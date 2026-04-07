'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Trash2, Clock3 } from 'lucide-react';

type Submission = {
  id: number;
  submission_type: 'shop' | 'addon' | 'forum';
  status: 'pending' | 'approved' | 'rejected';
  payload: any;
  created_by: number;
  created_at: string;
};

const FALLBACK_IMG = '/logo-shadow.png';

function getShopImage(payload: any): string {
  const raw = String(payload?.image || payload?.icon || '').trim();
  if (!raw) return FALLBACK_IMG;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(raw)) return `/${raw.replace(/^\/+/, '')}`;
  return `https://wow.zamimg.com/images/wow/icons/large/${raw.toLowerCase()}.jpg`;
}

function PreviewBlock({ submission }: { submission: Submission }) {
  const payload = submission.payload || {};

  if (submission.submission_type === 'shop') {
    const priceDp = Number(payload.price_dp || 0);
    const priceVp = Number(payload.price_vp || 0);
    const image = getShopImage(payload);

    return (
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-900/10 p-3">
        <p className="text-[11px] uppercase tracking-wider text-cyan-300 font-black mb-2">Previsualizacion de item</p>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="w-full md:w-36 shrink-0">
            <div className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={String(payload.name || 'item')}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                }}
              />
            </div>
          </div>
          <div className="flex-1 space-y-2 text-sm">
            <p className="text-white font-black text-base leading-tight">{String(payload.name || 'Sin nombre')}</p>
            {!!payload.description && <p className="text-gray-300 text-xs leading-relaxed">{String(payload.description)}</p>}
            <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-wider">
              {priceDp > 0 && <span className="px-2 py-1 rounded-md border border-amber-400/40 bg-amber-500/10 text-amber-300">{priceDp} DP</span>}
              {priceVp > 0 && <span className="px-2 py-1 rounded-md border border-violet-400/40 bg-violet-500/10 text-violet-300">{priceVp} VP</span>}
              {!!payload.category_slug && <span className="px-2 py-1 rounded-md border border-white/15 bg-white/5 text-gray-300">{String(payload.category_slug)}</span>}
              {!!payload.item_id && <span className="px-2 py-1 rounded-md border border-white/15 bg-white/5 text-gray-300">Item ID: {String(payload.item_id)}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submission.submission_type === 'addon') {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-3">
        <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-black mb-1">Previsualizacion de addon</p>
        <p className="text-white font-black">{String(payload.title || payload.name || 'Sin titulo')}</p>
        {!!payload.description && <p className="text-xs text-gray-300 mt-1">{String(payload.description)}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-900/10 p-3">
      <p className="text-[11px] uppercase tracking-wider text-fuchsia-300 font-black mb-1">Previsualizacion de post foro</p>
      <p className="text-white font-black">{String(payload.title || 'Sin titulo')}</p>
      {!!payload.characterName && <p className="text-xs text-amber-300 mt-1">Publicado como PJ: {String(payload.characterName)}</p>}
      {!!payload.comment && <p className="text-xs text-gray-300 mt-1 line-clamp-4">{String(payload.comment)}</p>}
      {!!payload.category && <p className="text-[11px] text-gray-400 mt-1">Categoria: {String(payload.category)}</p>}
    </div>
  );
}

export default function AdminR1Requests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [items, setItems] = useState<Submission[]>([]);
  const [confirmRejectId, setConfirmRejectId] = useState<number | null>(null);

  const getUserId = () => {
    try {
      const raw = localStorage.getItem('user');
      const u = raw ? JSON.parse(raw) : null;
      return Number(u?.id || 0);
    } catch {
      return 0;
    }
  };

  const load = async () => {
    const userId = getUserId();
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/r1/submissions?userId=${userId}&status=pending`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar solicitudes');
      setItems(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (err: any) {
      setError(err.message || 'Error cargando solicitudes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const process = async (submissionId: number, action: 'approve' | 'reject') => {
    const userId = getUserId();
    if (!userId) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/r1/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, submissionId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo procesar');
      setSuccess(data.message || 'Procesado correctamente');
      setConfirmRejectId(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Error procesando solicitud');
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 text-white space-y-6">
      <div className="flex items-center gap-2 text-cyan-300 font-black text-2xl">
        <Clock3 className="w-7 h-7" /> Solicitudes GM R1 para publicar
      </div>

      {(error || success) && (
        <div className={`rounded-xl px-4 py-3 border font-bold ${error ? 'border-rose-500/40 bg-rose-900/20 text-rose-300' : 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300'}`}>
          {error || success}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400">Cargando solicitudes...</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-gray-400 font-bold uppercase tracking-wider text-xs">No hay solicitudes pendientes.</div>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-[#090d18] p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-black">#{s.id} · {s.submission_type.toUpperCase()} · GM {s.created_by}</p>
                  <p className="text-sm text-gray-500">{new Date(s.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => process(s.id, 'approve')}
                    className="px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-black uppercase tracking-wider"
                  >
                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Publicar</span>
                  </button>

                  <button
                    onClick={() => setConfirmRejectId(s.id)}
                    className="px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-black uppercase tracking-wider"
                  >
                    <span className="inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Eliminar</span>
                  </button>
                </div>
              </div>

              <PreviewBlock submission={s} />

              <details className="text-xs bg-black/40 border border-white/5 rounded-xl p-3 text-cyan-100">
                <summary className="cursor-pointer text-gray-300 font-black uppercase tracking-wider">Ver detalle tecnico (JSON)</summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(s.payload || {}, null, 2)}
                </pre>
              </details>

              {confirmRejectId === s.id && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex flex-wrap items-center gap-2">
                  <p className="text-amber-200 text-xs font-black uppercase tracking-wider">Confirmar eliminación de solicitud</p>
                  <button onClick={() => process(s.id, 'reject')} className="px-3 py-1.5 rounded-lg bg-amber-500/30 border border-amber-400/60 text-amber-100 text-xs font-black uppercase">Si, eliminar</button>
                  <button onClick={() => setConfirmRejectId(null)} className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/15 text-gray-300 text-xs font-black uppercase">No, cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
