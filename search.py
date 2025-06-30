# search.py
import time
from datetime import datetime, timedelta
from api.ryanair import search_ryanair_flights
from config.config import DEPARTURE_AIRPORTS

def search_personal_flights(
    trip_start: str,
    trip_end: str,
    max_price: float = None,
    stay_length: int = None,
    top_n_departures: int = 5
) -> list[dict]:
    trips = []
    trip_start_date = datetime.fromisoformat(trip_start).date()
    trip_end_date   = datetime.fromisoformat(trip_end).date()
    # minimální délka pobytu, pokud uživatel nezadá přesně
    min_stay = stay_length if stay_length is not None else 2

    for origin in DEPARTURE_AIRPORTS:
        print(f"\n✈️==================== {origin} → kamkoliv ====================\n")
        print(f"🔎 Hledám odlety z {origin} v období {trip_start} → {trip_end}")

        # 1) stáhni všechny odlety na celé období jedním voláním
        departures = search_ryanair_flights(
            origin=origin,
            date_from=trip_start,
            date_to=trip_end,
            max_price=None
        )
        if not departures:
            continue

        # 2) vezmi jen top_n_departures nejlevnější odlety
        for dep in sorted(departures, key=lambda f: f["price"])[:top_n_departures]:
            dep_date = datetime.fromisoformat(dep["date"]).date()
            dest     = dep["to"]

            # spočítat první možný návrat
            earliest_ret_date = dep_date + timedelta(days=min_stay)
            if earliest_ret_date > trip_end_date:
                continue

            # pokud uživatel zadal přesný stay_length, hledáme pouze tento den
            if stay_length is not None:
                ret_from_iso = earliest_ret_date.isoformat()
                ret_to_iso   = earliest_ret_date.isoformat()
            else:
                ret_from_iso = earliest_ret_date.isoformat()
                ret_to_iso   = trip_end_date.isoformat()

            # 3) stáhni návraty jedním voláním
            returns = search_ryanair_flights(
                origin=dest,
                destination=origin,
                date_from=ret_from_iso,
                date_to=ret_to_iso,
                max_price=None
            )
            if not returns:
                continue

            # 4) vyber nejlevnější návrat z dostupných
            cheapest_ret = min(returns, key=lambda f: f["price"])
            total_price  = dep["price"] + cheapest_ret["price"]

            # 5) až teď aplikuj max_price na celkovou
            if max_price is not None and total_price > max_price:
                continue

            # 6) sestav deeplink
            booking_url = (
                "https://www.ryanair.com/gb/en/trip/flights/select?"
                f"adults=1&teens=0&children=0&infants=0"
                f"&originIata={origin}"
                f"&destinationIata={dest}"
                f"&dateOut={dep_date.isoformat()}"
                f"&dateIn={cheapest_ret['date'][:10]}"
                f"&isConnectedFlight=false"
            )

            trips.append({
                "from": origin,
                "to": dest,
                "to_display": dep["to_display"],
                "total_price": total_price,
                "departure": dep,
                "return": cheapest_ret,
                "roundtrip_url": booking_url
            })

        # time.sleep(0.05)  # už není třeba, ale můžete lehce zpomalit kvůli rate limitům

    # 7) de-duplikace podle cíle: vezmi nejlevnější variantu
    unique = {}
    for trip in trips:
        d = trip["to"]
        if d not in unique or trip["total_price"] < unique[d]["total_price"]:
            unique[d] = trip

    return sorted(unique.values(), key=lambda x: x["total_price"])
