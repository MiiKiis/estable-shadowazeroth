"use client";
import { useState } from 'react';
export default function QrBoliviaAdminForm() {
  const [imageUrl, setImageUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      const res = await fetch('/api/payments/qr-bolivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, instructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar QR');
      setSuccess('QR actualizado correctamente');
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-4">
      <div className="w-full">
        <label className="block text-lg font-bold text-green-200 mb-2">URL de imagen QR</label>
        <input
          type="text"
          className="w-full bg-[#1a1a1a] border-2 border-green-400 rounded-xl px-4 py-3 text-white text-lg font-bold placeholder:text-green-100 focus:outline-none focus:ring-2 focus:ring-green-300"
          placeholder="https://..."
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          required
        />
      </div>
      <div className="w-full">
        <label className="block text-lg font-bold text-green-200 mb-2">Instrucciones</label>
        <textarea
          className="w-full bg-[#1a1a1a] border-2 border-green-400 rounded-xl px-4 py-3 text-white text-lg font-bold placeholder:text-green-100 focus:outline-none focus:ring-2 focus:ring-green-300"
          placeholder="Escribe instrucciones para el pago QR..."
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={3}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className={`w-full max-w-xs py-4 rounded-2xl font-black text-2xl transition-all mt-2 flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(67,160,71,0.18)] ${loading ? 'bg-green-700/70 animate-pulse cursor-not-allowed' : 'bg-gradient-to-r from-green-400 via-green-300 to-purple-700 hover:from-green-300 hover:to-purple-600 text-black'}`}
      >
        {loading ? 'Guardando...' : 'Actualizar QR'}
      </button>
      {success && <div className="w-full text-center text-2xl font-bold text-green-400 mt-4 bg-green-900/20 rounded-xl py-2">{success}</div>}
      {error && <div className="w-full text-center text-2xl font-bold text-rose-400 mt-4 bg-rose-900/20 rounded-xl py-2">{error}</div>}
    </form>
  );
}