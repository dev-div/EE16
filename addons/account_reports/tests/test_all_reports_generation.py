# -*- coding: utf-8 -*-

from unittest.mock import patch

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import tagged

COUNTRIES_WITHOUT_CLOSING_ACCOUNT = {
    'AR', 'AE', 'AT', 'AU', 'BG', 'BR', 'CH', 'CL', 'DK', 'ES', 'GB', 'HU', 'IN', 'MN', 'NL', 'NO', 'PT', 'SA', 'SE', 'SG', 'SI',
}

@tagged('post_install_l10n', 'post_install', '-at_install')
class TestAllReportsGeneration(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        available_country_ids = cls.env['account.chart.template'].search([('country_id', '!=', False)]).country_id.ids
        if cls.env.ref('l10n_generic_coa.configurable_chart_template', raise_if_not_found=False):
            available_country_ids += [cls.env.ref('base.us').id, False]

        cls.reports = cls.env['account.report'].search([('country_id', 'in', available_country_ids)])
        # The consolidation report needs a consolidation.period to be open, which we won't have by default.
        # Therefore, instead of testing it here, wse skip it and add a dedicated test in the consolidation module.
        conso_report = cls.env.ref('account_consolidation.consolidated_balance_report', raise_if_not_found=False)
        if conso_report and conso_report in cls.reports:
            cls.reports -= conso_report

        # The consolidation report needs a consolidation.period to be open, which we won't have by default.
        # Therefore, we avoid testing it here, and instead add a dedicated test in the appropriate module.
        conso_report = cls.env.ref('account_consolidation.consolidated_balance_report', raise_if_not_found=False)
        if conso_report and conso_report in cls.reports:
            cls.reports -= conso_report

        # Make the reports always available, so that they don't clash with the comany's country
        cls.reports.availability_condition = 'always'
        # We keep the country set on each of these reports, so that we can load the proper test data when testing exports

    def test_open_all_reports(self):
        # 'unfold_all' is forced on all reports (even if they don't support it), so that we really open it entirely
        self.reports.filter_unfold_all = True

        for report in self.reports:
            with self.subTest(f"Could not open report {report.name} ({report.country_id.name  or 'No Country'})"):
                # 'report_id' key is forced so that we don't open a variant when calling a root report
                report.get_report_informations({'report_id': report.id, 'unfold_all': True})

    def test_generate_all_export_files(self):
        # Test values for the fields that become mandatory when doing exports on the reports, depending on the country
        company_test_values = {
            'LU': {'ecdf_prefix': '1234AB', 'matr_number': '1111111111111', 'vat': 'LU12345613'},
            'BR': {'vat': '01234567891251'},
            'AR': {'vat': '30714295698'},
            'AU': {'vat': '11225459588', 'street': 'Arrow Street', 'zip': '1348', 'city': 'Starling City', 'state_id': self.env.ref('base.state_au_1').id},
        }

        partner_test_values = {
            'AR': {'l10n_latam_identification_type_id': (self.env.ref('l10n_ar.it_cuit', raise_if_not_found=False) or {'id': None})['id']},
        }

        # Some root reports are made for just one country and require test fields to be set the right way to generate their exports properly.
        # Since they are root reports and are always available, they normally have no country set; we assign one here (only for the ones requiring it)
        reports_forced_countries = [
            ('AU', 'l10n_au_reports.tpar_report'),
        ]
        for country_code, report_ref in reports_forced_countries:
            country = self.env['res.country'].search([('code', '=', country_code)], limit=1)
            report = self.env.ref(report_ref, raise_if_not_found=False)
            if report:
                report.country_id = country

        # Check buttons of every report
        for report in self.reports:
            # Setup some generic data on the company that could be needed for some file export
            self.env.company.write({
                'vat': "VAT123456789",
                'email': "dummy@email.com",
                'phone': "01234567890",
                'company_registry': '42',
                **company_test_values.get(report.country_id.code, {}),
            })

            self.env.company.partner_id.write(partner_test_values.get(report.country_id.code, {}))

            options = report._get_options({'report_id': report.id, '_running_export_test': True})

            for option_button in options['buttons']:
                if option_button['action'] == 'action_periodic_vat_entries' and self.env.company.account_fiscal_country_id.code in COUNTRIES_WITHOUT_CLOSING_ACCOUNT:
                    # Some countries don't have any default account set for tax closing. They raise a RedirectWarning; we don't want it
                    # to make the test fail.
                    continue

                with self.subTest(f"Button '{option_button['name']}' from report {report.name} ({report.country_id.name or 'No Country'}) raised an error"):
                    with patch.object(type(self.env['ir.actions.report']), '_run_wkhtmltopdf', lambda *args, **kwargs: b"This is a pdf"):
                        action_dict = report.dispatch_report_action(options, option_button['action'], action_param=option_button.get('action_param'))

                        if action_dict['type'] == 'ir_actions_account_report_download':
                            file_gen_res = report.dispatch_report_action(options, action_dict['data']['file_generator'])
                            self.assertEqual(
                                set(file_gen_res.keys()), {'file_name', 'file_content', 'file_type'},
                                "File generator's result should always contain the same 3 keys."
                            )

            # Unset the test values, in case they are used in conditions to define custom behaviors
            self.env.company.write({
                field_name: None
                for field_name in company_test_values.get(report.country_id.code, {}).keys()
            })

            self.env.company.partner_id.write({
                field_name: None
                for field_name in partner_test_values.get(report.country_id.code, {}).keys()
            })
