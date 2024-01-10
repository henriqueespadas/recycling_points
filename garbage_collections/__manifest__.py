{
    "name": "Collection Points",
    "version": "0.0",
    "category": "Operations/Environment",
    "license": "AGPL-3",
    "summary": "Management features for collection points",
    "author": "Henrique Espadas",
    "depends": ["map_localization", "website"],
    "data": [
        "security/ir.model.access.csv",
        "views/collection_point_views.xml",
        "views/waste_type_views.xml",
        "views/menus.xml",
        "static/src/template_garbage_collections_index.xml",
    ],
    "installable": True,
    "application": True,
    "auto_install": False,
}
