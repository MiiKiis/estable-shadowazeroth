import React, { useEffect, useState } from 'react';

// Tipo para los items del kit
interface KitItem {
  entry: number;
  name: string;
  icon: string;
}

interface KitItemListProps {
  kitId: number;
}

const getIconUrl = (icon: string) =>
  `https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`;

export const KitItemList: React.FC<KitItemListProps> = ({ kitId }) => {
  const [items, setItems] = useState<KitItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/shop/kits?kitId=${kitId}`)
      .then((res) => res.json().catch(() => ({ items: [] })))
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      });
  }, [kitId]);

  if (loading) return <div>Cargando items del kit...</div>;
  if (!items.length) return <div>Este kit no contiene items.</div>;

  return (
    <div className="kit-items-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {items.map((item) => (
        <div key={item.entry} style={{ textAlign: 'center', width: 90 }}>
          <a
            href={`https://wotlk.wowhead.com/item=${item.entry}`}
            target="_blank"
            rel="noopener noreferrer"
            data-wowhead={`item=${item.entry}`}
          >
            <img
              src={getIconUrl(item.icon)}
              alt={item.name}
              style={{ width: 48, height: 48, borderRadius: 6, border: '1px solid #333' }}
            />
            <div style={{ fontSize: 12, marginTop: 4 }}>{item.name}</div>
          </a>
        </div>
      ))}
      {/* Wowhead tooltips */}
      <script src="https://wow.zamimg.com/widgets/power.js"></script>
    </div>
  );
};

export default KitItemList;
