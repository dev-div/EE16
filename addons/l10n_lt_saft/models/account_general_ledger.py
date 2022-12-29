# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import io
import re

from odoo import api, fields, models, tools, _


class GeneralLedgerCustomHandler(models.AbstractModel):
    _inherit = 'account.general.ledger.report.handler'

    def _custom_options_initializer(self, report, options, previous_options=None):
        super()._custom_options_initializer(report, options, previous_options)
        if self.env.company.account_fiscal_country_id.code == 'LT':
            options.setdefault('buttons', []).append({
                'name': _('SAF-T'),
                'sequence': 50,
                'action': 'export_file',
                'action_param': 'l10n_lt_export_saft_to_xml',
                'file_export_type': _('XML')
            })

    @api.model
    def _l10n_lt_saft_prepare_report_values(self, report, options):
        template_vals = report._saft_prepare_report_values(options)

        # The lithuanian version of the SAF-T requires account code to be provided along with the opening/closing
        # credit/debit of customers and suppliers
        accounts_by_partners = self._l10n_lt_saft_get_partners_accounts(report, options)

        for partner_vals in template_vals['customer_vals_list'] + template_vals['supplier_vals_list']:
            partner_id = partner_vals['partner'].id
            if partner_id in accounts_by_partners:
                partner_vals['accounts'] = list(accounts_by_partners[partner_id].values())

        # The owners also need account codes
        template_vals['owner_accounts'] = self._l10n_lt_saft_get_owner_accounts()

        template_vals.update({
            # Special LT SAF-T date format: YYYY-MM-DDThh:mm:ss
            'today_str': fields.datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
            'xmlns': 'https://www.vmi.lt/cms/saf-t',
            'file_version': '2.01',
            'accounting_basis': 'K',  # K (accrual - when recorded) or P (cash - when received)
            'entity': "COMPANY",
            'nb_of_parts': 1,
            'part_nb': 1,
        })
        return template_vals

    def _l10n_lt_saft_get_owner_accounts(self):
        """Retrieve the account codes for every owners' account.
        Owners' account can be identified by their tag, i.e. account_account_tag_d_1_3

        :rtype: str
        :return: a string of the account codes, comma separated, for instance "303, 305, 308"
        """
        tag_id = self.env.ref('l10n_lt.account_account_tag_d_1_3').id
        owner_accounts = self.env["account.account"].search([('tag_ids', 'in', tag_id)])
        return ", ".join([account.code for account in owner_accounts])

    def _l10n_lt_saft_get_partners_accounts(self, report, options):
        """Retrieve the accounts used for transactions with the different partners (customer/supplier).

        The Lithuanian regulation (based on xsd file) requires a list of accounts for every partner, with starting and closing balances.
        The partner ledger in Odoo provides starting and closing balance for every partner, but it is account insensitive.
        So it is needed to fetch account lines in order to compute all of this, on account/partner basis.

        :rtype: dict
        :return: dictionary of partners' accounts with the account code and its opening/closing balance
        """
        date_from = fields.Date.to_date(options['date']['date_from'])
        date_to = fields.Date.to_date(options['date']['date_to'])
        # Fetch data from beginning
        tables, where_clause, where_params = report._query_get(options, 'from_beginning')
        # The balance dating from earlier periods are computed as opening
        # The balance up to the end of the current period are computed as closing
        self._cr.execute(f'''
            SELECT DISTINCT
                account_move_line.partner_id,
                account.code,
                CASE WHEN account_move_line.date < '{date_from}' THEN SUM(account_move_line.balance) ELSE 0 END AS opening_balance,
                CASE WHEN account_move_line.date <= '{date_to}'  THEN SUM(account_move_line.balance) ELSE 0 END AS closing_balance
            FROM {tables}
            JOIN account_account account ON account.id = account_move_line.account_id
            WHERE {where_clause}
            AND account.account_type IN ('asset_receivable', 'liability_payable')
            GROUP BY account_move_line.partner_id, account.code, account_move_line.date
        ''', where_params)

        partners_accounts = {}
        for vals in self._cr.dictfetchall():
            partner_id = vals['partner_id']
            account_code = vals['code']
            partner_account_code_balances = partners_accounts.setdefault(partner_id, {}).setdefault(account_code, {
                'code': account_code,
                'opening_balance': 0,
                'closing_balance': 0,
            })
            partner_account_code_balances['opening_balance'] += vals['opening_balance']
            partner_account_code_balances['closing_balance'] += vals['closing_balance']

        return partners_accounts

    @api.model
    def l10n_lt_export_saft_to_xml(self, options):
        report = self.env['account.report'].browse(options['report_id'])
        template_vals = self._l10n_lt_saft_prepare_report_values(report, options)
        content = self.env['ir.qweb']._render('l10n_lt_saft.saft_template_inherit_l10n_lt_saft', template_vals)

        self.env['ir.attachment'].l10n_lt_saft_validate_xml_from_attachment(content, 'xsd_lt_saft.xsd')

        xsd_attachment = self.env['ir.attachment'].search([('name', '=', 'xsd_cached_SAF-T_v2_01_20190306_xsd')])
        if xsd_attachment:
            with io.BytesIO(base64.b64decode(xsd_attachment.with_context(bin_size=False).datas)) as xsd:
                tools.xml_utils._check_with_xsd(content, xsd)
        return {
            'file_name': report.get_default_report_filename('xml'),
            'file_content': "\n".join(re.split(r'\n\s*\n', content)).encode(),
            'file_type': 'xml',
        }


class AccountGeneralLedger(models.AbstractModel):
    _inherit = "account.report"

    def _saft_get_account_type(self, account):
        # OVERRIDE account_saft/models/account_general_ledger
        if self.env.company.account_fiscal_country_id.code != 'LT':
            return super()._saft_get_account_type(account)

        # LT saf-t account types have to be identified as follows:
        # "IT" (Non-current assets), "TT" (Current assets), "NK" (Equity), "I" (Liabilities), "P" (Income), "S" (Costs), "KT" (Other)
        account_type_dict = {  # map between the account_types and the LT saf-t equivalent
            'asset_non_current': 'IT',
            'asset_fixed': 'IT',
            'asset_receivable': 'TT',
            'asset_cash': 'TT',
            'asset_current': 'TT',
            'asset_prepayments': 'TT',
            'equity': 'NK',
            'equity_unaffected': 'NK',
            'liability_payable': 'I',
            'liability_credit_card': 'I',
            'liability_current': 'I',
            'liability_non_current': 'I',
            'income': 'P',
            'income_other': 'P',
            'expense': 'S',
            'expense_depreciation': 'S',
            'expense_direct_cost': 'S',
            'off_balance': 'KT',
        }
        return account_type_dict[account.account_type] or 'KT'
