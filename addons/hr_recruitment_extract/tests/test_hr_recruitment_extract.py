# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from contextlib import contextmanager
from unittest.mock import patch

from odoo.addons.base.models.ir_cron import ir_cron
from odoo.addons.hr.tests.common import TestHrCommon
from odoo.addons.hr_recruitment_extract.models.hr_applicant import ERROR_NOT_ENOUGH_CREDIT, NOT_READY, SUCCESS
from odoo.addons.iap.models.iap_account import IapAccount
from odoo.addons.iap.tools import iap_tools
from odoo.sql_db import Cursor


class TestRecruitmentExtractProcess(TestHrCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Avoid passing on the iap.account's `get` method to avoid the cr.commit breaking the test transaction.
        cls.env['iap.account'].create([{
            'service_name': 'invoice_ocr',
            'company_ids': [(6, 0, cls.env.user.company_id.ids)],
        }])
        cls.applicant = cls.env['hr.applicant'].create({'name': 'John Doe'})
        cls.attachment = cls.env['ir.attachment'].create({
            'name': "an attachment",
            'raw': b'My attachment',
        })

    def get_default_extract_response(self):
        return {
            'status_code': SUCCESS,
            'results': [{
                'name': {'selected_value': {'content': 'Johnny Doe'}, 'words': []},
                'email': {'selected_value': {'content': 'john@doe.com'}, 'words': []},
                'phone': {'selected_value': {'content': '+32488888888'}, 'words': []},
                'mobile': {'selected_value': {'content': '+32499999999'}, 'words': []},
            }],
            'document_id': 1234567,
        }

    @contextmanager
    def _mock_iap_extract(self, extract_response):
        def _trigger(self, *args, **kwargs):
            # A call to _trigger will directly run the cron
            self.method_direct_trigger()

        # The module iap is committing the transaction when creating an IAP account, we mock it to avoid that
        with patch.object(iap_tools, 'iap_jsonrpc', side_effect=lambda *args, **kwargs: extract_response), \
                patch.object(IapAccount, 'get_credits', side_effect=lambda *args, **kwargs: 1), \
                patch.object(Cursor, 'commit', side_effect=lambda *args, **kwargs: None), \
                patch.object(ir_cron, '_trigger', side_effect=_trigger, autospec=True):
            yield

    def test_auto_send_for_digitization(self):
        # test the `auto_send` mode for digitization does send the attachment upon upload
        self.env.company.recruitment_extract_show_ocr_option_selection = 'auto_send'
        extract_response = self.get_default_extract_response()

        with self._mock_iap_extract(extract_response):
            self.applicant.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.applicant.extract_state, 'waiting_extraction')
        self.assertTrue(self.applicant.state_processed)
        self.assertFalse(self.applicant.partner_name)
        self.assertFalse(self.applicant.email_from)
        self.assertFalse(self.applicant.partner_phone)
        self.assertFalse(self.applicant.partner_mobile)

        with self._mock_iap_extract(extract_response):
            self.applicant.check_all_status()

        self.assertEqual(self.applicant.partner_name, extract_response['results'][0]['name']['selected_value']['content'])
        self.assertEqual(self.applicant.email_from, extract_response['results'][0]['email']['selected_value']['content'])
        self.assertEqual(self.applicant.partner_phone, extract_response['results'][0]['phone']['selected_value']['content'])
        self.assertEqual(self.applicant.partner_mobile, extract_response['results'][0]['mobile']['selected_value']['content'])

    def test_manual_send_for_digitization(self):
        # test the `manual_send` mode for digitization
        self.env.company.recruitment_extract_show_ocr_option_selection = 'manual_send'
        extract_response = self.get_default_extract_response()

        self.assertEqual(self.applicant.extract_state, 'no_extract_requested')
        self.assertFalse(self.applicant.extract_can_show_send_button)
        self.assertFalse(self.applicant.extract_can_show_resend_button)

        with self._mock_iap_extract(extract_response):
            self.applicant.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.applicant.extract_state, 'no_extract_requested')
        self.assertTrue(self.applicant.extract_can_show_send_button)
        self.assertFalse(self.applicant.extract_can_show_resend_button)

        with self._mock_iap_extract(extract_response):
            self.applicant.action_send_for_digitization()

        # upon success, no button shall be provided
        self.assertFalse(self.applicant.extract_can_show_send_button)
        self.assertFalse(self.applicant.extract_can_show_resend_button)

        with self._mock_iap_extract(extract_response):
            self.applicant.check_all_status()

        self.assertEqual(self.applicant.partner_name, extract_response['results'][0]['name']['selected_value']['content'])
        self.assertEqual(self.applicant.email_from, extract_response['results'][0]['email']['selected_value']['content'])
        self.assertEqual(self.applicant.partner_phone, extract_response['results'][0]['phone']['selected_value']['content'])
        self.assertEqual(self.applicant.partner_mobile, extract_response['results'][0]['mobile']['selected_value']['content'])

    def test_no_send_for_digitization(self):
        # test that the `no_send` mode for digitization prevents the users from sending
        self.env.company.recruitment_extract_show_ocr_option_selection = 'no_send'
        extract_response = self.get_default_extract_response()

        with self._mock_iap_extract(extract_response):
            self.applicant.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.applicant.extract_state, 'no_extract_requested')
        self.assertFalse(self.applicant.extract_can_show_send_button)
        self.assertFalse(self.applicant.extract_can_show_resend_button)

    def test_show_resend_button_when_not_enough_credits(self):
        # test that upon not enough credit error, the retry button is provided
        self.env.company.recruitment_extract_show_ocr_option_selection = 'auto_send'

        with self._mock_iap_extract({'status_code': ERROR_NOT_ENOUGH_CREDIT}):
            self.applicant.message_post(attachment_ids=[self.attachment.id])

        self.assertFalse(self.applicant.extract_can_show_send_button)
        self.assertTrue(self.applicant.extract_can_show_resend_button)

    def test_status_not_ready(self):
        # test the NOT_READY ocr status effects
        self.env.company.recruitment_extract_show_ocr_option_selection = 'auto_send'
        status_response = {'status_code': NOT_READY}

        with self._mock_iap_extract(status_response):
            self.applicant._check_ocr_status()

        self.assertEqual(self.applicant.extract_state, 'extract_not_ready')
        self.assertFalse(self.applicant.extract_can_show_send_button)
        self.assertFalse(self.applicant.extract_can_show_resend_button)

    def test_applicant_validation(self):
        # test that when the applicant is hired, the validation is sent to the server
        self.env.company.recruitment_extract_show_ocr_option_selection = 'auto_send'
        extract_response = self.get_default_extract_response()

        with self._mock_iap_extract(extract_response):
            self.applicant._check_ocr_status()

        self.assertEqual(self.applicant.extract_state, 'waiting_validation')

        hired_stages = self.env['hr.recruitment.stage'].search([('hired_stage', '=', True)])
        with self._mock_iap_extract({'status_code': SUCCESS}):
            self.applicant.write({'stage_id': hired_stages[0].id})

        self.assertEqual(self.applicant.extract_state, 'done')
        self.assertEqual(self.applicant.get_validation('email')['content'], self.applicant.email_from)
        self.assertEqual(self.applicant.get_validation('phone')['content'], self.applicant.partner_phone)
        self.assertEqual(self.applicant.get_validation('mobile')['content'], self.applicant.partner_mobile)
        self.assertEqual(self.applicant.get_validation('name')['content'], self.applicant.name)
