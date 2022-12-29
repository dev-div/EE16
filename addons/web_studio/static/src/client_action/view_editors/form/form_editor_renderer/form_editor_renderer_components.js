/** @odoo-module */

import { formView } from "@web/views/form/form_view";
import { StudioHook } from "@web_studio/client_action/view_editors/components/studio_hook_component";
import { FieldSelectorDialog } from "@web_studio/client_action/view_editors/components/field_selector_dialog";
import { studioIsVisible, useStudioRef } from "@web_studio/client_action/view_editors/utils";
import { useService } from "@web/core/utils/hooks";

import { Component } from "@odoo/owl";

/**
 * Overrides and extensions of components used by the FormRenderer
 * As a rule of thumb, elements should be able to handle the props
 * - studioXpath: the xpath to the node in the form's arch to which the component
 *   refers
 * - They generally be clicked on to change their characteristics (in the Sidebar)
 * - The click doesn't trigger default behavior (the view is inert)
 * - They can be draggable (FormLabel referring to a field)
 * - studioIsVisible: all components whether invisible or not, are compiled and rendered
 *   this props allows to toggle the class o_invisible_modifier
 * - They can have studio hooks, that are placeholders for dropping content (new elements, field, or displace elements)
 */

const components = formView.Renderer.components;

/*
 * FormLabel:
 * - Can be draggable if in InnerGroup
 */
export class FormLabel extends components.FormLabel {
    setup() {
        super.setup();
        useStudioRef("rootRef", this.onClick);
    }
    get className() {
        let className = super.className;
        if (!studioIsVisible(this.props)) {
            className += " o_web_studio_show_invisible";
        }
        className += " o-web-studio-editor--element-clickable";
        return className;
    }
    onClick(ev) {
        ev.preventDefault();
        this.env.config.onNodeClicked({
            xpath: this.props.studioXpath,
            target: ev.target,
        });
    }
}
FormLabel.template = "web_studio.FormLabel";

/*
 * Notebook:
 * - Display every page, the elements in the page handle whether they are invisible themselves
 * - Push a droppable hook on every empty page
 * - Can add a new page
 */
export class Notebook extends components.Notebook {
    computePages(props) {
        const pages = super.computePages(props);
        pages.forEach((p) => {
            p[1].studioIsVisible = p[1].isVisible;
            p[1].isVisible = p[1].isVisible || this.env.config.studioShowInvisible;
        });
        return pages;
    }
    onNewPageClicked() {
        this.env.config.structureChange({
            type: "add",
            structure: "page",
            position: "inside",
            xpath: this.props.studioXpath,
        });
    }
}
Notebook.template = "web_studio.Notebook.Hook";
Notebook.components = { ...components.Notebook.components, StudioHook };
Notebook.props = {
    ...components.Notebook.props,
    studioIsVisible: { type: Boolean, optional: true },
    studioXpath: String,
};

export class StatusBarFieldHook extends Component {
    onClick() {
        this.env.config.onViewChange({
            add_statusbar: this.props.add_statusbar,
            type: "add",
            structure: "field",
            field_description: {
                field_description: "Pipeline status bar",
                type: "selection",
                selection: [
                    ["status1", this.env._t("First Status")],
                    ["status2", this.env._t("Second Status")],
                    ["status3", this.env._t("Third Status")],
                ],
                default_value: true,
            },
            target: {
                tag: "header",
            },
            new_attrs: {
                widget: "statusbar",
                options: "{'clickable': '1'}",
            },
            position: "inside",
        });
    }
}
StatusBarFieldHook.template = "web_studio.StatusBarFieldHook";

export class AvatarHook extends Component {
    setup() {
        this.dialogService = useService("dialog");
    }
    onClick() {
        const fields = [];
        for (const field of Object.values(this.props.fields)) {
            if (field.type === "binary") {
                fields.push(field);
            }
        }
        this.dialogService.add(FieldSelectorDialog, {
            fields,
            showNew: true,
            onConfirm: (field) => {
                this.env.config.onViewChange({
                    structure: "avatar_image",
                    field,
                });
            },
        });
    }
}
AvatarHook.template = "web_studio.AvatarHook";
AvatarHook.props = { fields: Object, class: { type: String, optional: true } };

export class ButtonHook extends Component {
    onClick() {
        this.env.config.onViewChange({
            structure: "button",
            type: "add",
            add_buttonbox: this.props.add_buttonbox,
        });
    }
}
ButtonHook.template = "web_studio.ButtonHook";

export class ButtonBox extends components.ButtonBox {
    getButtons() {
        const maxVisibleButtons = this.getMaxButtons();
        const visible = [];
        const additional = [];
        for (const [slotName, slot] of Object.entries(this.props.slots)) {
            if (this.env.config.studioShowInvisible || !("isVisible" in slot) || slot.isVisible) {
                if (visible.length >= maxVisibleButtons) {
                    additional.push(slotName);
                } else {
                    visible.push(slotName);
                }
            }
        }
        return { visible, additional };
    }
}

ButtonBox.props = {
    ...components.ButtonBox.props,
    studioIsVisible: { type: Boolean, optional: true },
};
