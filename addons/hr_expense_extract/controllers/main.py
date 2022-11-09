# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request


class HrExpenseExtractController(http.Controller):
    @http.route('/hr_expense_extract/request_done/<int:extract_remote_id>', type='http', auth='public', csrf=False)
    def request_done(self, extract_remote_id):
        """ This webhook is called when the extraction server is done processing a request."""
        expense_to_update = request.env['hr.expense'].sudo().search([
            ('extract_remote_id', '=', extract_remote_id),
            ('extract_state', 'in', ['waiting_extraction', 'extract_not_ready']),
            ('state', '=', 'draft')])
        for expense in expense_to_update:
            expense._check_status()
        return 'OK'
