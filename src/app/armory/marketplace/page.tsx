'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// ─── Class metadata ────────────────────────────────────────────────────────────
const CLASS_META: Record<number, { name: string; slug: string; color: string }> = {
  1:  { name: 'Guerrero',              slug: 'warrior',     color: '#C79C6E' },
  2:  { name: 'Paladín',               slug: 'paladin',     color: '#F58CBA' },
  3:  { name: 'Cazador',               slug: 'hunter',      color: '#ABD473' },
  4:  { name: 'Pícaro',                slug: 'rogue',       color: '#FFF569' },
  5:  { name: 'Sacerdote',             slug: 'priest',      color: '#FFFFFF' },
  6:  { name: 'Caballero de la Muerte',slug: 'deathknight', color: '#C41F3B' },
  7:  { name: 'Chamán',                slug: 'shaman',      color: '#0070DE' },
  8:  { name: 'Mago',                  slug: 'mage',        color: '#69CCF0' },
  9:  { name: 'Brujo',                 slug: 'warlock',     color: '#9482C9' },
  11: { name: 'Druida',                slug: 'druid',       color: '#FF7D0A' },
};

// ─── Race metadata ─────────────────────────────────────────────────────────────
const RACE_FACTION: Record<number, 'horde' | 'alliance'> = {
  1: 'alliance', 2: 'horde',   3: 'alliance', 4: 'alliance',
  5: 'horde',    6: 'horde',   7: 'alliance', 8: 'horde',
  10: 'horde',   11: 'alliance',
};

// ─── Race names ────────────────────────────────────────────────────────────────
const RACE_NAMES: Record<number, string> = {
  1: 'Humano', 2: 'Orco', 3: 'Enano', 4: 'Elfo de la Noche',
  5: 'No-Muerto', 6: 'Tauren', 7: 'Gnomo', 8: 'Troll',
  10: 'Elfo de Sangre', 11: 'Draenei',
};

// ─── Profession metadata ───────────────────────────────────────────────────────
const PROF_META: Record<number, { name: string; icon: string }> = {
  164: { name: 'Herrería',       icon: 'trade_blacksmithing' },
  165: { name: 'Peletería',      icon: 'inv_misc_leatherscrap_02' },
  171: { name: 'Alquimia',       icon: 'trade_alchemy' },
  182: { name: 'Herboristería',  icon: 'trade_herbalism' },
  186: { name: 'Minería',        icon: 'trade_mining' },
  197: { name: 'Sastrería',      icon: 'trade_tailoring' },
  202: { name: 'Ingeniería',     icon: 'trade_engineering' },
  333: { name: 'Encantamiento',  icon: 'trade_engraving' },
  393: { name: 'Desuello',       icon: 'inv_misc_pelt_wolf_01' },
  755: { name: 'Joyería',        icon: 'inv_misc_gem_01' },
  773: { name: 'Inscripción',    icon: 'inv_inscription_tradeskill01' },
  185: { name: 'Cocina',         icon: 'inv_misc_food_15' },
  129: { name: 'Primeros Aux.',  icon: 'spell_holy_sealofsacrifice' },
  356: { name: 'Pesca',          icon: 'trade_fishing' },
};

const equipSlots = [
  { slot: 0, label: 'Cabeza' },   { slot: 1, label: 'Cuello' },
  { slot: 2, label: 'Hombros' }, { slot: 3, label: 'Camisa' },
  { slot: 4, label: 'Pecho' },   { slot: 5, label: 'Cintura' },
  { slot: 6, label: 'Piernas' }, { slot: 7, label: 'Pies' },
  { slot: 8, label: 'Muñecas' }, { slot: 9, label: 'Manos' },
  { slot: 10, label: 'Dedo 1' }, { slot: 11, label: 'Dedo 2' },
  { slot: 12, label: 'Obj. 1' }, { slot: 13, label: 'Obj. 2' },
  { slot: 14, label: 'Espalda' },
  { slot: 15, label: 'Arma Ppal.' }, { slot: 16, label: 'Arma Sec.' }, { slot: 17, label: 'Rango' },
  { slot: 18, label: 'Tabardo' },
];
const leftSlots   = [0, 1, 2, 14, 4, 3, 18, 8];
const rightSlots  = [9, 5, 6, 7, 11, 10, 13, 12];
const bottomSlots = [15, 16, 17];

