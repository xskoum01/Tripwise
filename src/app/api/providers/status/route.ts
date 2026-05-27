import { NextResponse } from "next/server";
import { getProviderStatuses } from "@/lib/providers/status";

export async function GET() {
  return NextResponse.json({ providers: getProviderStatuses() });
}
