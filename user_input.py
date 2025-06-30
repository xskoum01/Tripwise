# user_input.py
from datetime import datetime, timedelta

def get_user_input():
    today = datetime.today()
    default_start = today + timedelta(days=14)
    default_end = default_start + timedelta(days=14)

    print("\n📅 Zadej období pro celý výlet:")
    trip_start = input(
        f"Začátek výletu (YYYY-MM-DD) [default: {default_start.date()}]: "
    ).strip() or default_start.date().isoformat()
    trip_end = input(
        f"Konec výletu (YYYY-MM-DD) [default: {default_end.date()}]: "
    ).strip() or default_end.date().isoformat()

    # validace formátu
    try:
        # jen pro jistotu, hlásit chybu, pokud je formát špatný
        datetime.fromisoformat(trip_start)
        datetime.fromisoformat(trip_end)
    except ValueError:
        raise ValueError("Neplatný formát data, použij YYYY-MM-DD.")

    price_input = input(
        "💰 Maximální cena za zpáteční letenku [Kč] (volitelné, Enter pro neomezeně): "
    ).strip()
    max_price = float(price_input) if price_input else None

    stay_input = input(
        "📆 Kolik dní chceš být na místě? (volitelné, Enter pro libovolně): "
    ).strip()
    stay_length = int(stay_input) if stay_input else None

    return trip_start, trip_end, max_price, stay_length
