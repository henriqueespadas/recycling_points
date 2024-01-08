from odoo import models, api
import brazilcep


class GoogleMapsApi(models.AbstractModel):
    _inherit = "google.maps.api"

    @api.onchange("zip")
    def _compute_google_maps_url(self):
        if self.zip:
            address = self._get_address_from_zip(self.zip)
            if address:
                self._update_address_fields(address)

    @staticmethod
    def _get_address_from_zip(zip_code):
        return brazilcep.get_address_from_cep(zip_code)

    def _update_address_fields(self, address):
        self.street = address.get("street")
        self.district = address.get("district")
        city = self.env["res.city"].search([("name", "=", address.get("city"))])
        state = self.env["res.country.state"].search(
            [("code", "=", address.get("uf")), ("country_id", "=", 31)]
        )
        self.city_id = city.id if city else False
        self.state_id = state.id if state else False
