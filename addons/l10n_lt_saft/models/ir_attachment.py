# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, tools


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    @api.model
    def _l10n_lt_saft_load_xsd_files(self, force_reload=False):
        url = 'https://www.vmi.lt/evmi/documents/20142/725548/SAF-T_v2.01_20190306.xsd'
        xsd_name = 'xsd_lt_saft.xsd'
        tools.load_xsd_files_from_url(self.env, url, xsd_name, force_reload=force_reload)
        return

    @api.model
    def l10n_lt_saft_validate_xml_from_attachment(self, xml_content, xsd_name):
        return tools.validate_xml_from_attachment(self.env, xml_content, xsd_name, self._l10n_lt_saft_load_xsd_files)
