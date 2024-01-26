from odoo import http


class GarbageCollectionPointsController(http.Controller):
    @http.route("/garbage_collections/", auth="public", website="True")
    def index(self, **kw):
        return http.request.render(
            "garbage_collections.template_garbage_collections_index", {}
        )

    @http.route(
        "/garbage_collections/find_recycling_points", auth="public", website="True"
    )
    def find_recycling_points(self, **kw):
        return http.request.render(
            "garbage_collections.find_recycling_points_template", {}
        )
