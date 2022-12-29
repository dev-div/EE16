# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import route
from odoo.addons.sale.controllers.portal import CustomerPortal


class CustomerPortalAvatax(CustomerPortal):

    @route()
    def portal_order_page(self, *args, **kwargs):
        response = super().portal_order_page(*args, **kwargs)
        if 'sale_order' not in response.qcontext:
            return response

        # Update taxes before customers see their quotation. This also ensures that tax validation
        # works (e.g. customer has valid address, ...). Otherwise errors will occur during quote
        # confirmation.
        order = response.qcontext['sale_order']
        if order.state in ('draft', 'sent') and order.fiscal_position_id.is_avatax:
            order.button_update_avatax()

        return response
