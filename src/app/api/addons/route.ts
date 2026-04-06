// API route for temporary addons
import { NextResponse } from 'next/server';

interface Addon { name: string; url: string; }

const addons: Addon[] = [];

export async function GET() {
  return NextResponse.json(addons);
}

export async function POST(request: Request) {
  const { name, url } = await request.json();
  addons.push({ name, url });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { index } = await request.json();
  addons.splice(index, 1);
  return NextResponse.json({ success: true });
}
