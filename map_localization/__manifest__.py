{
    "name": "Google Maps API",
    "description": "Google Maps API integration for Odoo",
    "version": "1.0",
    "category": "Operations/Environment",
    "license": "AGPL-3",
    "summary": "Module that serves as an extension for modules that want to connect to the googlemaps api",
    "author": "Henrique Espadas",
    "contributors": "Henrique Espadas",
    "website": "henriqueep@hotmail.com",
    "depends": [],
    'images': ['static/description/main_screenshot.png'],
    "data": [
        "security/ir.model.access.csv",
        "data/google_maps_api_key.xml",
        "views/res_config_settings.xml",
        "views/assets.xml",
    ],
    "installable": True,
    "application": True,
    "auto_install": False,
}
