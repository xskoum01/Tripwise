# main.py
from search import search_personal_flights
from user_input import get_user_input

if __name__ == "__main__":
    trip_start, trip_end, max_price, stay_length = get_user_input()

    results = search_personal_flights(
        trip_start=trip_start,
        trip_end=trip_end,
        max_price=max_price,
        stay_length=stay_length
    )

    for trip in results:
        print(f"{trip['from']} → {trip['to_display']} za {trip['total_price']:.2f} Kč")
        print(f"  ✅ Tam:  {trip['departure']['date']} za {trip['departure']['price']} Kč")
        print(f"      🔗 {trip['departure'].get('link', 'N/A')}")
        print(f"  ⏪ Zpět: {trip['return']['date']} za {trip['return']['price']} Kč")
        print(f"      🔗 {trip['return'].get('link', 'N/A')}")
        print(f"  🌐 Celková rezervace: {trip['roundtrip_url']}\n")
