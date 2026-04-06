import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'account-avatars.json');
const avatarDir = path.join(process.cwd(), 'public', 'avatares');

type AvatarMap = Record<string, string>;

// ── In-memory cache (evita leer disco en cada request) ───────────────────────
let _avatarCache: AvatarMap | null = null;
let _avatarCacheAt = 0;
const CACHE_TTL_MS = 60_000; // 60 segundos

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, '{}', 'utf8');
  }
}

export async function readAvatarMap(): Promise<AvatarMap> {
  const now = Date.now();
  if (_avatarCache && now - _avatarCacheAt < CACHE_TTL_MS) return _avatarCache;
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  _avatarCache = JSON.parse(raw || '{}') as AvatarMap;
  _avatarCacheAt = now;
  return _avatarCache;
}

export async function writeAvatarMap(map: AvatarMap) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(map, null, 2), 'utf8');
  // Invalidate cache
  _avatarCache = map;
  _avatarCacheAt = Date.now();
}

export async function listAvailableAvatars() {
  const files = await fs.readdir(avatarDir);
  return files
    .filter((file) => /\.(gif|png|jpg|jpeg|webp)$/i.test(file))
    .sort((left, right) => left.localeCompare(right));
}
