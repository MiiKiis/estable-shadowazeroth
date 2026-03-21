import { useState } from 'react';

const CATEGORIES = [
  { id: 'pve', label: 'PvE (Tiers)' },
  { id: 'pvp', label: 'PvP' },
  { id: 'profesiones', label: 'PROFESIONES' },
  { id: 'monturas', label: 'Monturas y Mascotas' },
  { id: 'transmo', label: 'Transfiguración' },
  { id: 'oro', label: 'Oro' },
  { id: 'boost', label: 'Subida de Nivel' },
  { id: 'misc', label: 'Otros' },
];

const TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const CLASSES = [
  { id: 1, name: 'Guerrero', color: '#C79C6E' },
  { id: 2, name: 'Paladín', color: '#F58CBA' },
  { id: 3, name: 'Cazador', color: '#ABD473' },
  { id: 4, name: 'Pícaro', color: '#FFF569' },
  { id: 5, name: 'Sacerdote', color: '#FFFFFF' },
  { id: 6, name: 'Caballero de la Muerte', color: '#C41F3B' },
  { id: 7, name: 'Chamán', color: '#0070DE' },
  { id: 8, name: 'Mago', color: '#69CCF0' },
  { id: 9, name: 'Brujo', color: '#9482C9' },
  { id: 11, name: 'Druida', color: '#FF7D0A' },
];


type ShopFiltersProps = {
  onFilter: (filter: { category: string | null; tier: number | null; classId: number | null }) => void;
};

export default function ShopFilters({ onFilter }: ShopFiltersProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<number | null>(null);
  const [activeClass, setActiveClass] = useState<number | null>(null);

  // Resetear dependientes al cambiar categoría o tier
  const handleCategory = (cat: string) => {
    setActiveCategory(cat);
    setActiveTier(null);
    setActiveClass(null);
    onFilter({ category: cat, tier: null, classId: null });
  };
  const handleTier = (tier: number) => {
    setActiveTier(tier);
    setActiveClass(null);
    onFilter({ category: activeCategory, tier, classId: null });
  };
  const handleClass = (classId: number) => {
    setActiveClass(classId);
    onFilter({ category: activeCategory, tier: activeTier, classId });
  };

  return (
    <div className="space-y-4">
      {/* Categoría */}
      <div className="flex flex-wrap gap-2 mb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCategory(cat.id)}
            className={`px-4 py-2 rounded-xl font-bold border-2 transition-all
              ${activeCategory === cat.id
                ? 'bg-purple-800 border-purple-400 text-white shadow-[0_0_10px_#a855f7]'
                : 'bg-black/40 border-purple-900/40 text-gray-400 hover:text-white hover:border-purple-700'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Tiers solo si PvE */}
      {activeCategory === 'pve' && (
        <div className="flex flex-wrap gap-2 mb-2">
          {TIERS.map(tier => (
            <button
              key={tier}
              onClick={() => handleTier(tier)}
              className={`px-4 py-2 rounded-xl font-bold border-2 transition-all
                ${activeTier === tier
                  ? 'bg-yellow-700 border-yellow-400 text-white shadow-[0_0_10px_#facc15]'
                  : 'bg-black/40 border-yellow-900/40 text-yellow-300 hover:text-white hover:border-yellow-500'}`}
            >
              Tier {tier}
            </button>
          ))}
        </div>
      )}

      {/* Clases solo si hay Tier */}
      {activeCategory === 'pve' && activeTier && (
        <div className="flex flex-wrap gap-2 mb-2">
          {CLASSES.map(cls => (
            <button
              key={cls.id}
              onClick={() => handleClass(cls.id)}
              style={{ borderColor: cls.color, color: activeClass === cls.id ? '#fff' : cls.color }}
              className={`px-3 py-1.5 rounded-xl font-bold border-2 transition-all
                ${activeClass === cls.id
                  ? 'bg-black/80 shadow-[0_0_8px_currentColor]'
                  : 'bg-black/30 hover:bg-black/50 hover:border-white/50'}`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
