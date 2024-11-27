from odoo import models, fields, api
import googlemaps

from odoo.addons.map_localization.services.google_maps_url_builder import (
    GoogleMapsUrlBuilder,
)
from odoo.addons.map_localization.services.config_service import ConfigService


class GoogleMapsApi(models.AbstractModel):
    _name = "google.maps.api"
    _description = "Google Maps API"

    street = fields.Char(string="Street")
    number = fields.Char(string="Number")
    district = fields.Char(string="District")
    zip = fields.Char(string="Postal Code")
    additional_info = fields.Char(string="Additional Info")
    state_id = fields.Many2one("res.country.state", string="State")
    country_id = fields.Char(string="Country")
    google_maps_url = fields.Char(
        string="Google Maps URL", compute="_compute_google_maps_url"
    )
    latitude = fields.Float(
        "Latitude", compute="_compute_lat_lng", readonly=True, store=True
    )
    longitude = fields.Float(
        "Longitude", compute="_compute_lat_lng", readonly=True, store=True
    )

    @api.depends("street", "number", "district", "zip", "state_id")
    def _compute_lat_lng(self):
        for record in self:
            lat, lng = record.geocode_function(
                record.street, record.zip, record.number
            )
            record.latitude = lat
            record.longitude = lng

    @api.depends("street", "number", "district", "zip", "state_id")
    def _compute_google_maps_url(self):
        for record in self:
            config_service = ConfigService(self.env)
            api_key = config_service.get_google_maps_api_key()
            if not api_key:
                record.google_maps_url = False
                continue

            address_parts = [
                record.street,
                record.number,
                record.district,
                record.zip,
                record.state_id.name if record.state_id else None,
            ]

            if not any(address_parts):
                address_parts = ["Av Paulista"]

            url_builder = GoogleMapsUrlBuilder(api_key)
            record.google_maps_url = url_builder.build_url(address_parts)

    def geocode_function(self, street, zip_code, number):
        gmaps = googlemaps.Client(
            key=self.env["ir.config_parameter"].sudo().get_param("google_maps_api_key")
        )

        address = f"{number} {street}, {zip_code}"

        result = gmaps.geocode(address)

        if result and len(result) > 0:
            latitude = result[0]["geometry"]["location"]["lat"]
            longitude = result[0]["geometry"]["location"]["lng"]
            return latitude, longitude
        else:
            return None, None
