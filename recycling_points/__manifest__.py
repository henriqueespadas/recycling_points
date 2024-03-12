{
    "name": "Recycling Points",
    "version": "1.0",
    "category": "Extra Tools",
    "license": "AGPL-3",
    "summary": "Management features for recycling points",
    "author": "Henrique Espadas",
    "contributors": "Henrique Espadas",
    "website": "henriqueep@hotmail.com",
    "depends": ["map_localization", "website"],
    'images': ['static/description/main_screenshot.png'],
    "data": [
        "security/ir.model.access.csv",
        "security/groups.xml",
        "views/assets.xml",
        "views/collection_point_views.xml",
        "views/waste_type_views.xml",
        "views/res_config_settings.xml",
        "views/menus.xml",
        "static/src/xml/find_recycling_points_template.xml",
    ],
    "demo":
        [
            "data/recycling_points_data.xml",
        ],
    "installable": True,
    "application": True,
    "auto_install": False,
}
