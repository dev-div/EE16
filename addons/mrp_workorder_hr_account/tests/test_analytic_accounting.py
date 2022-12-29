# Part of Odoo. See LICENSE file for full copyright and licensing details.
from freezegun import freeze_time

from odoo import Command
from odoo.tests import Form
from odoo.addons.mrp_account.tests.test_analytic_account import TestMrpAnalyticAccount


class TestMrpAnalyticAccountHr(TestMrpAnalyticAccount):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.workcenter.write({
            'allow_employee': True,
            'employee_ids': [
                Command.create({
                    'name': 'Arthur Fu',
                    'pin': '1234',
                    'hourly_cost': 100,
                }),
                Command.create({
                    'name': 'Thomas Nific',
                    'pin': '5678',
                    'hourly_cost': 200,
                })
            ]
        })
        cls.employee1 = cls.env['hr.employee'].search([
            ('name', '=', 'Arthur Fu'),
        ])
        cls.employee2 = cls.env['hr.employee'].search([
            ('name', '=', 'Thomas Nific'),
        ])

    def test_mrp_employee_analytic_account(self):
        """Test when a wo requires employees, both aa lines for employees and for
        workcenters are correctly posted.
        """
        mo_form = Form(self.env['mrp.production'])
        mo_form.product_id = self.product
        mo_form.bom_id = self.bom
        mo_form.product_qty = 1.0
        mo_form.analytic_account_id = self.analytic_account
        mo = mo_form.save()
        with freeze_time('2027-10-01 10:00:00'):
            mo.workorder_ids.start_employee(self.employee1.id)
            mo.workorder_ids.start_employee(self.employee2.id)
            self.env.flush_all()   # need flush to trigger compute
        with freeze_time('2027-10-01 11:00:00'):
            mo.workorder_ids.stop_employee(self.employee1.id)
            mo.workorder_ids.stop_employee(self.employee2.id)
            self.env.flush_all()   # need flush to trigger compute

        employee1_aa_line = mo.workorder_ids.employee_analytic_account_line_ids.filtered(lambda l: l.employee_id == self.employee1)
        employee2_aa_line = mo.workorder_ids.employee_analytic_account_line_ids.filtered(lambda l: l.employee_id == self.employee2)
        self.assertEqual(employee1_aa_line.amount, -100.0)
        self.assertEqual(employee2_aa_line.amount, -200.0)
        self.assertEqual(mo.workorder_ids.mo_analytic_account_line_id.amount, -10.0)
