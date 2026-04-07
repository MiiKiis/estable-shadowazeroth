import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface Addon { name: string; url: string; }

const ADDONS_PATH = path.join(process.cwd(), 'data', 'addons.json');

async function readAddons(): Promise<Addon[]> {
  try {
    const raw = await fs.readFile(ADDONS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAddons(addons: Addon[]): Promise<void> {
  await fs.mkdir(path.dirname(ADDONS_PATH), { recursive: true });
  await fs.writeFile(ADDONS_PATH, JSON.stringify(addons, null, 2), 'utf-8');
}

export async function GET() {
  return NextResponse.json(await readAddons());
}

export async function POST(request: Request) {
  const { name, url } = await request.json();
  const cleanName = String(name || '').trim();
  const cleanUrl = String(url || '').trim();
  if (!cleanName || !cleanUrl) {
    return NextResponse.json({ error: 'Nombre y URL son obligatorios' }, { status: 400 });
  }

  const addons = await readAddons();
  addons.push({ name: cleanName, url: cleanUrl });
  await writeAddons(addons);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { index } = await request.json();
  const idx = Number(index);
  const addons = await readAddons();
  if (!Number.isInteger(idx) || idx < 0 || idx >= addons.length) {
    return NextResponse.json({ error: 'Indice invalido' }, { status: 400 });
  }
  addons.splice(idx, 1);
  await writeAddons(addons);
  return NextResponse.json({ success: true });
}