// ─── Small slot chip with Wowhead tooltip ─────────────────────────────────────
function ItemChip({ eq }: { eq: any }) {
  const isRealItem = eq && eq.itemEntry > 100;
  const content = (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] transition-colors ${isRealItem ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-blue-400 hover:text-blue-300' : 'bg-gray-900/50 border-gray-800 text-gray-500'}`}>
      <span className="opacity-60 text-[9px] uppercase">{isRealItem ? `[S${eq.slot}]` : 'SKIP'}</span>
      <span className="font-mono">{eq?.itemEntry || '??'}</span>
    </div>
  );

  if (!isRealItem) return content;

  return (
    <a
      href={`https://www.wowhead.com/wotlk/item=${eq.itemEntry}`}
      data-wowhead={`item=${eq.itemEntry}&domain=wotlk`}
      target="_blank"
      rel="noreferrer"
      className="block"
    >
      {content}
    </a>
  );
}

// ─── Inspect modal inner slot (paperdoll) ─────────────────────────────────────
function PaperSlot({ eq, label }: { eq?: any; label: string }) {
  const isRealItem = eq && eq.itemEntry > 100;

  const inner = (
    <div
      title={label}
      className={`w-12 h-12 rounded-lg border flex items-center justify-center transition-all duration-200 ${
        isRealItem
          ? 'border-blue-600/60 bg-blue-900/30 hover:border-blue-400 hover:bg-blue-900/50'
          : 'border-gray-700/40 bg-gray-900/30'
      }`}
    >
      {eq ? (
        <span className={`text-[9px] font-mono leading-tight text-center px-0.5 ${isRealItem ? 'text-blue-300' : 'text-gray-600'}`}>
          {eq.itemEntry}
        </span>
      ) : (
        <span className="text-[10px] text-gray-700 font-bold opacity-30">{label.substring(0, 2)}</span>
      )}
    </div>
  );

  if (isRealItem) {
    return (
      <a
        href={`https://www.wowhead.com/wotlk/item=${eq.itemEntry}`}
        data-wowhead={`item=${eq.itemEntry}&domain=wotlk`}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

// ─── Gold icon ─────────────────────────────────────────────────────────────────
const GoldIcon = () => (
  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="9"/>
    <text x="10" y="14" textAnchor="middle" fontSize="10" fill="#111" fontWeight="bold">G</text>
  </svg>
);

// ──────────────────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const router = useRouter();
  const [accountId, setAccountId]               = useState<number | null>(null);
  const [listings, setListings]                 = useState<any[]>([]);
  const [myChars, setMyChars]                   = useState<any[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [isModalOpen, setIsModalOpen]           = useState(false);
  const [sellPrice, setSellPrice]               = useState(10);
  const [selectedCharGuid, setSelectedCharGuid] = useState<number | null>(null);
  const [inspectItem, setInspectItem]           = useState<any>(null);
  const [filterFaction, setFilterFaction]       = useState('all');
  const [filterClass, setFilterClass]           = useState('all');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.id) setAccountId(Number(p.id));
      }
    } catch {}
    fetchMarket();
  }, []);

  useEffect(() => {
    if (accountId) fetchMyCharacters(accountId);
  }, [accountId]);

  const fetchMarket = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market');
      const d   = await res.json();
      setListings(Array.isArray(d) ? d : []);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchMyCharacters = async (id: number) => {
    try {
      const res = await fetch(`/api/characters?accountId=${id}`);
      const d   = await res.json();
      if (d.characters) setMyChars(d.characters);
    } catch {}
  };

  const handleSell = async () => {
    if (!selectedCharGuid || sellPrice <= 0 || !accountId) return alert('Selecciona un PJ y un precio válido.');
    try {
      const res = await fetch('/api/market/list', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guid: selectedCharGuid, priceDp: sellPrice, accountId }),
      });
      const d = await res.json();
      if (res.ok) { 
        alert('¡Listado exitosamente!'); 
        setIsModalOpen(false); 
        router.push('/dashboard'); 
      }
      else alert(`Error: ${d.error}`);
    } catch { alert('Error de conexión'); }
  };

  const handleBuy = async (listingId: number, price: number) => {
    if (!accountId) return;
    if (!confirm(`¿Pagar ${price} DP por este personaje?`)) return;
    try {
      const res = await fetch('/api/market/buy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, accountId }),
      });
      const d = await res.json();
      if (res.ok) { 
        alert('¡Héroe transferido!'); 
        router.push('/dashboard'); 
      }
      else alert(`Error: ${d.error}`);
    } catch { alert('Error contacting server'); }
  };

  const handleCancel = async (listingId: number) => {
    if (!accountId || !confirm('¿Cancelar la venta?')) return;
    try {
      const res = await fetch('/api/market/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, accountId }),
      });
      const d = await res.json();
      if (res.ok) { alert('PJ recuperado.'); fetchMarket(); fetchMyCharacters(accountId!); }
      else alert(d.error);
    } catch { alert('Error'); }
  };

  const filteredListings = useMemo(() => {
    const H = [2, 5, 6, 8, 10];
    const A = [1, 3, 4, 7, 11];
    return listings.filter(item => {
      if (filterFaction === 'horde'    && !H.includes(item.char.raceId)) return false;
      if (filterFaction === 'alliance' && !A.includes(item.char.raceId)) return false;
      if (filterClass !== 'all' && String(item.char.classId) !== filterClass) return false;
      return true;
    });
  }, [listings, filterFaction, filterClass]);

  return (
    <>
      <Script id="wh-settings" strategy="beforeInteractive">
        {`var whTooltips = {colorLinks: true, iconizeLinks: true, renameLinks: true};`}
      </Script>
      <Script src="https://wow.zamimg.com/js/tooltips.js" strategy="afterInteractive" />

      <div className="min-h-screen bg-[url('/fono.png')] bg-cover bg-fixed font-sans text-gray-200">
        <Header />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

          {/* TITLE */}
          <div className="text-center mb-10 sm:mb-12">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 uppercase tracking-wide sm:tracking-widest drop-shadow-2xl mb-3 sm:mb-4 leading-tight">
              Tienda oscura
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-gray-300 font-light max-w-2xl mx-auto px-2">
              El mercado negro - Intercambia personajes por puntos de donacion
            </p>
          </div>

          {/* PUBLISH BUTTON */}
          <div className="flex justify-center sm:justify-end mb-8">
            {accountId ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-800 hover:from-green-500 hover:to-emerald-700 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:scale-105 active:scale-95"
              >
                ⚖️ Publicar Personaje
              </button>
            ) : (
              <p className="text-yellow-400 text-sm">Inicia sesión para interactuar con el mercado.</p>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-8">

            {/* ── SIDEBAR ── */}
            <aside className="w-full lg:w-60 flex-shrink-0">
              <div className="sticky top-20 bg-black/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
                <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                  <span className="text-yellow-400">⚙</span> Filtros
                </h3>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Facción</label>
                    <div className="flex gap-2">
                      {[
                        { val: 'all',      label: 'Todas',   icon: null },
                        { val: 'horde',    label: 'Horda',    icon: '/faccion/horde.png' },
                        { val: 'alliance', label: 'Alianza',  icon: '/faccion/alianza.png' },
                      ].map(f => (
                        <button
                          key={f.val}
                          onClick={() => setFilterFaction(f.val)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex flex-col items-center gap-1 ${
                            filterFaction === f.val
                              ? 'bg-yellow-600/30 border-yellow-500 text-yellow-300'
                              : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          {f.icon && (
                            <Image src={f.icon} width={20} height={20} alt={f.label} className="w-5 h-5 object-contain" />
                          )}
                          {!f.icon && <span className="h-5 flex items-center">⚔</span>}
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Clase</label>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                      <button
                        onClick={() => setFilterClass('all')}
                        className={`col-span-4 sm:col-span-5 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterClass === 'all' ? 'bg-yellow-600/30 border-yellow-500 text-yellow-300' : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                      >
                        Todas las clases
                      </button>
                      {Object.entries(CLASS_META).map(([id, cls]) => (
                        <button
                          key={id}
                          onClick={() => setFilterClass(id)}
                          title={cls.name}
                          className={`rounded-lg overflow-hidden border-2 transition-all ${filterClass === id ? 'border-yellow-400 scale-110' : 'border-transparent opacity-70 hover:opacity-100 hover:border-gray-500'}`}
                        >
                          <Image
                            src={`/clases/${cls.slug}.png`}
                            alt={cls.name}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 text-center">
                    <span className="text-xs text-gray-500">{filteredListings.length} personaje{filteredListings.length !== 1 && 's'}</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── GRID ── */}
            <div className="flex-grow">
              {loading ? (
                <div className="flex justify-center py-24">
                  <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-yellow-500" />
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-24 text-gray-500 bg-black/30 rounded-2xl">
                  El mercado negro está vacío.
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="text-center py-24 text-gray-500 bg-black/30 rounded-2xl">
                  Sin resultados para estos filtros.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredListings.map(item => {
                    const cls     = CLASS_META[item.char.classId] ?? { name: item.char.className, slug: 'warrior', color: '#aaa' };
                    const faction = RACE_FACTION[item.char.raceId];
                    const hasProfessions = item.char.professions && item.char.professions.length > 0;

                    return (
                      <div
                        key={item.id}
                        className="relative flex flex-col rounded-2xl overflow-hidden bg-black/50 backdrop-blur-md border border-white/10 hover:border-yellow-500/40 transition-all duration-300 hover:shadow-[0_0_40px_rgba(202,138,4,0.15)] hover:-translate-y-1"
                      >
                        {/* Price Tag (Moved to top-left to avoid overlap) */}
                        <div className="absolute top-0 left-0 z-20 flex items-center gap-2 bg-gradient-to-br from-yellow-600 to-yellow-900 px-4 py-2 rounded-br-2xl border-r border-b border-yellow-400/30 shadow-2xl">
                          <span className="font-black text-white text-xl leading-none drop-shadow-md">{item.priceDp}</span>
                          <span className="text-[10px] text-yellow-100 font-bold uppercase tracking-widest">PUNTOS DE DONACIÓN</span>
                        </div>

                        {/* Faction band */}
                        <div className={`h-1 w-full ${faction === 'horde' ? 'bg-gradient-to-r from-red-700 to-red-500' : 'bg-gradient-to-r from-blue-700 to-blue-500'}`} />

                        {/* Header Area (Expanded padding to prevent icon overlap) */}
                        <div className="pt-24 pb-4 px-5 flex items-center gap-4">
                          {/* Class avatar */}
                          <div
                            className="relative h-16 w-16 rounded-full flex-shrink-0 overflow-hidden border-2"
                            style={{ borderColor: cls.color + '80' }}
                          >
                            <Image
                              src={`/clases/${cls.slug}.png`}
                              alt={cls.name}
                              fill
                              className="object-cover"
                            />
                            <div
                              className="absolute inset-0 rounded-full"
                              style={{ boxShadow: `inset 0 0 12px ${cls.color}55` }}
                            />
                          </div>

                          <div className="min-w-0 flex-grow">
                            <div className="flex items-center justify-between mb-0.5 relative">
                              <h3 className="text-lg font-black text-white truncate pr-14">{item.char.name}</h3>
                              <div className={`absolute -top-20 -right-3 p-2.5 rounded-2xl border-2 shadow-2xl transition-all hover:scale-110 active:rotate-3 ${faction === 'horde' ? 'bg-red-950/90 border-red-500/60 shadow-red-900/40' : 'bg-blue-950/90 border-blue-500/60 shadow-blue-900/40'}`}>
                                  <Image
                                    src={`/faccion/${faction === 'horde' ? 'horda' : 'alianza'}.png`}
                                    width={48}
                                  height={48}
                                  alt={faction}
                                  className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                />
                              </div>
                            </div>
                            <p className="text-sm font-semibold" style={{ color: cls.color }}>
                              {cls.name}
                            </p>
                            <p className="text-xs text-gray-400">{item.char.raceName} • Nv {item.char.level}</p>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="px-5 pb-3 flex-grow border-t border-white/5 space-y-1.5">
                          <div className="flex justify-between text-sm pt-3">
                            <span className="text-gray-500">Honor</span>
                            <span className="font-mono text-white">{(item.char.honorPoints || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Arena</span>
                            <span className="font-mono text-orange-400">{(item.char.arenaPoints || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Publicado</span>
                            <span className="text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>

                          {/* Professions badge */}
                          <div className="flex items-center gap-2 pt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${hasProfessions ? 'border-emerald-700 bg-emerald-900/30 text-emerald-400' : 'border-gray-700 bg-gray-900/30 text-gray-600'}`}>
                              {hasProfessions ? `✓ ${item.char.professions.length} Prof.` : '✗ Sin profesiones'}
                            </span>
                            {item.char.equippedItems && item.char.equippedItems.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full border border-blue-700 bg-blue-900/30 text-blue-400 font-semibold">
                                ⚔ {item.char.equippedItems.length} items
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inspect + Buy */}
                        <div className="px-5 pb-5 pt-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setInspectItem(item)}
                            className="py-2.5 rounded-xl text-sm font-bold border border-cyan-700/50 bg-cyan-900/20 text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-500 transition-all"
                          >
                            👁️ Inspeccionar
                          </button>

                          {accountId && String(accountId) === String(item.sellerAccountId) ? (
                            <button
                              onClick={() => handleCancel(item.id)}
                              className="py-2.5 rounded-xl text-sm font-bold border border-red-700/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-all"
                            >
                              ✕ Cancelar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBuy(item.id, item.priceDp)}
                              disabled={!accountId}
                              className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                                accountId
                                  ? 'bg-gradient-to-r from-yellow-700 to-orange-700 hover:from-yellow-600 hover:to-orange-600 border-yellow-600/50 text-white shadow-lg'
                                  : 'bg-gray-800 text-gray-600 cursor-not-allowed border-gray-700'
                              }`}
                            >
                              Comprar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ══════════════════════════════════════════════════════════════
            INSPECT MODAL  — paperdoll + 3D model viewer
        ══════════════════════════════════════════════════════════════ */}
        {inspectItem && (() => {
          const cls         = CLASS_META[inspectItem.char.classId] ?? { name: inspectItem.char.className, slug: 'warrior', color: '#aaa' };
          const faction     = RACE_FACTION[inspectItem.char.raceId];
          const professions = inspectItem.char.professions ?? [];
          const equipped    = inspectItem.char.equippedItems ?? [];

          return (
            <div
              className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/95 backdrop-blur-lg overflow-y-auto"
              onClick={e => { if (e.target === e.currentTarget) setInspectItem(null); }}
            >
              <div className="bg-[#08080f] border border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-5xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden mb-10">

                {/* ── Top bar ── */}
                <div
                  className="relative h-20 sm:h-24 flex items-end px-4 sm:px-8 pb-4"
                  style={{ background: `linear-gradient(135deg, ${cls.color}22, transparent), linear-gradient(to bottom, #111, #08080f)` }}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${faction === 'horde' ? 'bg-gradient-to-r from-red-700 to-red-500' : 'bg-gradient-to-r from-blue-700 to-blue-500'}`} />

                  {/* Class icon */}
                  <div className="relative h-12 w-12 sm:h-16 sm:w-16 rounded-full overflow-hidden border-2 flex-shrink-0 mr-3 sm:mr-4" style={{ borderColor: cls.color }}>
                    <Image src={`/clases/${cls.slug}.png`} alt={cls.name} fill className="object-cover" />
                  </div>

                  <div className="flex-grow">
                    <h2 className="text-xl sm:text-3xl font-black text-white leading-tight truncate">{inspectItem.char.name}</h2>
                    <p className="text-xs sm:text-sm font-bold truncate" style={{ color: cls.color }}>
                      {cls.name} · Nivel {inspectItem.char.level} · {inspectItem.char.raceName}
                    </p>
                  </div>

                  <button
                    onClick={() => setInspectItem(null)}
                    className="absolute top-4 right-5 text-gray-500 hover:text-white text-3xl leading-none transition-colors"
                  >
                    &times;
                  </button>
                </div>

                {/* ── Body ── */}
                <div className="grid lg:grid-cols-[1fr_320px] divide-y lg:divide-y-0 lg:divide-x divide-white/10">

                  {/* Left: 3D Viewer + paperdoll */}
                  <div className="p-4 sm:p-6 space-y-6">

                    {/* ── Character Showcase (CSS 3D) ── */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-yellow-500">◆</span> Vitrina del Personaje
                      </h4>
                      <div
                        className="relative rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center h-[250px] sm:h-[320px]"
                        style={{
                          background: `radial-gradient(ellipse at center, ${cls.color}18 0%, #000 70%)`,
                        }}
                      >
                        {/* Animated rings */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {[1, 2, 3].map(i => (
                            <div
                              key={i}
                              className="absolute rounded-full border opacity-20"
                              style={{
                                width:  `${100 + i * 60}px`,
                                height: `${100 + i * 60}px`,
                                borderColor: cls.color,
                                animation: `showcase-spin ${8 + i * 4}s linear infinite ${i % 2 === 0 ? 'reverse' : ''}`,
                              }}
                            />
                          ))}
                        </div>

                        {/* Particle dots */}
                        {[...Array(12)].map((_, k) => (
                          <div
                            key={k}
                            className="absolute w-1 h-1 rounded-full opacity-40"
                            style={{
                              backgroundColor: cls.color,
                              top:  `${15 + Math.sin(k * 30 * Math.PI / 180) * 38 + 38}%`,
                              left: `${15 + Math.cos(k * 30 * Math.PI / 180) * 38 + 38}%`,
                              animation: `showcase-pulse ${1.5 + (k % 3) * 0.5}s ease-in-out infinite alternate`,
                              animationDelay: `${k * 0.15}s`,
                            }}
                          />
                        ))}

                        {/* Main class image, floating */}
                        <div
                          className="relative z-10"
                          style={{
                            animation: 'showcase-float 4s ease-in-out infinite',
                            filter: `drop-shadow(0 0 32px ${cls.color}88)`,
                          }}
                        >
                          <Image
                            src={`/clases/${cls.slug}.png`}
                            alt={cls.name}
                            width={200}
                            height={200}
                            className="object-contain"
                          />
                        </div>

                        {/* Class name overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-center bg-gradient-to-t from-black/80 to-transparent">
                          <p className="font-black text-2xl" style={{ color: cls.color, textShadow: `0 0 20px ${cls.color}` }}>
                            {cls.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {inspectItem.char.raceName} · Nivel {inspectItem.char.level}
                          </p>
                        </div>

                        {/* Large Faction badge overlay */}
                        <div className={`absolute top-3 left-3 sm:top-4 sm:left-4 p-2.5 sm:p-3 rounded-2xl shadow-2xl transition-all hover:scale-110 flex items-center gap-2 sm:gap-4 border-2 ${faction === 'horde' ? 'bg-red-950/80 border-red-500/60 shadow-red-900/50 text-red-100' : 'bg-blue-950/80 border-blue-500/60 shadow-blue-900/50 text-blue-100'}`}>
                          <Image
                            src={`/faccion/${faction === 'horde' ? 'horda' : 'alianza'}.png`}
                            width={64}
                            height={64}
                            alt={faction}
                            className="w-10 h-10 sm:w-16 sm:h-16 object-contain drop-shadow-[0_0_12px_rgba(0,0,0,0.6)]"
                          />
                          <div className="flex flex-col leading-none">
                            <span className="text-[9px] sm:text-[10px] font-bold opacity-60 tracking-widest">FACCIÓN</span>
                            <span className="font-black text-sm sm:text-xl tracking-tighter">{faction === 'horde' ? 'HORDA' : 'ALIANZA'}</span>
                          </div>
                        </div>
                      </div>
                      <style dangerouslySetInnerHTML={{ __html: `
                        @keyframes showcase-float {
                          0%, 100% { transform: translateY(0px) scale(1); }
                          50%       { transform: translateY(-12px) scale(1.03); }
                        }
                        @keyframes showcase-spin {
                          from { transform: rotate(0deg); }
                          to   { transform: rotate(360deg); }
                        }
                        @keyframes showcase-pulse {
                          from { opacity: 0.2; transform: scale(0.8); }
                          to   { opacity: 0.8; transform: scale(1.4); }
                        }
                      ` }} />
                    </div>

                    {/* ── Paperdoll ── */}
                    {equipped.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="text-blue-400">◆</span> Equipamiento ({equipped.length} piezas)
                        </h4>
                        <div className="space-y-1">
                          {leftSlots.map((leftId, i) => {
                            const rightId   = rightSlots[i];
                            const leftInfo  = equipSlots.find(s => s.slot === leftId)!;
                            const rightInfo = equipSlots.find(s => s.slot === rightId)!;
                            const leftEq    = equipped.find((e: any) => e.slot === leftId);
                            const rightEq   = equipped.find((e: any) => e.slot === rightId);
                            return (
                              <div key={leftId} className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 flex-1 justify-end">
                                  <span className="text-[10px] text-gray-600 w-14 text-right truncate">{leftInfo.label}</span>
                                  <PaperSlot eq={leftEq} label={leftInfo.label} />
                                </div>
                                <div className="w-px h-8 bg-white/10 flex-shrink-0" />
                                <div className="flex items-center gap-1.5 flex-1">
                                  <PaperSlot eq={rightEq} label={rightInfo.label} />
                                  <span className="text-[10px] text-gray-600 w-14 truncate">{rightInfo.label}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Weapons row */}
                        <div className="flex justify-center gap-3 mt-3">
                          {bottomSlots.map(slotId => {
                            const info = equipSlots.find(s => s.slot === slotId)!;
                            const eq   = equipped.find((e: any) => e.slot === slotId);
                            return (
                              <div key={slotId} className="flex flex-col items-center gap-1">
                                <PaperSlot eq={eq} label={info.label} />
                                <span className="text-[9px] text-gray-600">{info.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {equipped.length === 0 && (
                      <p className="text-center text-gray-600 text-sm py-4">Sin equipo registrado en el snapshot.</p>
                    )}
                  </div>

                  {/* Right panel: stats + professions */}
                  <div className="p-4 sm:p-6 space-y-6">
                    {/* Stats */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-green-400">◆</span> Estadísticas
                      </h4>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Nivel',      val: inspectItem.char.level,                          color: 'text-white' },
                          { label: 'Honor',      val: (inspectItem.char.honorPoints || 0).toLocaleString(), color: 'text-purple-300' },
                          { label: 'Arena',      val: (inspectItem.char.arenaPoints || 0).toLocaleString(), color: 'text-orange-400' },
                          { label: 'Oro aprox.', val: inspectItem.char.moneyGold + ' g',                color: 'text-yellow-400' },
                          { label: 'Precio',     val: inspectItem.priceDp + ' DP',                     color: 'text-yellow-300 font-black text-base' },
                        ].map(r => (
                          <div key={r.label} className="flex justify-between items-center py-1 border-b border-white/5">
                            <span className="text-gray-500">{r.label}</span>
                            <span className={`font-mono ${r.color}`}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Professions */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-emerald-400">◆</span> Profesiones
                      </h4>
                      {professions.length === 0 ? (
                        <p className="text-gray-600 text-sm">Este personaje no tiene profesiones.</p>
                      ) : (
                        <div className="space-y-2">
                          {professions.map((p: any) => {
                            const meta = PROF_META[p.skill];
                            const pct  = Math.round((p.value / (p.max || 450)) * 100);
                            return (
                              <div key={p.skill}>
                                <div className="flex items-center gap-2 mb-1">
                                  {meta && (
                                    <img
                                      src={`https://wow.zamimg.com/images/wow/icons/small/${meta.icon}.jpg`}
                                      alt={meta.name}
                                      className="w-5 h-5 rounded border border-gray-700"
                                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}
                                  <span className="text-xs text-emerald-300 font-semibold flex-grow">{meta?.name ?? `Habilidad ${p.skill}`}</span>
                                  <span className="text-xs text-gray-400 font-mono">{p.value}/{p.max}</span>
                                </div>
                                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Quick item links */}
                    {equipped.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="text-blue-400">◆</span> Links de equipo
                        </h4>
                        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                          {equipped.map((eq: any) => <ItemChip key={eq.slot} eq={eq} />)}
                        </div>
                      </div>
                    )}

                    {/* Buy CTA */}
                    <div className="pt-2">
                      {accountId && String(accountId) === String(inspectItem.sellerAccountId) ? (
                        <button
                          onClick={() => { handleCancel(inspectItem.id); setInspectItem(null); }}
                          className="w-full py-3 rounded-xl font-bold border border-red-700/60 bg-red-900/20 text-red-300 hover:bg-red-900/40 transition-all"
                        >
                          ✕ Cancelar Venta
                        </button>
                      ) : (
                        <button
                          onClick={() => { handleBuy(inspectItem.id, inspectItem.priceDp); setInspectItem(null); }}
                          disabled={!accountId}
                          className={`w-full py-3 sm:py-4 rounded-xl font-black text-sm sm:text-base uppercase tracking-wider transition-all ${
                            accountId
                              ? 'bg-gradient-to-r from-yellow-600 to-orange-700 hover:from-yellow-500 hover:to-orange-600 text-white shadow-[0_0_20px_rgba(234,179,8,0.35)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] hover:scale-105'
                              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          }`}
                        >
                          {accountId ? `Comprar por ${inspectItem.priceDp} DP` : 'Inicia sesión para comprar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            SELL MODAL
        ══════════════════════════════════════════════════════════════ */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="px-4 sm:px-6 py-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="text-lg sm:text-xl font-bold text-white">Publicar Personaje</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-xl">&times;</button>
              </div>
              <div className="p-4 sm:p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Selecciona un Campeón</label>
                  <select
                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-500"
                    onChange={e => setSelectedCharGuid(Number(e.target.value))}
                    value={selectedCharGuid || ''}
                  >
                    <option value="" disabled>-- Elige con cuidado --</option>
                    {myChars.map(c => (
                      <option key={c.guid} value={c.guid}>[Nv {c.level}] {c.name}</option>
                    ))}
                  </select>
                  {myChars.length === 0 && (
                    <p className="text-xs text-red-400 mt-2">No se encontraron personajes en tu cuenta.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Precio en DP</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-yellow-600 font-bold text-sm">DP</span>
                    <input
                      type="number" min="1"
                      className="w-full bg-black border border-gray-700 rounded-lg py-3 pl-10 pr-3 text-white font-mono focus:outline-none focus:border-yellow-500"
                      value={sellPrice}
                      onChange={e => setSellPrice(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="bg-red-900/20 border border-red-800/30 p-4 rounded-lg">
                  <p className="text-xs text-red-200">
                    <strong className="block mb-1">⚠️ AVISO</strong>
                    Tu personaje será movido a la bóveda de retención. Dejarás de verlo hasta que canceles o alguien lo compre.
                  </p>
                </div>
                <button
                  onClick={handleSell}
                  className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-700 hover:from-yellow-500 hover:to-orange-600 text-white font-bold rounded-xl uppercase tracking-wider shadow-lg transition-transform hover:scale-105 active:scale-95"
                >
                  Publicar en el Mercado Negro
                </button>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </>
  );
}
