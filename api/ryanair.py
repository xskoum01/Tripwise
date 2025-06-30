import requests
from urllib.parse import urlencode

def search_ryanair_flights(origin, destination=None, date_from=None, date_to=None, max_price=None, return_date=None):
    url = "https://www.ryanair.com/api/farfnd/3/oneWayFares"
    params = {
        "departureAirportIataCode": origin,
        "language": "en",
        "currency": "CZK"
    }

    if destination:
        params["arrivalAirportIataCode"] = destination
    if date_from:
        params["outboundDepartureDateFrom"] = date_from
    if date_to:
        params["outboundDepartureDateTo"] = date_to

    response = requests.get(url, params=params)

    if response.status_code != 200:
        raise Exception(f"❌ API error: {response.status_code} — {response.text}")

    data = response.json()
    fares = data.get("fares", [])
    results = []

    for flight in fares:
        outbound = flight.get("outbound", {})
        price = outbound.get("price", {}).get("value")
        date = outbound.get("departureDate")
        arrival_airport = outbound.get("arrivalAirport", {})
        arrival_city = arrival_airport.get("city", {}).get("name", "Unknown")
        arrival_iata = arrival_airport.get("code") or arrival_airport.get("iataCode") or "???"

        if not arrival_iata or not price or not date:
            continue

        if max_price and price > max_price:
            continue

        # 🛫 Vygenerujeme URL pro zpáteční let, pokud známe návratový datum
        booking_params = {
            "adults": 1,
            "teens": 0,
            "children": 0,
            "infants": 0,
            "originIata": origin,
            "destinationIata": arrival_iata,
            "dateOut": date[:10],
            "isConnectedFlight": "false"
        }

        if return_date:
            booking_params["dateIn"] = return_date[:10]

        deeplink_url = "https://www.ryanair.com/gb/en/trip/flights/select?" + urlencode(booking_params)

        results.append({
            "from": origin,
            "to": arrival_iata,
            "to_display": f"{arrival_city} ({arrival_iata})",
            "date": date,
            "price": price,
            "link": deeplink_url
        })

    return results
