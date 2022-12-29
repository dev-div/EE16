# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PaymentToken(models.Model):
    _name = 'payment.token'
    _inherit = 'payment.token'

    def _handle_deactivation_request(self):
        """ Override of payment to void the token on linked subscriptions.

        Note: self.ensure_one()

        :return: None
        """
        super()._handle_deactivation_request()  # Called first in case an UserError is raised
        linked_subscriptions = self.env['sale.order'].search(
            [('payment_token_id', '=', self.id)]
        )
        linked_subscriptions.payment_token_id = False

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
                'url': sub.get_portal_url(),
                'active_subscription': sub.stage_category in ['progress', 'paused'],
            })
        return res
