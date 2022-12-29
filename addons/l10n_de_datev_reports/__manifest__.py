# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Germany - DateV Export',
    'version': '1.0',
    'category': 'Accounting/Localizations/Reporting',
    'description': """
        This module serves to provide the possibility to define two identifiers
        on partners: one for customer and one for supplier, used for the DateV export
    """,
    'depends': [
        'l10n_de_reports',
    ],
    'data': [
        'views/res_partner_views.xml',
        'views/res_config_settings_view.xml',
    ],
    'installable': True,
    'auto_install': True,
    'application': False,
    'license': 'OEEL-1',
}
