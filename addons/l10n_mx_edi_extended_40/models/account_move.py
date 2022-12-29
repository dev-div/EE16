# -*- coding: utf-8 -*-
from odoo import fields, models, api
from odoo.tools.sql import column_exists, create_column


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_mx_edi_external_trade_type = fields.Selection(
        selection=[
            ('02', 'Definitive'),
            ('03', 'Temporary'),
        ],
        string="External Trade",
        readonly=False, store=True,
        compute='_compute_l10n_mx_edi_external_trade_type',
        help="If this field is 02, the CFDI will include the complement.")

    def _auto_init(self):
        """
        Create compute stored field l10n_mx_edi_external_trade_type
        here to avoid MemoryError on large databases.
        """
        if not column_exists(self.env.cr, 'account_move', 'l10n_mx_edi_external_trade_type'):
            create_column(self.env.cr, 'account_move', 'l10n_mx_edi_external_trade_type', 'varchar')
        return super()._auto_init()

    @api.depends('partner_id', 'partner_id.l10n_mx_edi_external_trade_type')
    def _compute_l10n_mx_edi_external_trade_type(self):
        for move in self:
            move.l10n_mx_edi_external_trade_type = move.partner_id.l10n_mx_edi_external_trade_type

    @api.depends('partner_id', 'l10n_mx_edi_external_trade_type')
    def _compute_l10n_mx_edi_external_trade(self):
        # OVERRIDE l10n_mx_edi_extended
        for move in self:
            move.l10n_mx_edi_external_trade = move.l10n_mx_edi_external_trade_type == '02'
