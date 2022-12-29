# -*- coding: utf-8 -*-
from odoo import _, Command, models, fields
from odoo.tools import float_is_zero


class MrpWorkcenterProductivity(models.Model):
    _inherit = "mrp.workcenter.productivity"

    def _compute_duration(self):
        previous_durations = self.mapped('duration')
        super()._compute_duration()
        for timer, previous_duration in zip(self, previous_durations):
            if timer.workorder_id.production_id.analytic_account_id:
                timer._create_analytic_entry(previous_duration)

    def _create_analytic_entry(self, previous_duration=0):
        self.ensure_one()
        employee_aal = self.workorder_id.employee_analytic_account_line_ids.filtered(
            lambda line: line.employee_id and line.employee_id == self.employee_id
        )
        duration = (self.duration - previous_duration) / 60.0
        amount = - duration * self.employee_cost
        account = self.workorder_id.production_id.analytic_account_id
        if employee_aal:
            employee_aal.write({
                'unit_amount': employee_aal.unit_amount + duration,
                'amount': employee_aal.amount + amount,
            })
        elif not float_is_zero(amount, precision_rounding=account.currency_id.rounding):
            aa_vals = self.workorder_id._prepare_analytic_line_values(account, duration, amount)
            aa_vals['name'] = _("[EMPL] %s - %s", self.workorder_id.display_name, self.employee_id.name)
            aa_vals['employee_id'] = self.employee_id.id
            self.workorder_id.employee_analytic_account_line_ids = [Command.create(aa_vals)]


class MrpWorkorder(models.Model):
    _inherit = "mrp.workorder"

    employee_analytic_account_line_ids = fields.Many2many('account.analytic.line', copy=False)

    def _compute_duration(self):
        self.filtered(lambda wo: wo.workcenter_id.allow_employee)._create_or_update_analytic_entry()
        super()._compute_duration()
