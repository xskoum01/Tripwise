import { NextResponse } from "next/server";
import { searchTrips } from "@/lib/search/searchService";
import type { TravelSearchRequest } from "@/lib/search/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<TravelSearchRequest> & { wish?: string };
    const response = await searchTrips({ ...body, wish: body.wish ?? "" });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Search request failed" }, { status: 400 });
  }
}
