# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_avatax.tests.common import TestAccountAvataxCommon
from odoo.addons.account_avatax_sale_subscription.tests.test_sale_subscription import TestSaleSubscriptionAvalaraCommon
from odoo.addons.sale_subscription.tests.common_sale_subscription import TestSubscriptionCommon
from odoo.addons.payment.tests.http_common import PaymentHttpCommon
from odoo.tests.common import tagged


@tagged("post_install", "-at_install")
class TestAvataxSubscriptionController(TestSaleSubscriptionAvalaraCommon, PaymentHttpCommon, TestSubscriptionCommon, TestAccountAvataxCommon):
    def test_01_avatax_called_in_preview(self):
        avatax_fp = self.env.ref('account_avatax.account_fiscal_position_avatax_us')
        avatax_fp.sudo().company_id = self.company
        self.subscription.partner_id = self.user_portal.partner_id
        self.subscription.fiscal_position_id = avatax_fp
        self.subscription._portal_ensure_token()

        url = "/my/subscription/%s?access_token=%s" % (self.subscription.id, self.subscription.access_token)
        with self._capture_request({'lines': [], 'summary': []}) as capture:
            self.url_open(url, allow_redirects=False)

        self.assertEqual(
            capture.val and capture.val['json']['referenceCode'],
            self.subscription.name,
            'Should have queried avatax when viewing the subscription.'
        )
