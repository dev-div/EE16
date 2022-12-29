# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    # used to control the renewal flow based on the transaction state
    renewal_allowed = fields.Boolean(
        compute='_compute_renewal_allowed', store=False)

    @api.depends('state')
    def _compute_renewal_allowed(self):
        for tx in self:
            tx.renewal_allowed = tx.state in ('done', 'authorized')

    def _reconcile_after_done(self):
        # override to force invoice creation if the transaction is done for a subscription
        # We don't take care of the sale.automatic_invoice parameter in that case.
        res = super()._reconcile_after_done()
        tx_to_invoice = self.env['payment.transaction']
        for tx in self:
            if tx.sale_order_ids.filtered(lambda so: so.state in ('sale', 'done') and so.is_subscription) and not tx.invoice_ids:
                tx_to_invoice |= tx
        tx_to_invoice._invoice_sale_orders()
        tx_to_invoice.invoice_ids.filtered(lambda inv: inv.state == 'draft')._post()
        tx_to_invoice._send_invoice()
        return res

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

    def _get_partial_payment_subscription_transaction(self):
        # filter transaction which are only a partial payment of subscription
        tx_with_partial_payments = self.env["payment.transaction"]
        for tx in self:
            for order in tx.sale_order_ids.filtered(lambda so: so.state in ('sale', 'done') and so.is_subscription):
                if order.currency_id.compare_amounts(tx.amount, order.amount_total) != 0:
                    tx_with_partial_payments |= tx
        return tx_with_partial_payments

    def _invoice_sale_orders(self):
        """ Override of payment to increase next_invoice_date when needed. """
        transaction_to_invoice = self - self._get_invoiced_subscription_transaction()
        transaction_to_invoice -= self._get_partial_payment_subscription_transaction()
        # Update the next_invoice_date of SOL when the payment_mode is 'success_payment'
        # We have to do it here because when a client confirms and pay a SO from the portal with success_payment
        # The next_invoice_date won't be update by the reconcile_pending_transaction callback (do_payment is not called)
        # Create invoice
        res = super(PaymentTransaction, transaction_to_invoice)._invoice_sale_orders()
        return res
