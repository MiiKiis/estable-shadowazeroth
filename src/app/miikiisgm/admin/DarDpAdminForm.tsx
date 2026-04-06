'use client';

import { useState } from 'react';
import { Coins, Search, CheckCircle, AlertTriangle, Send, User, RotateCcw } from 'lucide-react';

interface FoundAccount {
  id: number;
  username: string;
  dp: number;
  vp: number;
}

export default function DarDpAdminForm() {
  const [searchQuery, setSearchQuery] = useState('');
  const [foundAccount, setFoundAccount] = useState<FoundAccount | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'dp' | 'vp'>('dp');
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [sendError, setSendError] = useState('');

  // ── Buscar cuenta ─────────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError('');
    setFoundAccount(null);
    setSuccessMsg('');
    setSendError('');

    try {
      const res = await fetch(`/api/admin/search-account?username=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se encontró la cuenta.');
      setFoundAccount(data.account);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error buscando la cuenta.';
      setSearchError(errorMsg);
    } finally {
      setSearching(false);
    }
  };

  // ── Enviar DP ─────────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundAccount || !amount || Number(amount) <= 0) {
      setSendError('Ingresa una cantidad válida de DP.');
      return;
    }

    setSending(true);
    setSendError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/admin/give-dp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: foundAccount.username,
          amount: Number(amount),
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al entregar puntos.');

      const currencyName = currency === 'dp' ? 'DP' : 'VP';
      const newAmount = foundAccount[currency] + Number(amount);

      setSuccessMsg(`✅ ${amount} ${currencyName} entregados correctamente a ${foundAccount.username}. Ahora tiene ${newAmount} ${currencyName}.`);
      setFoundAccount(prev => prev ? { ...prev, [currency]: newAmount } : null);
      setAmount('');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error de conexión.';
      setSendError(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setFoundAccount(null);
    setSearchQuery('');
    setAmount('');
    setSuccessMsg('');
    setSendError('');
    setSearchError('');
  };

  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-[#060a13]/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Header */}
      <div className={`px-8 py-6 border-b flex items-center gap-3 transition-colors ${currency === 'vp' ? 'bg-gradient-to-r from-violet-900/40 to-purple-900/30 border-violet-500/20' : 'bg-gradient-to-r from-yellow-900/40 to-orange-900/30 border-yellow-500/20'}`}>
        <Coins className={`w-8 h-8 ${currency === 'vp' ? 'text-violet-400' : 'text-yellow-400'}`} />
        <div>
          <h2 className="text-2xl font-black text-white">Entregar {currency === 'dp' ? 'Donation Points' : 'Estelas'}</h2>
          <p className={`${currency === 'vp' ? 'text-violet-200/50' : 'text-yellow-200/50'} text-sm mt-0.5`}>Busca la cuenta y asigna puntos manualmente</p>
        </div>
      </div>

      <div className="p-8 space-y-8">

        {/* PASO 1 – Buscar cuenta */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Paso 1 — Buscar cuenta por nombre de usuario
          </p>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Ej: MiikiisGM"
                className="w-full bg-black/50 border border-purple-500/30 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {searchError && (
            <div className="mt-3 flex items-center gap-2 text-rose-300 text-sm bg-rose-900/20 px-4 py-3 rounded-xl border border-rose-500/30">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {searchError}
            </div>
          )}
        </div>

        {/* Cuenta encontrada */}
        {foundAccount && (
          <>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-6 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-900/50 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="font-black text-white text-lg">{foundAccount.username}</p>
                <div className="flex gap-4 mt-1 text-sm">
                  <span className="text-yellow-400 font-semibold">{foundAccount.dp} DP</span>
                  <span className="text-purple-300 font-semibold">{foundAccount.vp} VP</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-gray-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                title="Cambiar cuenta"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* PASO 2 – Moneda, Cantidad y enviar */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                Paso 2 — Moneda y Cantidad a entregar
              </p>
              
              <div className="flex gap-4 mb-6">
                <label className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${currency === 'dp' ? 'border-yellow-500 bg-yellow-900/20 text-yellow-400' : 'border-gray-800 bg-gray-900/50 text-gray-500 hover:border-gray-700 hover:text-gray-300'}`}>
                  <input type="radio" name="currency" value="dp" checked={currency === 'dp'} onChange={() => setCurrency('dp')} className="sr-only" />
                  <Coins className="w-5 h-5" />
                  <span className="font-bold">Donation Points</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${currency === 'vp' ? 'border-violet-500 bg-violet-900/20 text-violet-400' : 'border-gray-800 bg-gray-900/50 text-gray-500 hover:border-gray-700 hover:text-gray-300'}`}>
                  <input type="radio" name="currency" value="vp" checked={currency === 'vp'} onChange={() => setCurrency('vp')} className="sr-only" />
                  <Coins className="w-5 h-5" />
                  <span className="font-bold">Estelas</span>
                </label>
              </div>

              <form onSubmit={handleSend} className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Coins className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${currency === 'vp' ? 'text-violet-500' : 'text-yellow-500'}`} />
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="Ej: 100"
                      min="1"
                      className={`w-full bg-black/50 border rounded-xl pl-11 pr-4 py-3 text-white text-lg font-bold placeholder:text-gray-600 focus:outline-none focus:ring-2 ${currency === 'vp' ? 'border-violet-500/30 focus:ring-violet-400/50' : 'border-yellow-500/30 focus:ring-yellow-400/50'}`}
                    />
                  </div>

                  {/* Accesos rápidos */}
                  {[10, 50, 100, 200].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAmount(String(n))}
                      className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all ${currency === 'vp' ? 'border-violet-500/20 text-violet-300 hover:bg-violet-900/30' : 'border-yellow-500/20 text-yellow-300 hover:bg-yellow-900/30'}`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>

                {sendError && (
                  <div className="flex items-center gap-2 text-rose-300 text-sm bg-rose-900/20 px-4 py-3 rounded-xl border border-rose-500/30">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {sendError}
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-center gap-2 text-green-300 text-sm bg-green-900/20 px-4 py-3 rounded-xl border border-green-500/30">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending || !amount || Number(amount) <= 0}
                  className={`w-full py-4 rounded-xl font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white ${
                    currency === 'vp'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-[0_4px_20px_rgba(139,92,246,0.35)] hover:scale-[1.01]'
                      : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-black shadow-[0_4px_20px_rgba(234,179,8,0.35)] hover:scale-[1.01]'
                  }`}
                >
                  <Send className={`w-5 h-5 ${currency === 'dp' && 'text-black'}`} />
                  {sending ? 'Enviando...' : `Enviar ${amount || '0'} ${currency === 'dp' ? 'DP' : 'VP'} a ${foundAccount.username}`}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
