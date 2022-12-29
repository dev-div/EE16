from odoo import Command
from odoo.tests import tagged

from .common import TestAccountReportsCommon


@tagged('post_install', '-at_install')
class TestFinancialReport(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.env.user.groups_id += cls.env.ref(
            'analytic.group_analytic_accounting')
        cls.report = cls.env.ref('account_reports.profit_and_loss')

        cls.analytic_plan_parent = cls.env['account.analytic.plan'].create({
            'name': 'Plan Parent',
            'company_id': False,
        })
        cls.analytic_plan_child = cls.env['account.analytic.plan'].create({
            'name': 'Plan Child',
            'parent_id': cls.analytic_plan_parent.id,
            'company_id': False,
        })

        cls.analytic_account_parent = cls.env['account.analytic.account'].create({
            'name': 'Account 1',
            'plan_id': cls.analytic_plan_parent.id
        })
        cls.analytic_account_child = cls.env['account.analytic.account'].create({
            'name': 'Account 2',
            'plan_id': cls.analytic_plan_child.id
        })

    def test_report_group_by_analytic_plan(self):

        out_invoice = self.env['account.move'].create([{
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'date': '2019-05-01',
            'invoice_date': '2019-05-01',
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'price_unit': 200.0,
                    'analytic_distribution': {
                        self.analytic_account_parent.id: 100,
                    },
                }),
                Command.create({
                    'product_id': self.product_b.id,
                    'price_unit': 200.0,
                    'analytic_distribution': {
                        self.analytic_account_child.id: 100,
                    },
                }),
            ]
        }])
        out_invoice.action_post()

        options = self._generate_options(
            self.report,
            '2019-01-01',
            '2019-12-31',
            default_options={
                'analytic_plans_groupby': [self.analytic_plan_parent.id, self.analytic_plan_child.id],
            }
        )

        lines = self.report._get_lines(options)

        self.assertLinesValues(
            # pylint: disable=bad-whitespace
            lines,
            [   0,                       1,            2],
            [
                ['Net Profit',           400.00,       200.00],
                ['Income',               400.00,       200.00],
                ['Gross Profit',         400.00,       200.00],
                ['Operating Income',     400.00,       200.00],
                ['Cost of Revenue',      '',           ''],
                ['Total Gross Profit',   400.00,       200.00],
                ['Other Income',         '',           ''],
                ['Total Income',         400.00,       200.00],
                ['Expenses',             '',           ''],
                ['Expenses',             '',           ''],
                ['Depreciation',         '',           ''],
                ['Total Expenses',       '',           ''],
            ],
            currency_map={
                1: {'currency': self.env.company.currency_id},
                2: {'currency': self.env.company.currency_id},
            },
        )
