/** @odoo-module */

import { kanbanView } from "@web/views/kanban/kanban_view";

import { KanbanEditorCompiler } from "@web_studio/client_action/view_editors/kanban/kanban_editor_compiler";
import { FieldStudio } from "@web_studio/client_action/view_editors/components/field_studio";
import { WidgetStudio } from "@web_studio/client_action/view_editors/components/widget_studio";
import { ViewButtonStudio } from "@web_studio/client_action/view_editors/components/view_button_studio";
import { StudioHook } from "@web_studio/client_action/view_editors/components/studio_hook_component";
import { FieldSelectorDialog } from "@web_studio/client_action/view_editors/components/field_selector_dialog";

import {
    cleanHooks,
    hookPositionTolerance,
    getHooks,
} from "@web_studio/client_action/view_editors/utils";
import { nodeStudioXpathSymbol } from "@web_studio/client_action/view_editors/xml_utils";
import { closest, touching } from "@web/core/utils/ui";
import { useService } from "@web/core/utils/hooks";
import { AlertDialog, ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

import { Component, xml, useEffect, useRef, onError } from "@odoo/owl";

class FieldStudioKanbanRecord extends FieldStudio {
    isX2ManyEditable() {
        return false;
    }
}

const OriginDropdown = kanbanView.Renderer.components.KanbanRecord.components.Dropdown;
class Dropdown extends OriginDropdown {
    setup() {
        super.setup();
        const rootRef = useRef("root");
        this.rootRef = rootRef;
        useEffect(
            (rootEl) => {
                rootEl.classList.add("o-web-studio-editor--element-clickable");
                if (this.props.hasCoverSetter) {
                    rootEl.dataset.hasCoverSetter = true;
                }
            },
            () => [rootRef.el]
        );
    }

    onTogglerClick() {
        this.env.config.onNodeClicked({ target: this.rootRef.el, xpath: this.props.studioXpath });
    }
}
Dropdown.template = "web_studio.KanbanEditorRecord.Dropdown";
Dropdown.props = {
    ...OriginDropdown.props,
    studioXpath: { type: String, optional: 1 },
    hasCoverSetter: { type: Boolean, optional: 1 },
};

const KanbanRecord = kanbanView.Renderer.components.KanbanRecord;
class SafeKanbanRecord extends KanbanRecord {
    setup() {
        super.setup();
        this.studioHasError = false;
        onError((error) => {
            if (this.studioHasError) {
                throw error;
            }

            try {
                this.env.config.handleRenderingError(error);
            } catch {
                this.studioHasError = true;
                this.render(true);
            }
        });
    }
}
SafeKanbanRecord.template = "web_studio.SafeKanbanRecord";

class _KanbanEditorRecord extends KanbanRecord {
    setup() {
        super.setup();
        this.dialogService = useService("dialog");
        this.studioHasError = false;
        onError((error) => {
            if (this.studioHasError) {
                throw error;
            }

            try {
                this.env.config.handleRenderingError(error);
            } catch {
                this.studioHasError = true;
                this.render(true);
            }
        });

        useEffect(
            (el) => {
                if (!el) {
                    return;
                }
                el.classList.remove("oe_kanban_global_click", "oe_kanban_global_click_edit");
            },
            () => [this.rootRef.el]
        );

        const highlightNearestHook = (draggedEl, { x, y }) => {
            cleanHooks(this.rootRef.el);

            const mouseToleranceRect = {
                x: x - hookPositionTolerance,
                y: y - hookPositionTolerance,
                width: hookPositionTolerance * 2,
                height: hookPositionTolerance * 2,
            };

            const touchingEls = touching(getHooks(this.rootRef.el), mouseToleranceRect);
            const closestHookEl = closest(touchingEls, { x, y });

            if (!closestHookEl) {
                return false;
            }

            closestHookEl.classList.add("o_web_studio_nearest_hook");
            return true;
        };
        this.env.config.registerCallback("highlightNearestHook", highlightNearestHook);
    }

    onGlobalClick() {}

    onGlobalClickCapture(ev) {
        const target = ev.target;
        if (target.closest(".o-web-studio-editor--element-clickable")) {
            return;
        }
        const editorAddFeaturesClasses = [
            "o_web_studio_add_kanban_tags",
            "o_web_studio_add_dropdown",
            "o_web_studio_add_priority",
            "o_web_studio_add_kanban_image",
        ];
        if (editorAddFeaturesClasses.some((c) => target.classList.contains(c))) {
            return;
        }
        ev.stopPropagation();
    }

    isFieldValueEmpty(value) {
        if (value === null) {
            return true;
        }
        if (Array.isArray(value)) {
            return !value.length;
        }
        return !value;
    }

    onAddTagsWidget({ xpath }) {
        const fields = [];
        for (const [fName, field] of Object.entries(this.props.record.fields)) {
            if (field.type === "many2many") {
                const _field = { ...field, name: fName };
                fields.push(_field);
            }
        }

        if (!fields.length) {
            this.dialogService.add(AlertDialog, {
                body: this.env._t("You first need to create a many2many field in the form view."),
            });
            return;
        }

        this.dialogService.add(FieldSelectorDialog, {
            fields,
            onConfirm: (field) => {
                this.env.config.onViewChange({
                    type: "add",
                    structure: "field",
                    new_attrs: { name: field },
                    node: {
                        attrs: {
                            [nodeStudioXpathSymbol]: xpath,
                        },
                    },
                    position: "inside",
                });
            },
        });
    }

    onAddDropdown() {
        this.dialogService.add(ConfirmationDialog, {
            body: this.env._t("Do you want to add a dropdown with colors?"),
            confirm: () => {
                this.env.config.onViewChange({
                    structure: "kanban_dropdown",
                });
            },
        });
    }

    onAddPriority() {
        const fields = [];
        for (const [fName, field] of Object.entries(this.props.record.fields)) {
            if (field.type === "selection") {
                const _field = { ...field, name: fName };
                fields.push(_field);
            }
        }
        this.dialogService.add(FieldSelectorDialog, {
            fields,
            showNew: true,
            onConfirm: (field) => {
                this.env.config.onViewChange({
                    structure: "kanban_priority",
                    field,
                });
            },
        });
    }

    onAddAvatar() {
        const fields = [];
        for (const [fName, field] of Object.entries(this.props.record.fields)) {
            if (
                field.type === "many2one" &&
                (field.relation === "res.partner" || field.relation === "res.users")
            ) {
                const _field = { ...field, name: fName };
                fields.push(_field);
            }
        }
        this.dialogService.add(FieldSelectorDialog, {
            fields,
            onConfirm: (field) => {
                this.env.config.onViewChange({
                    structure: "kanban_image",
                    field,
                });
            },
        });
    }
}
_KanbanEditorRecord.components = {
    ...KanbanRecord.components,
    Dropdown,
    Field: FieldStudioKanbanRecord,
    Widget: WidgetStudio,
    StudioHook,
    ViewButton: ViewButtonStudio,
};
_KanbanEditorRecord.template = "web_studio.SafeKanbanRecordEditor";

export class KanbanEditorRecord extends Component {
    get KanbanRecord() {
        if (!this.env.config.isStudioInEdition) {
            return SafeKanbanRecord;
        } else {
            return _KanbanEditorRecord;
        }
    }
    get kanbanRecordProps() {
        const props = { ...this.props };
        if (this.env.config.isStudioInEdition) {
            props.Compiler = KanbanEditorCompiler;
        }
        return props;
    }
}
KanbanEditorRecord.template = xml`<t t-component="KanbanRecord" t-props="kanbanRecordProps" />`;
