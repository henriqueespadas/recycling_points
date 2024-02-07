from odoo import models, fields, api
import werkzeug
import logging

_logger = logging.getLogger(__name__)


class WasteCollectionPoint(models.Model):
    _name = "collection.point"
    _inherit = "google.maps.api"
    _description = "Waste Collection Point"

    name = fields.Char(string="Name", required=True)
    waste_type = fields.Many2many("waste.type", string="Waste Type")
    telephone = fields.Char(string="Telephone Number")
    email = fields.Char(string="Email")
    daily_limit = fields.Integer(
        string="m³ Daily Limit",
        help="Maximum number of waste units that can be collected per day.",
    )
    opening_hours = fields.Text(string="Opening Hours")
    description = fields.Text(string="Description")
