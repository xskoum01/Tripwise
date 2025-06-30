# scrapers/kiwi.py

import requests
from config.settings import KIWI_API_KEY

API_URL = "https://tequila-api.kiwi.com/v2/search"

def search_flights(fly_from, fly_to, date_from, date_to, max_price=None, limit=5, currency="CZK"):
    headers = {"apikey": KIWI_API_KEY}
    params = {
        "fly_from": fly_from,
        "fly_to": fly_to,
        "date_from": date_from,
        "date_to": date_to,
        "curr": currency,
        "limit": limit,
        "sort": "price"
    }
    if max_price:
        params["price_to"] = max_price

    response = requests.get(API_URL, headers=headers, params=params)
    if response.status_code != 200:
        raise Exception(f"Chyba {response.status_code}: {response.text}")

    flights = response.json().get("data", [])
    return [
        {
            "from": f["cityFrom"],
            "to": f["cityTo"],
            "price": f["price"],
            "departure": f["local_departure"],
            "arrival": f["local_arrival"],
            "deep_link": f["deep_link"]
        }
        for f in flights
    ]
