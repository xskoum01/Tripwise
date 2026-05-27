function parseIsoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { day, month, year };
}

function formatDatePart(day: number, month: number, year?: number) {
  return year ? `${day}. ${month}. ${year}` : `${day}. ${month}.`;
}

export function formatDateCz(date: string): string {
  const { day, month, year } = parseIsoDate(date);
  return formatDatePart(day, month, year);
}

export function formatDateRangeCz(depart: string, returnDate: string): string {
  return `${formatDateCz(depart)} – ${formatDateCz(returnDate)}`;
}

export function formatDateRangeCompactCz(depart: string, returnDate: string): string {
  const start = parseIsoDate(depart);
  const end = parseIsoDate(returnDate);

  if (start.year === end.year) {
    return `${formatDatePart(start.day, start.month)} – ${formatDatePart(end.day, end.month, end.year)}`;
  }

  return formatDateRangeCz(depart, returnDate);
}

export function formatTripLengthCz(nights: number): string {
  if (nights === 1) return "1 noc";
  if (nights >= 2 && nights <= 4) return `${nights} noci`;
  return `${nights} nocí`;
}
