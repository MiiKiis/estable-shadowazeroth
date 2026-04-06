'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Lock, Pencil, ShieldCheck } from 'lucide-react';

interface User {
  id: number;
  username: string;
}

export default function AvatarPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [avatars, setAvatars] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [editableAlways, setEditableAlways] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const loadAvatars = async () => {
      try {
        const response = await fetch(`/api/avatar?accountId=${parsedUser.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo cargar la galeria');
        }

        setAvatars(data.avatars || []);
        setSelectedAvatar(data.selectedAvatar || null);
        setLocked(!!data.locked);
        setEditableAlways(!!data.editableAlways);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadAvatars();
  }, [router]);

  const saveAvatar = async (avatarFile: string): Promise<boolean> => {
    if (!user || saving || (locked && !editableAlways)) {
      return false;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: user.id, avatar: avatarFile }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar el avatar');
      }

      setSelectedAvatar(data.selectedAvatar || avatarFile);
      setLocked(!!data.locked);
      setEditableAlways(!!data.editableAlways);
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAvatar = (avatarFile: string) => {
    if (saving || (locked && !editableAlways)) {
      return;
    }
    setPendingAvatar(avatarFile);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1220] via-[#101828] to-[#06080f] text-white">
        <div className="w-16 h-16 border-4 border-white/15 border-t-cyan-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-4 py-20 md:px-6 md:py-24 text-white font-sans overflow-hidden bg-gradient-to-br from-[#0b1220] via-[#0f1a2d] to-[#0a0f1c]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.16),transparent_42%),radial-gradient(circle_at_88%_82%,rgba(45,212,191,0.1),transparent_38%)]" />
      <div className="relative max-w-6xl mx-auto">
        <div className="rounded-[28px] border border-white/20 bg-white/8 backdrop-blur-xl shadow-[0_24px_80px_rgba(3,8,20,0.55)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-[760px]">
            <aside className="border-r border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] p-6 md:p-8">
              <div className="rounded-2xl border border-white/15 bg-[#0d1629]/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400 font-bold mb-3">Perfil</p>
                <div className="rounded-2xl border border-white/15 bg-[#070d1a] p-5 flex items-center justify-center h-[220px]">
                  {selectedAvatar ? (
                    <div className="relative h-28 w-28 rounded-full overflow-hidden border-4 border-cyan-200/80 shadow-[0_0_25px_rgba(125,211,252,0.35)] bg-black">
                      <Image 
                        src={`/avatares/${selectedAvatar}`} 
                        alt={selectedAvatar} 
                        fill
                        className="object-contain" 
                      />
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 font-semibold uppercase tracking-[0.12em] text-xs">Sin avatar seleccionado</div>
                  )}
                </div>
                <div className="mt-5 rounded-xl border border-white/10 bg-[#0a1222] p-5 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold">Cuenta</p>
                    <p className="text-3xl font-extrabold uppercase tracking-tight">{user?.username}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold">Estado</p>
                    <div className="flex items-center gap-2 mt-1">
                      {editableAlways ? <Pencil className="w-4 h-4 text-emerald-300" /> : <Lock className="w-4 h-4 text-amber-300" />}
                      <p className="text-sm font-semibold text-slate-200 leading-relaxed">
                        {editableAlways ? 'Edicion permanente' : locked ? 'Bloqueado tras elegir' : 'Disponible para elegir'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold">Modo</p>
                    <div className="flex items-center gap-2 mt-1 text-cyan-300/90">
                      <ShieldCheck className="w-4 h-4" />
                      <p className="text-sm font-semibold">Panel de seleccion</p>
                    </div>
                  </div>
                </div>
                {error && (
                  <div className="mt-4 rounded-xl border border-rose-300/40 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-200">
                    {error}
                  </div>
                )}
                <Link
                  href="/dashboard"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver al panel
                </Link>
              </div>
            </aside>

            <section className="bg-gradient-to-b from-white/[0.03] to-transparent p-6 md:p-8 lg:p-10">
              <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-5 mb-6">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">Seleccion de avatares</h1>
                <p className="text-sm text-slate-300 mt-2">
                  Elige una miniatura de la galeria. En pantallas pequenas el grid se adapta automaticamente.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-[#081122]/80 p-4 md:p-5 h-[640px] overflow-y-auto">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
                  {avatars.map((avatarFile) => {
                    const isSelected = selectedAvatar === avatarFile;
                    const isDisabled = saving || (locked && !editableAlways);

                    return (
                      <button
                        key={avatarFile}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectAvatar(avatarFile)}
                        className={`group relative rounded-2xl border p-2 text-center transition-all duration-200 ${isSelected ? 'border-cyan-300 bg-cyan-300/10 shadow-[0_0_18px_rgba(125,211,252,0.3)]' : 'border-white/15 bg-white/[0.03] hover:border-cyan-200/60 hover:bg-white/[0.06]'} ${isDisabled && !editableAlways ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="relative mx-auto h-16 w-16 md:h-18 md:w-18 overflow-hidden rounded-full border-2 border-white/20 bg-black">
                          <Image 
                            src={`/avatares/${avatarFile}`} 
                            alt={avatarFile} 
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-200" 
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-300 truncate">{avatarFile}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {pendingAvatar && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="absolute inset-0 bg-[#050814]/80 backdrop-blur-sm" onClick={() => setPendingAvatar(null)} aria-hidden="true" />
          <div className="relative my-auto w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-[#0b1426]/95 p-6 text-center shadow-[0_16px_60px_rgba(0,0,0,0.95)]">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar avatar</h3>
            <div
              className="relative mx-auto rounded-full overflow-hidden border-4 border-cyan-300 mb-5 bg-black"
              style={{ width: 96, height: 96, minWidth: 96, minHeight: 96, maxWidth: 96, maxHeight: 96 }}
            >
              <Image
                src={`/avatares/${pendingAvatar}`}
                alt={pendingAvatar}
                fill
                className="object-contain"
              />
            </div>
            <p className="text-sm text-slate-300 font-medium mb-6">Estas seguro de elegir este avatar?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15 font-semibold"
                onClick={() => setPendingAvatar(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-3 rounded-xl border border-cyan-200/40 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30 font-semibold"
                onClick={async () => {
                  const target = pendingAvatar;
                  setPendingAvatar(null);
                  if (target) {
                    const saved = await saveAvatar(target);
                    if (saved) {
                      router.push('/dashboard');
                    }
                  }
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
