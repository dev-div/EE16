/** @odoo-module */

import { Dialog } from "@web/core/dialog/dialog";

import { Component, useRef } from "@odoo/owl";

export class FieldSelectorDialog extends Component {
    setup() {
        this.selectRef = useRef("select");
    }
    onConfirm() {
        const field = this.selectRef.el.value;
        this.props.onConfirm(field);
        this.props.close();
    }
    onCancel() {
        this.props.close();
    }
}
FieldSelectorDialog.template = "web_studio.FieldSelectorDialog";
FieldSelectorDialog.components = { Dialog };
