type AirlineLink = {
  url: string;
  label: string;
};

const byIata: Record<string, AirlineLink> = {
  FR: { url: "https://www.ryanair.com/cz/cs", label: "Ryanair" },
  W6: { url: "https://wizzair.com", label: "Wizz Air" },
  QS: { url: "https://www.smartwings.com", label: "Smartwings" },
  VY: { url: "https://www.vueling.com", label: "Vueling" },
  U2: { url: "https://www.easyjet.com", label: "easyJet" },
  LH: { url: "https://www.lufthansa.com", label: "Lufthansa" },
  OS: { url: "https://www.austrian.com", label: "Austrian" },
  IB: { url: "https://www.iberia.com", label: "Iberia" },
};

const byName: Array<{ patterns: string[]; link: AirlineLink }> = [
  { patterns: ["ryanair"], link: byIata.FR },
  { patterns: ["wizz"], link: byIata.W6 },
  { patterns: ["smartwings"], link: byIata.QS },
  { patterns: ["vueling"], link: byIata.VY },
  { patterns: ["easyjet", "easy jet"], link: byIata.U2 },
  { patterns: ["lufthansa"], link: byIata.LH },
  { patterns: ["austrian"], link: byIata.OS },
  { patterns: ["iberia"], link: byIata.IB },
];

export function getAirlineLink(carrierName?: string, iataCode?: string): AirlineLink | undefined {
  if (iataCode) {
    const found = byIata[iataCode.toUpperCase()];
    if (found) return found;
  }
  if (carrierName) {
    const lower = carrierName.toLowerCase();
    for (const { patterns, link } of byName) {
      if (patterns.some((p) => lower.includes(p))) return link;
    }
  }
  return undefined;
}

export function extractIataFromFlightNumber(flightNumber?: string): string | undefined {
  if (!flightNumber) return undefined;
  const match = /^([A-Z]{2})/.exec(flightNumber);
  return match?.[1];
}
