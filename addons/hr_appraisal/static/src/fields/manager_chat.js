/** @odoo-module */

import { registry } from '@web/core/registry';
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

import { useOpenChat } from "@mail/views/open_chat_hook";

const { Component } = owl;

export class AppraisalManagerChat extends Component {
    setup() {
        super.setup();
        this.openChat = useOpenChat('hr.employee');
    }
}
AppraisalManagerChat.props = {
    ...standardWidgetProps,
};
AppraisalManagerChat.template = 'hr_appraisal.ManagerChat';

registry.category("view_widgets").add("appraisal_manager_chat", AppraisalManagerChat);
