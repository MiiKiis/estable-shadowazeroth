// API route for news management
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const NEWS_PATH = path.join(process.cwd(), 'data', 'news.json');

export async function GET() {
  try {
    const data = await fs.readFile(NEWS_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const news = await request.json();
  await fs.writeFile(NEWS_PATH, JSON.stringify(news, null, 2));
  return NextResponse.json({ success: true });
}
