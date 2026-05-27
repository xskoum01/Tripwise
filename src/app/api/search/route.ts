import { NextResponse } from "next/server";
import { searchTrips } from "@/lib/search/searchService";
import type { TravelSearchRequest } from "@/lib/search/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<TravelSearchRequest> & { wish?: string };
    const response = await searchTrips({ ...body, wish: body.wish ?? "" });
    return NextResponse.json(response);
  } catch (error) {
    const isDevelopment = process.env.NODE_ENV !== "production";
    const details = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;

    if (isDevelopment) {
      console.error("Search request failed", error);
    }

    return NextResponse.json(
      {
        error: "Search request failed",
        ...(isDevelopment ? { details, stack } : {}),
      },
      { status: 500 },
    );
  }
}
