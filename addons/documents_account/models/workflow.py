# -*- coding: utf-8 -*-
from odoo import models, fields, api, exceptions
from odoo.tests.common import Form


class WorkflowActionRuleAccount(models.Model):
    _inherit = ['documents.workflow.rule']

    create_model = fields.Selection(selection_add=[('account.move.in_invoice', "Vendor bill"),
                                                   ('account.move.out_invoice', 'Customer invoice'),
                                                   ('account.move.in_refund', 'Vendor Credit Note'),
                                                   ('account.move.out_refund', "Credit note")])

    def create_record(self, documents=None):
        rv = super(WorkflowActionRuleAccount, self).create_record(documents=documents)
        if self.create_model.startswith('account.move'):
            invoice_type = self.create_model.split('.')[2]
            new_obj = None
            invoice_ids = []
            for document in documents:
                doc_res_id = document.res_id
                doc_res_model = document.res_model
                if doc_res_model == 'account.move' and doc_res_id:
                    new_obj = self.env['account.move'].browse(document.res_id)
                    if new_obj.statement_line_id:
                        new_obj.suspense_statement_line_id = new_obj.statement_line_id.id
                    invoice_ids.append(new_obj.id)
                    continue
                new_obj = self.env['account.journal'].with_context(default_move_type=invoice_type)._create_document_from_attachment(attachment_ids=document.attachment_id.id)
                if doc_res_model == 'account.move.line' and doc_res_id:
                    new_obj.document_request_line_id = doc_res_id
                partner = self.partner_id or document.partner_id
                if partner:
                    new_obj.partner_id = partner
                    new_obj._onchange_partner_id()
                # the 'no_document' key in the context indicates that this ir_attachment has already a
                # documents.document and a new document shouldn't be automatically generated.
                document.attachment_id.with_context(no_document=True).write({
                    'res_model': 'account.move',
                    'res_id': new_obj.id,
                })
                invoice_ids.append(new_obj.id)

            context = dict(self._context, default_move_type=invoice_type)
            action = {
                'type': 'ir.actions.act_window',
                'res_model': 'account.move',
                'name': "Invoices",
                'view_id': False,
                'view_mode': 'tree',
                'views': [(False, "list"), (False, "form")],
                'domain': [('id', 'in', invoice_ids)],
                'context': context,
            }
            if len(invoice_ids) == 1:
                record = new_obj or self.env['account.move'].browse(invoice_ids[0])
                view_id = record.get_formview_id() if record else False
                action.update({
                    'view_mode': 'form',
                    'views': [(view_id, "form")],
                    'res_id': invoice_ids[0],
                    'view_id': view_id,
                })
            return action
        return rv
