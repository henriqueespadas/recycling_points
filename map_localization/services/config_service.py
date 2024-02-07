class ConfigService:
    def __init__(self, env):
        self.env = env

    def get_google_maps_api_key(self):
        return self.env["ir.config_parameter"].sudo().get_param("google_maps_api_key")
