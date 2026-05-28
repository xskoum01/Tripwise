import { NextResponse } from "next/server";
import { searchTrips } from "@/lib/search/searchService";
import type { TravelSearchRequest } from "@/lib/search/types";

export async function POST(request: Request) {
  const isDevelopment = process.env.NODE_ENV !== "production";

  let body: (Partial<TravelSearchRequest> & { wish?: string }) | undefined;
  try {
    body = (await request.json()) as Partial<TravelSearchRequest> & { wish?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (isDevelopment) {
    console.info(`[api/search] POST wish="${(body.wish ?? "").slice(0, 60)}" maxBudget=${body.maxBudget ?? "n/a"} origins=${JSON.stringify(body.origins ?? [])}`);
  }

  try {
    const response = await searchTrips({ ...body, wish: body.wish ?? "" });

    if (isDevelopment) {
      console.info(
        `[api/search] done exact=${response.exactResults.length} relaxed=${response.relaxedResults.length} warnings=${response.providerWarnings.length}`,
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("[api/search] searchTrips threw:", details, isDevelopment ? stack : "");

    return NextResponse.json(
      {
        error: "Search request failed",
        ...(isDevelopment ? { details, stack } : {}),
      },
      { status: 500 },
    );
  }
}
