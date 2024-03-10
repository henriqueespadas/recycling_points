from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    google_maps_api_key = fields.Char(
        string="Google API token", config_parameter="google_maps_api_key"
    )
