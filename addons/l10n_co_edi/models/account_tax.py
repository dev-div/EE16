# coding: utf-8
from odoo import fields, models


class AccountTax(models.Model):
    _inherit = 'account.tax'

    l10n_co_edi_type = fields.Many2one('l10n_co_edi.tax.type', string='Tipo de Valor')


class AccountTaxTemplate(models.Model):
    _inherit = 'account.tax.template'

    l10n_co_edi_type = fields.Many2one('l10n_co_edi.tax.type', string='Tipo de Valor')

    def _get_tax_vals(self, company, tax_template_to_tax):
        vals = super()._get_tax_vals(company, tax_template_to_tax)
        if self.l10n_co_edi_type:
            vals['l10n_co_edi_type'] = self.l10n_co_edi_type.id
        return vals
