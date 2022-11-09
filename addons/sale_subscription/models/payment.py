# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.tools import str2bool

class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    # used to control the renewal flow based on the transaction state
    renewal_allowed = fields.Boolean(
        compute='_compute_renewal_allowed', store=False)

    @api.depends('state')
    def _compute_renewal_allowed(self):
        for tx in self:
            tx.renewal_allowed = tx.state in ('done', 'authorized')

    def _get_invoiced_subscription_transaction(self):
        # create the invoices for the transactions that are not yet linked to invoice
        # `_do_payment` do link an invoice to the payment transaction
        # calling `super()._invoice_sale_orders()` would create a second invoice for the next period
        # instead of the current period and would reconcile the payment with the new invoice
        def _filter_invoiced_subscription(self):
            self.ensure_one()
            # we look for tx with one invoice
            if len(self.invoice_ids) != 1:
                return False
            return any(self.invoice_ids.mapped('invoice_line_ids.sale_line_ids.order_id.is_subscription'))

        return self.filtered(_filter_invoiced_subscription)

    def _invoice_sale_orders(self):
        """ Override of payment to increase next_invoice_date when needed. """
        transaction_to_invoice = self - self._get_invoiced_subscription_transaction()
        # Update the next_invoice_date of SOL when the payment_mode is 'success_payment'
        # We have to do it here because when a client confirms and pay a SO from the portal with success_payment
        # The next_invoice_date won't be update by the reconcile_pending_transaction callback (do_payment is not called)
        # Create invoice
        res = super(PaymentTransaction, transaction_to_invoice)._invoice_sale_orders()
        if str2bool(self.env['ir.config_parameter'].sudo().get_param('sale.automatic_invoice')):
            today = fields.Date.today()
            order_to_update_ids = self.env['sale.order']
            for order in self.sale_order_ids:
                if order.recurrence_id and order.payment_token_id and order.start_date <= order.next_invoice_date <= today:
                    order_to_update_ids |= order
            order_to_update_ids._update_next_invoice_date()
            order_to_update_ids.order_line._reset_subscription_qty_to_invoice()
        return res


class PaymentToken(models.Model):
    _name = 'payment.token'
    _inherit = 'payment.token'

    def _handle_archiving(self):
        """ Override of payment to void the token on linked subscriptions.

        :return: None
        """
        super()._handle_archiving()

        linked_subscriptions = self.env['sale.order'].search([('payment_token_id', 'in', self.ids)])
        linked_subscriptions.write({'payment_token_id': None})

    def get_linked_records_info(self):
        """ Override of payment to add information about subscriptions linked to the current token.

        Note: self.ensure_one()

        :return: The list of information about linked subscriptions
        :rtype: list
        """
        res = super().get_linked_records_info()
        subscriptions = self.env['sale.order'].search([('payment_token_id', '=', self.id)])
        for sub in subscriptions:
            res.append({
                'description': subscriptions._description,
                'id': sub.id,
                'name': sub.name,
                'url': sub.get_portal_url()
            })
        return res
