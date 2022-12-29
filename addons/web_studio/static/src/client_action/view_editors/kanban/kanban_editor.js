/** @odoo-module */
import { registry } from "@web/core/registry";
import { omit } from "@web/core/utils/objects";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { KanbanEditorRenderer } from "@web_studio/client_action/view_editors/kanban/kanban_editor_renderer";
import { makeModelErrorResilient } from "@web_studio/client_action/view_editors/utils";

class EditorArchParser extends kanbanView.ArchParser {
    parse(arch, models, modelName) {
        const parsed = super.parse(...arguments);
        const noFetchFields = Object.entries(parsed.fieldNodes).filter(
            ([fname, field]) => field.rawAttrs && field.rawAttrs.studio_no_fetch
        ).map(f => f[0]);
        parsed.fieldNodes = omit(parsed.fieldNodes, ...noFetchFields);
        parsed.activeFields = omit(parsed.activeFields, ...noFetchFields);
        return parsed;
    }
}
class OneRecordModel extends kanbanView.Model {
    async load() {
        this.progressAttributes = false;
        await super.load(...arguments);
        let list = this.root;
        let hasRecords;
        const isGrouped = list.isGrouped;
        if (!isGrouped) {
            hasRecords = list.records.length;
        } else {
            hasRecords = list.groups.some((g) => g.list.records.length);
        }
        if (!hasRecords) {
            if (isGrouped) {
                const params = {
                    ...list.commonGroupParams,
                    isFolded: false,
                    count: 0,
                    value: "",
                    displayName: "",
                    aggregates: {},
                    groupByField: list.groupByField,
                    groupDomain: [],
                    rawContext: list.rawContext,
                };
                if (["date", "datetime"].includes(list.groupByField.type)) {
                    params.range = {};
                }
                const group = this.createDataPoint("group", params);
                list.groups.push(group);

                list = group.list;
            }
            await list.createRecord();
            list.editedRecord = null;
        }
    }
}

const kanbanEditor = {
    ...kanbanView,
    ArchParser: EditorArchParser,
    Renderer: KanbanEditorRenderer,
    Model: OneRecordModel,
    props(genericProps, editor, config) {
        const props = kanbanView.props(genericProps, editor, config);
        props.defaultGroupBy = props.archInfo.defaultGroupBy;
        props.Model = makeModelErrorResilient(OneRecordModel);
        props.limit = 1;
        props.Renderer = KanbanEditorRenderer;
        return props;
    },
};
registry.category("studio_editors").add("kanban", kanbanEditor);
