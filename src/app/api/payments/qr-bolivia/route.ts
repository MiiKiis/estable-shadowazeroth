// API route for QR Bolivia payment method
import { NextResponse } from 'next/server';

let qrBoliviaData = {
  imageUrl: '',
  instructions: '',
};

export async function GET() {
  return NextResponse.json(qrBoliviaData);
}

export async function POST(request: Request) {
  const { imageUrl, instructions } = await request.json();
  qrBoliviaData = { imageUrl, instructions };
  return NextResponse.json({ success: true });
}
