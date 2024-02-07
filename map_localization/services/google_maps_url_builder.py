import werkzeug.urls


class GoogleMapsUrlBuilder:
    def __init__(self, api_key):
        self.api_key = api_key

    def build_url(self, address_parts):
        BASE_URL = "https://www.google.com/maps/embed/v1/place"
        address_full = ", ".join(filter(None, address_parts))

        if not address_full.strip():
            return False

        query = werkzeug.urls.url_encode({"key": self.api_key, "q": address_full})
        return f"{BASE_URL}?{query}"
