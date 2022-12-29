# -*- coding: utf-8 -*-

from collections import defaultdict

from dateutil.relativedelta import relativedelta

from odoo import models


class AccountMove(models.Model):
    _inherit = 'account.move'

    def _action_invoice_ready_to_be_sent(self):
        # OVERRIDE
        # Make sure the subscription CRON is called when an invoice becomes ready to be sent by mail.
        res = super()._action_invoice_ready_to_be_sent()
        self.env.ref('sale_subscription.account_analytic_cron_for_invoice')._trigger()

        return res

    def _post(self, soft=True):
        posted_moves = super()._post(soft=soft)
        for move in posted_moves:
            if not move.invoice_line_ids.subscription_id or move.move_type != 'out_invoice':
                continue
            aml_by_subscription = defaultdict(lambda: self.env['account.move.line'])
            for aml in move.invoice_line_ids:
                aml_by_subscription[aml.subscription_id] |= aml
            for subscription, aml in aml_by_subscription.items():
                sale_order = aml.sale_line_ids.order_id
                if subscription != sale_order:
                    # we are invoicing an upsell
                    continue
                # Normally, only one period_end should exist
                end_dates = [ed for ed in aml.mapped('subscription_end_date') if ed]
                if end_dates and max(end_dates) > subscription.next_invoice_date:
                    subscription.next_invoice_date = max(end_dates) + relativedelta(days=1)
        return posted_moves
