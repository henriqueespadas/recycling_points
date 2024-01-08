import werkzeug
from odoo import models, fields, api


class GoogleMapsApi(models.AbstractModel):
    _name = "google.maps.api"

    street = fields.Char(string="Street")
    house_number = fields.Char(string="Number")
    district = fields.Char(string="District")
    zip = fields.Char(string="Postal Code")
    additional_info = fields.Char(string="Additional Info")
    city_id = fields.Many2one("res.city", string="City")
    state_id = fields.Many2one("res.country.state", string="State")
    country_id = fields.Char(string="Country")
    google_maps_url = fields.Char(
        string="Google Maps URL", compute="_compute_google_maps_url"
    )
    has_res_city = fields.Boolean(compute="_compute_has_res_city", store=False)

    @api.depends("city_id")
    def _compute_has_res_city(self):
        self.has_res_city = (
            self.env["ir.model"].search_count([("model", "=", "res.city")]) > 0
        )

    @api.depends("street", "house_number", "district", "zip", "city_id", "state_id")
    def _compute_google_maps_url(self):
        for record in self:
            config_service = ConfigService(record.env)
            api_key = config_service.get_google_maps_api_key()
            if not api_key:
                record.google_maps_url = False
                continue

            address_parts = [
                record.street,
                record.house_number,
                record.district,
                record.zip,
                record.city_id.name if record.city_id else None,
                record.state_id.name if record.state_id else None,
            ]

            if not any(address_parts):
                address_parts = ["Av Paulista"]

            url_builder = GoogleMapsUrlBuilder(api_key)
            record.google_maps_url = url_builder.build_url(address_parts)


class ConfigService:
    def __init__(self, env):
        self.env = env

    def get_google_maps_api_key(self):
        return self.env["ir.config_parameter"].sudo().get_param("google_maps_api_key")


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
