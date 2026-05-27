import type { ItineraryOption, LinkType, TravelSource } from "./types";

type ProviderLinkInput = Pick<ItineraryOption, "dates" | "destinationAirportCode" | "origin" | "source" | "sourceUrl"> &
  Partial<Pick<ItineraryOption, "isReturn" | "passengers">>;
type ProviderSearchLinkInput = ProviderLinkInput & { destinationAirportCode: string };

export type ProviderLink = {
  url: string;
  linkType: LinkType;
  linkNote?: string;
};

const providerHomepages: Record<string, string> = {
  Kiwi: "https://www.kiwi.com/",
  Mock: "https://example.com/tripwise",
  Ryanair: "https://www.ryanair.com/cz/cs",
  Skyscanner: "https://www.skyscanner.net/",
};

const fallbackNote = "Zdroj zatím neumí přesný odkaz.";
const searchNote = "Otevře se vyhledávání u dopravce. Dostupnost konkrétního dne nemusí být garantovaná.";

function providerHomepage(source: TravelSource, sourceUrl?: string) {
  return providerHomepages[source] ?? sourceUrl ?? "https://www.google.com/travel/flights";
}

function dateToSkyscannerSegment(date: string) {
  const [year, month, day] = date.split("-");
  return `${year.slice(2)}${month}${day}`;
}

function hasSearchRoute(option: ProviderLinkInput): option is ProviderSearchLinkInput {
  return Boolean(option.origin && option.destinationAirportCode && option.dates?.depart && option.dates?.return);
}

function buildRyanairSearchLink(option: ProviderLinkInput): ProviderLink {
  if (!hasSearchRoute(option)) return buildFallbackLink(option);

  const params = new URLSearchParams();
  params.set("adults", String(option.passengers ?? 1));
  params.set("teens", "0");
  params.set("children", "0");
  params.set("infants", "0");
  params.set("dateOut", option.dates.depart);
  params.set("dateIn", option.dates.return);
  params.set("originIata", option.origin);
  params.set("destinationIata", option.destinationAirportCode);
  params.set("isConnectedFlight", "false");
  params.set("discount", "0");
  params.set("promoCode", "");
  params.set("isReturn", String(option.isReturn ?? true));

  return {
    url: `https://www.ryanair.com/cz/cs/trip/flights/select?${params.toString()}`,
    linkType: "search",
    linkNote: searchNote,
  };
}

function buildSkyscannerSearchLink(option: ProviderLinkInput): ProviderLink {
  if (!hasSearchRoute(option)) return buildFallbackLink(option);

  const outbound = dateToSkyscannerSegment(option.dates.depart);
  const inbound = dateToSkyscannerSegment(option.dates.return);
  const adults = option.passengers ?? 1;

  return {
    url: `https://www.skyscanner.net/transport/flights/${option.origin.toLowerCase()}/${option.destinationAirportCode.toLowerCase()}/${outbound}/${inbound}/?adults=${adults}&adultsv2=${adults}&cabinclass=economy&children=0&inboundaltsenabled=false&outboundaltsenabled=false&preferdirects=true`,
    linkType: "search",
    linkNote: searchNote,
  };
}

function buildFallbackLink(option: ProviderLinkInput): ProviderLink {
  return {
    url: providerHomepage(option.source, option.sourceUrl),
    linkType: "fallback",
    linkNote: fallbackNote,
  };
}

export function buildProviderLink(option: ProviderLinkInput): ProviderLink {
  try {
    if (option.source === "Ryanair") return buildRyanairSearchLink(option);
    if (option.source === "Skyscanner") return buildSkyscannerSearchLink(option);
    return buildFallbackLink(option);
  } catch {
    return buildFallbackLink(option);
  }
}
