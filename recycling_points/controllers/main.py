from odoo import http


class RecyclingPointsController(http.Controller):
    @http.route("/recycling_points", auth="public", website="True")
    def find_recycling_points(self, **kw):
        return http.request.render(
            "recycling_points.find_recycling_points_template", {}
        )
