from odoo import models


class SpreadsheetDashboard(models.Model):
    _name = 'spreadsheet.dashboard'
    _inherit = ['spreadsheet.dashboard', 'spreadsheet.collaborative.mixin']

    def action_edit_dashboard(self):
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "tag": "action_edit_dashboard",
            "params": {
                "spreadsheet_id": self.id,
            },
        }

    def write(self, vals):
        if "data" in vals:
            self._delete_collaborative_data()
        return super().write(vals)
