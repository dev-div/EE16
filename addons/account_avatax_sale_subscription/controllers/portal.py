# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import http
from odoo.addons.sale_subscription.controllers.portal import CustomerPortal


class CustomerPortalAvatax(CustomerPortal):
    @http.route()
    def subscription(self, order_id, access_token=None, message='', message_class='', report_type=None, download=False, **kw):
        res = super().subscription(order_id, access_token=access_token, message=message, message_class='',
                                   report_type=report_type, download=download, **kw)
        if 'subscription' not in res.qcontext:
            return res

        subscription = res.qcontext['subscription']
        if subscription.fiscal_position_id.is_avatax:
            subscription.button_update_avatax()

        return res
