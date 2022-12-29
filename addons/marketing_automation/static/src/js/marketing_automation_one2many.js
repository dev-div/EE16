/** @odoo-module */

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { createElement } from "@web/core/utils/xml";
import { useX2ManyCrud, useOpenX2ManyRecord } from "@web/views/fields/relational_utils";
import { X2ManyField } from "@web/views/fields/x2many/x2many_field";
import { KanbanRecord } from "@web/views/kanban/kanban_record";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { KanbanCompiler } from "@web/views/kanban/kanban_compiler";

const { onWillRender, useState, useSubEnv } = owl;
const fieldRegistry = registry.category("fields");

class HierarchyKanbanCompiler extends KanbanCompiler {
    setup() {
        super.setup();
        this.compilers.push({ selector: "HierarchyKanbanRecord", fn: this.compileHierarchyKanbanRecord });
    }
    /**
     * Defining sub components in the arch isn't supported by the framework, which
     * automatically lowercases tagnames s.t. owl doesn't consider them as sub
     * components (e.g. "Div" -> "div"). We thus here need to bypass that mechanism
     * by manually handling the HierarchyKanbanRecord node, until we stop defining
     * it in the arch.
     * @param {Element} el
     * @returns {Element}
     */
    compileHierarchyKanbanRecord(el) {
        const compiled = createElement(el.nodeName);
        for (const attr of el.attributes) {
            compiled.setAttribute(attr.name, attr.value);
        }
        return compiled;
    }
    /**
     * In v16, the hierarchy kanban x2many s use forbidden owl directives (t-on)
     * directly in the arch. In master, they will be removed. We thus temporarily
     * disable the warnings fired when owl directives are used in the arch.
     * @override
     */
    validateNode() {}
}

export class HierarchyKanbanRecord extends KanbanRecord {
    setup() {
        super.setup();

        this.dialogService = useService("dialog");

        if (this.props.is_readonly !== undefined) {
            this.props.readonly = this.props.is_readonly;
        }

        this.state = useState({activeTab: 'graph'});
    }

    /**
     * Simply adds a confirmation prompt when deleting a marketing.activity record that has children
     * activities. Since the ORM will then perform a cascade deletion of children.
     */
    triggerAction(params) {
        const { group, list, record } = this.props;
        const listOrGroup = group || list;
        const { type } = params;

        if (type === "delete" && !listOrGroup.deleteRecords &&
            record.data.children && record.data.children.length !== 0) {
            this.dialogService.add(ConfirmationDialog, {
                body: this.env._t("Deleting this activity will delete ALL its children activities. Are you sure?"),
                confirm: () => super.triggerAction(...arguments),
                cancel: () => {},
            });
        } else {
            super.triggerAction(...arguments);
        }
    }

    //--------------------------------------------------------------------------
    // Business
    //--------------------------------------------------------------------------

    /**
     * Helper method that opens the marketing.activity Form dialog with pre-configured trigger_type
     * and parent_id. Used for the various create buttons on the kanban card footers.
     *
     * @param {String} triggerType the associated marketing.activity#trigger_type
     */
    async addChildActivity(triggerType) {
        await this.props.list.model.root.save({stayInEdition: true});

        const context = {
            default_parent_id: this.props.record.data.id,
            default_trigger_type: triggerType,
        };
        this.env.onAddMarketingActivity({ context });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Allows to switch between the 'graph' and 'filter' tabs of the activity kanban card.
     *
     * @param {MouseEvent} ev
     * @param {String} view the view to enable ('graph' or 'filter')
     */
    onMarketingActivityTabClick(ev, view) {
        ev.stopPropagation();
        this.state.activeTab = view;
    }
}

HierarchyKanbanRecord.Compiler = HierarchyKanbanCompiler;

HierarchyKanbanRecord.components = {
    ...KanbanRecord.components,
    HierarchyKanbanRecord
};

HierarchyKanbanRecord.defaultProps = {
    ...KanbanRecord.defaultProps,
    displayChildren: false,
};

HierarchyKanbanRecord.props = KanbanRecord.props.concat([
    'is_readonly?',
    'displayChildren?',
]);


export class HierarchyKanbanRenderer extends KanbanRenderer {
    setup() {
        super.setup();

        onWillRender(() => {
            if (this.props.list.model.root.data.marketing_activity_ids
                && this.props.list.model.root.data.marketing_activity_ids.records) {
                this.props.list.model.root.data.marketing_activity_ids.records = this._getRecordsWithHierarchy(
                    this.props.list.model.root.data.marketing_activity_ids.records
                );
            }

            if (this.props.list.model.root.data.trace_ids
                && this.props.list.model.root.data.trace_ids.records) {
                this.props.list.model.root.data.trace_ids.records = this._getRecordsWithHierarchy(
                    this.props.list.model.root.data.trace_ids.records
                );
            }
        });
    }

    /**
     * Transforms the record (typically marketing.activities or marketing.traces) to enable
     * parent/children relationship within those records.
     *
     * The data comes 'flat' from the server and this method will create a hierarchy between records
     * by adding a "children" key into the record data containing its children activities.
     *
     * @param {Array<Record>} record
     * @returns {Array<Record>}
     */
    _getRecordsWithHierarchy(records) {
        const parentMap = {};
        const allChildrenIds = [];
        records.forEach((activityRecord) => {
            const parentId = activityRecord.data.parent_id;
            if (parentId) {
                if (!parentMap[parentId[0]]) {
                    parentMap[parentId[0]] = [];
                }

                parentMap[parentId[0]].push(activityRecord);
                allChildrenIds.push(activityRecord.data.id);
            }
        });

        records.forEach((activityRecord) => {
            activityRecord.data.children = parentMap[activityRecord.data.id] || [];
        });

        return records;
    }
}

HierarchyKanbanRenderer.components = {
    ...KanbanRenderer.components,
    KanbanRecord: HierarchyKanbanRecord
};

export class HierarchyKanban extends X2ManyField {
    /**
     * Overrides the "openRecord" method to overload the save.
     *
     * Every time we save a sub-marketing.activity, we want to save the whole marketing.automation
     * record and form view.
     *
     * This allows the end-user to easily chain activities, otherwise he would have to save the
     * enclosing form view in-between each activity addition.
     */
    setup() {
        super.setup();

        const { saveRecord, updateRecord } = useX2ManyCrud(
            () => this.list,
            this.isMany2Many
        );

        const openRecord = useOpenX2ManyRecord({
            resModel: this.list.resModel,
            activeField: this.activeField,
            activeActions: this.activeActions,
            getList: () => this.list,
            saveRecord: async (record) => {
                await saveRecord(record);
                await this.props.record.save({stayInEdition: true});
            },
            updateRecord: updateRecord,
        });
        this._openRecord = openRecord;

        useSubEnv({
            onAddMarketingActivity: this.onAdd.bind(this),
        });
    }

}

fieldRegistry.add("hierarchy_kanban", HierarchyKanban);

HierarchyKanban.components = {
    ...X2ManyField.components,
    KanbanRenderer: HierarchyKanbanRenderer
};
