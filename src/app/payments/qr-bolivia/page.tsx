"use client";

import { useEffect, useState } from 'react';

export default function QrBoliviaPage() {
  const [data, setData] = useState<{ imageUrl: string; instructions: string }>({ imageUrl: '', instructions: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/payments/qr-bolivia')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white pt-32 pb-20">
      <div className="max-w-lg w-full bg-black/60 rounded-2xl p-8 border border-green-400/30 shadow-lg text-center">
        <h1 className="text-3xl font-black mb-6 text-green-300">Pago QR Bolivia</h1>
        {loading ? (
          <div className="w-12 h-12 border-4 border-green-900 border-t-green-400 rounded-full animate-spin mx-auto mb-6" />
        ) : (
          <>
            {data.imageUrl ? (
              <img src={data.imageUrl} alt="QR Bolivia" className="mx-auto mb-6 w-64 h-64 object-contain rounded-xl border border-green-400/40" />
            ) : (
              <div className="mb-6 text-gray-400">No hay QR disponible actualmente.</div>
            )}
            <div className="text-green-200 text-lg mb-4">{data.instructions || 'Solicita el QR actualizado al staff.'}</div>
            <div className="text-gray-400 text-sm">El QR puede caducar, asegúrate de usar el más reciente.</div>
          </>
        )}
      </div>
    </main>
  );
}
