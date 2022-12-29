/** @odoo-module */
import { kanbanView } from "@web/views/kanban/kanban_view";
import { KanbanEditorRecord } from "@web_studio/client_action/view_editors/kanban/kanban_editor_record";
import {
    useStudioClickedElements,
    useLegacyOnDropElement,
} from "@web_studio/client_action/view_editors/utils";

import { useRef, useEffect } from "@odoo/owl";

export class KanbanEditorRenderer extends kanbanView.Renderer {
    setup() {
        super.setup();
        const rootRef = useRef("root");
        useStudioClickedElements(rootRef);

        const onLegacyDropped = useLegacyOnDropElement(rootRef, (values) => {
            values.new_attrs.display = "full";
            this.env.config.structureChange(values);
        });

        useEffect(
            (el) => {
                if (!el) {
                    return;
                }
                el.classList.add("o_web_studio_kanban_view_editor");
                // FIXME: legacy: interoperability with legacy studio components
                $(el).droppable({
                    accept: ".o_web_studio_component",
                    drop: onLegacyDropped,
                });
                return () => {
                    $(el).droppable("destroy");
                };
            },
            () => [rootRef.el]
        );
    }

    get canUseSortable() {
        return false;
    }

    get showNoContentHelper() {
        return false;
    }

    getGroupsOrRecords() {
        const { list } = this.props;
        const groupsOrRec = super.getGroupsOrRecords(...arguments);
        if (list.isGrouped) {
            return [groupsOrRec.filter((el) => el.group.list.records.length)[0]];
        } else {
            return [groupsOrRec[0]];
        }
    }

    canCreateGroup() {
        return false;
    }

    getGroupUnloadedCount() {
        return 0;
    }
}
KanbanEditorRenderer.template = "web_studio.KanbanEditorRenderer";
KanbanEditorRenderer.components = {
    ...kanbanView.Renderer.components,
    KanbanRecord: KanbanEditorRecord,
};
