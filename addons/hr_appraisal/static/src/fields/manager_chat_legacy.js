odoo.define('hr_appraisal.ManagerChatLegacy', function (require) {
"use strict";

const widgetRegistry = require('web.widget_registry');
const Widget = require('web.Widget');

const ManagerChatLegacy = Widget.extend({
    template: 'hr.OpenChatLegacy',
});

// TODO KBA remove when Studio converted to Owl
widgetRegistry.add('appraisal_manager_chat', ManagerChatLegacy);
});
