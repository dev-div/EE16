/** @odoo-module **/

import { registry } from "@web/core/registry";

import { listView } from "@web/views/list/list_view";
import { ListController } from "@web/views/list/list_controller";
import { ListRenderer } from "@web/views/list/list_renderer";


export class BankRecWidgetFormInnerTabAmlsRenderer extends ListRenderer {
    getRowClass(record) {
        const classes = super.getRowClass(record);
        if (this.selectedAmlIDs.includes(record.resId)){
            return `${classes} o_rec_widget_list_selected_item`;
        }
        return classes;
    }

    get selectedAmlIDs() {
        return this.props.bankRecRecord.data.selected_aml_ids.records.map(r => r.data.id);
    }

    async onCellClicked(record, column, ev) {
        if (this.selectedAmlIDs.includes(record.resId)) {
            this.props.bankRecRecord.update({todo_command: `remove_new_aml,${record.resId}`});
        } else {
            this.props.bankRecRecord.update({todo_command: `add_new_amls,${record.resId}`});
        }
    }
}
BankRecWidgetFormInnerTabAmlsRenderer.props = [
    ...ListRenderer.props,
    "bankRecRecord?",
]

export class BankRecWidgetFormInnerTabAmlsController extends ListController {}
BankRecWidgetFormInnerTabAmlsController.template = "account_accountant.BankRecWidgetFormInnerTabAmlsController";
BankRecWidgetFormInnerTabAmlsController.props = {
    ...ListController.props,
    bankRecRecord: { type: Object, optional: true },
}

export class BankRecWidgetFormInnerTabAmlsModel extends listView.Model {
    setup(params, { action, dialog, notification, rpc, user, view, company }) {
        super.setup(...arguments);
        this.storedDomainString = null;
    }
    /**
    * @override
    * the list of AMLs don't need to be fetched from the server every time the form view is re-rendered.
    * this disables the retrieval, while still ensuring that the search bar works.
    */
    async load(params = {}) {
        const currentDomain = params.domain.toString();
        if (currentDomain !== this.storedDomainString) {
            this.storedDomainString = currentDomain;
            return super.load(params);
        }
    }
}

export const BankRecWidgetFormInnerTabAmls = {
    ...listView,
    Controller: BankRecWidgetFormInnerTabAmlsController,
    Renderer: BankRecWidgetFormInnerTabAmlsRenderer,
    Model: BankRecWidgetFormInnerTabAmlsModel,
}

registry.category("views").add("bank_rec_widget_form_amls_list", BankRecWidgetFormInnerTabAmls);
