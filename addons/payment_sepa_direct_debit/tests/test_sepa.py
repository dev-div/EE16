# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import Command
from odoo.tests import tagged

from odoo.addons.payment_sepa_direct_debit.tests.common import SepaDirectDebitCommon


@tagged('post_install', '-at_install')
class TestSepaDirectDebit(SepaDirectDebitCommon):

    def test_transactions_are_confirmed_as_soon_as_mandate_is_valid(self):
        token = self._create_token(provider_ref=self.mandate.name, sdd_mandate_id=self.mandate.id)
        tx = self._create_transaction(flow='direct', token_id=token.id)

        tx._send_payment_request()
        self.assertEqual(tx.state, 'done', "SEPA transactions should be immediately confirmed.")

    def test_sepa_direct_debit_acquirer_in_batch_payment(self):
        """
        Test the xml generation when validating a batch payment
        with sdd provider payment method.
        """
        sdd_provider_method_line = self.company_data['default_journal_bank'].inbound_payment_method_line_ids.filtered(lambda l: l.code == 'sepa_direct_debit')
        payment = self.env['account.payment'].create({
            'payment_type': 'inbound',
            'partner_id': self.partner.id,
            'amount': 100.0,
            'journal_id': self.company_data['default_journal_bank'].id,
            'payment_method_line_id': sdd_provider_method_line.id,
        })
        payment.action_post()

        batch_payment = self.env['account.batch.payment'].create(
            {
                'journal_id': payment.journal_id.id,
                'payment_method_id': payment.payment_method_id.id,
                'payment_ids': [
                    (Command.set(payment.ids))
                ],
            }
        )
        batch_payment.validate_batch_button()

        self.assertTrue(batch_payment.export_file)
