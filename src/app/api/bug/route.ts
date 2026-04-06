import {NextResponse} from "next/server";
import {authPool} from "@/lib/db";

export async function GET() {
  if (!authPool) {
    return NextResponse.json({ error: 'Database pool not available' }, { status: 500 });
  }
  try {
    const [a] = await authPool.query('SHOW CREATE TABLE account_access');
    return NextResponse.json({ account_access: a });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
