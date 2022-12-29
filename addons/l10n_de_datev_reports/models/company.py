# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_de_datev_account_length = fields.Integer(
        string="DateV G/L account length",
        default=lambda self: self._default_l10n_de_datev_account_length(),
    )

    @api.constrains('l10n_de_datev_account_length')
    def _validate_l10n_de_datev_account_length(self):
        for company in self:
            if not (4 <= company.l10n_de_datev_account_length <= 8):
                raise ValidationError(_("G/L account length must be between 4 and 8."))

    def _default_l10n_de_datev_account_length(self):
        param_start = self.env['ir.config_parameter'].sudo().get_param('l10n_de.datev_start_count', "100000000")[:9]
        param_start_vendors = self.env['ir.config_parameter'].sudo().get_param('l10n_de.datev_start_count_vendors', "700000000")[:9]

        # The gegenkonto should be 1 length higher than the account length, so we have to substract 1 to the params length
        return max(param_start.isdigit() and len(param_start) or 9, param_start_vendors.isdigit() and len(param_start_vendors) or 9, 5) - 1
