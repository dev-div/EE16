odoo.define('website_helpdesk.form', function (require) {
'use strict';

var core = require('web.core');
var FormEditorRegistry = require('website.form_editor_registry');

var _t = core._t;

FormEditorRegistry.add('create_ticket', {
    formFields: [{
        type: 'char',
        required: true,
        name: 'partner_name',
        fillWith: 'name',
        string: _t('Your Name'),
    }, {
        type: 'email',
        required: true,
        name: 'partner_email',
        fillWith: 'email',
        string: _t('Your Email'),
    }, {
        type: 'char',
        modelRequired: true,
        name: 'name',
        string: _t('Subject'),
    }, {
        type: 'char',
        name: 'description',
        string: _t('Description'),
    }, {
        type: 'binary',
        custom: true,
        name: _t('Attachment'),
    }],
    fields: [{
        name: 'team_id',
        type: 'many2one',
        relation: 'helpdesk.team',
        string: _t('Helpdesk Team'),
    }],
    successPage: '/your-ticket-has-been-submitted',
});

});
