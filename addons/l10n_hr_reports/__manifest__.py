# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Croatia - Accounting Reports',
    'icon': '/l10n_hr/static/description/icon.png',
    'version': '1.0',
    'category': 'Accounting/Localizations/Reporting',
    'description': """
        Accounting reports for Croatia (in EURO !)
    """,
    'depends': [
        'l10n_hr_euro', 'account_reports'
    ],
    'data': [
        'data/balance_sheet.xml',
        'data/profit_loss.xml',
    ],
    'installable': True,
    'auto_install': ['l10n_hr_euro', 'account_reports'],
    'website': 'https://www.odoo.com/app/accounting',
    'license': 'OEEL-1',
}
