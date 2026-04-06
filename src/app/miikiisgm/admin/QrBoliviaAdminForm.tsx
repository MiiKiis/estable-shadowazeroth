"use client";
import { useState, useEffect } from 'react';
import { CreditCard, Link as LinkIcon, Building2, UserCircle, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';

export default function QrBoliviaAdminForm() {
  const [formData, setFormData] = useState({
    imageUrl: '',
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    accountType: '',
    whatsappUrl: '',
    instructions: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/payments/qr-bolivia')
      .then(async (res) => {
        const data = await res.json();
        setFormData({
          imageUrl: data.imageUrl || '',
          bankName: data.bankName || '',
          accountHolder: data.accountHolder || '',
          accountNumber: data.accountNumber || '',
          accountType: data.accountType || '',
          whatsappUrl: data.whatsappUrl || '',
          instructions: data.instructions || '',
        });
      })
      .finally(() => setFetching(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      const res = await fetch('/api/payments/qr-bolivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar configuración');
      setSuccess('Datos del QR y Transferencia actualizados correctamente');
      
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="text-center py-8 text-green-300 animate-pulse">Cargando datos actuales...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
      <div className="bg-black/40 border border-green-500/20 p-6 rounded-2xl space-y-6">
        <h3 className="text-sm font-black text-green-400 uppercase tracking-widest border-b border-green-500/20 pb-2 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> Imagen QR de Pago
        </h3>
        <div>
          <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Enlace / URL de la Imagen QR *</label>
          <input
            type="text"
            name="imageUrl"
            className="w-full bg-[#1a1a1a] border border-green-500/30 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-400/60 transition-all"
            placeholder="https://i.imgur.com/tuCodigoQR.png"
            value={formData.imageUrl}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="bg-black/40 border border-cyan-500/20 p-6 rounded-2xl space-y-6">
        <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Datos de Transferencia Manual (Alternativa)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Nombre del Banco</label>
            <input
              type="text"
              name="bankName"
              className="w-full bg-[#1a1a1a] border border-cyan-500/30 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all"
              placeholder="Ej: Banco Mercantil Santa Cruz"
              value={formData.bankName}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Titular de la Cuenta</label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
              <input
                type="text"
                name="accountHolder"
                className="w-full bg-[#1a1a1a] border border-cyan-500/30 rounded-xl pl-10 pr-4 py-3 text-white text-sm font-medium placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all"
                placeholder="Ej: Juan Perez"
                value={formData.accountHolder}
                onChange={handleChange}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Número de Cuenta</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
              <input
                type="text"
                name="accountNumber"
                className="w-full bg-[#1a1a1a] border border-cyan-500/30 rounded-xl pl-10 pr-4 py-3 text-white text-sm font-medium placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all font-mono"
                placeholder="Ej: 406080..."
                value={formData.accountNumber}
                onChange={handleChange}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Tipo de Cuenta</label>
            <input
              type="text"
              name="accountType"
              className="w-full bg-[#1a1a1a] border border-cyan-500/30 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all"
              placeholder="Ej: Caja de Ahorro"
              value={formData.accountType}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className="bg-black/40 border border-purple-500/20 p-6 rounded-2xl space-y-6">
        <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest border-b border-purple-500/20 pb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Instrucciones Adicionales
        </h3>
        
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Mensaje para el Donador</label>
            <textarea
              name="instructions"
              className="w-full bg-[#1a1a1a] border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400/60 transition-all resize-y min-h-[100px]"
              placeholder="Escribe instrucciones o detalles extra para quienes usen este método de pago..."
              value={formData.instructions}
              onChange={handleChange}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Enlace de Confirmación (WhatsApp / Soporte)</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
              <input
                type="text"
                name="whatsappUrl"
                className="w-full bg-[#1a1a1a] border border-emerald-500/30 rounded-xl pl-10 pr-4 py-3 text-white text-sm font-medium placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 transition-all"
                placeholder="Ej: https://wa.me/591..."
                value={formData.whatsappUrl}
                onChange={handleChange}
              />
              <p className="text-[10px] text-gray-500 mt-1 italic">
                Enlace donde el usuario debe enviar el recibo de pago para que sea validado.
              </p>
            </div>
          </div>
        </div>
      </div>

      {success && (
        <div className="w-full text-center text-sm font-bold text-green-400 bg-green-900/20 border border-green-500/30 rounded-xl py-3 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> {success}
        </div>
      )}
      
      {error && (
        <div className="w-full text-center text-sm font-bold text-rose-400 bg-rose-900/20 border border-rose-500/30 rounded-xl py-3 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className={`px-8 py-3.5 rounded-xl font-black text-sm transition-all shadow-[0_4px_20px_rgba(52,211,153,0.2)] ${
            loading 
              ? 'bg-green-700/70 animate-pulse cursor-not-allowed' 
              : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white'
          }`}
        >
          {loading ? 'Guardando Cambios...' : 'Guardar Configuración'}
        </button>
      </div>
    </form>
  );
}