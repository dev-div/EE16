/** @odoo-module **/

import tour from "web_tour.tour";

tour.register('account_reports_search', {
    test: false,
    url: '/web?#action=account_reports.action_account_report_general_ledger',
},
    [
        {
            content: "click search",
            trigger: '.o_searchview_input',
            run: 'click',
        },
        {
            content: 'insert text in the searchbar',
            trigger: '.o_searchview_input',
            run: 'text 40'
        },
        {
            content: 'test if the product sale line is present',
            trigger: '.account_report_line_name:contains("400000 Product Sales")',
        },
        {
            content: "click search",
            trigger: '.o_searchview_input',
            run: 'click',
        },
        {
            content: 'insert text in the search bar',
            trigger: '.o_searchview_input',
            run: 'text Account'
        },
        {
            content: 'test if the receivable line is present',
            trigger: '.account_report_line_name:contains("121000 Account Receivable")',
        },
        {
            content: 'check that the product sale line is not present',
            trigger: '.account_report_line_name:not(:contains("400000 Product Sales"))',
        },
    ]
);
