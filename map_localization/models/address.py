import werkzeug
from odoo import models, fields, api


class GoogleMapsApi(models.Model):
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
    has_res_city = fields.Boolean(compute='_compute_has_res_city', store=False)

    @api.depends('city_id')
    def _compute_has_res_city(self):
        self.has_res_city = self.env['ir.model'].search_count([('model', '=', 'res.city')]) > 0

    @api.depends('street', 'house_number', 'district', 'zip', 'city_id', 'state_id')
    def _compute_google_maps_url(self):
        for record in self:
            record.google_maps_url = False

            api_key = record._get_api_key()
            if not api_key:
                continue

            BASE_URL = "https://www.google.com/maps/embed/v1/place"
            address_parts = [
                record.street,
                record.house_number,
                record.district,
                record.zip,
            ]

            if record.city_id:
                address_parts.append(record.city_id.name)
            if record.state_id:
                address_parts.append(record.state_id.name)

            address_parts = filter(None, address_parts)
            address_full = ", ".join(address_parts)

            if not address_full.strip():
                print('AA')
                continue

            query = werkzeug.urls.url_encode({"key": api_key, "q": address_full})
            record.google_maps_url = f"{BASE_URL}?{query}"
            return f"{BASE_URL}?{query}"


    def _get_api_key(self):
        api_key = (
            self.env["ir.config_parameter"].sudo().get_param("google_maps_api_key")
        )
        if not api_key:
            return False
        return api_key





