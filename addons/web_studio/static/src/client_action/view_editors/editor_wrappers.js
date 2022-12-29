/** @odoo-module */
import { ComponentWrapper } from "web.OwlCompatibility";
import { mapActiveFieldsToFieldsInfo } from "@web/views/legacy_utils";
import { OPTIONS_BY_WIDGET } from "@web_studio/legacy/js/views/view_editor_sidebar";

import { registry } from "@web/core/registry";

function isVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== "none";
}

function addDefaultWidgetsOptionsValues(fieldsInfo) {
    for (const viewInfo of Object.values(fieldsInfo)) {
        const _fieldsInfo = Object.values(viewInfo).filter((f) => f.widget in OPTIONS_BY_WIDGET);
        for (const fieldInfo of _fieldsInfo) {
            const missingOptions = OPTIONS_BY_WIDGET[fieldInfo.widget].filter(
                ({ name }) => !(name in fieldInfo.options)
            );
            for (const option of missingOptions) {
                fieldInfo.options[option.name] = option.default;
            }
        }
    }
}

class BasicEditorWrapper extends ComponentWrapper {
    setup() {
        super.setup();
        const handleError = this.app.handleError.bind(this.app);
        this.app.handleError = (...args) => {
            try {
                handleError(...args);
            } catch {
                // An error when no sub-tree handleError is triggered
                // It basically means that we let the error pass through
                // and end up rejecting the different promises.
            }
        };
        const { archInfo, fields } = this.props.controllerProps;
        const { activeFields } = archInfo;
        const fieldsInfo = mapActiveFieldsToFieldsInfo(
            activeFields,
            fields,
            this.env.config.type,
            this.env
        );
        addDefaultWidgetsOptionsValues(fieldsInfo);

        for (const fInfo of Object.values(fieldsInfo[this.env.config.type])) {
            fInfo.FieldComponent = fInfo.__WOWL_FIELD_DESCR__.FieldComponent;
        }

        this.state = {
            fieldsInfo,
            getFieldNames: () => {
                return Object.keys(activeFields);
            },
            viewType: this.env.config.type,
        };
    }
    getLocalState() {
        return {
            lastClickedXpath: this.lastClickedXpath || null,
        };
    }
    setLastClickedXpath(lastClickedXpath) {
        this.lastClickedXpath = lastClickedXpath || null;
    }
    setLocalState(state = {}) {
        this.lastClickedXpath = state.lastClickedXpath || null;
        if (!this.el) {
            return;
        }

        const lastClickedXpath = this.lastClickedXpath;
        this.unselectedElements();

        if (lastClickedXpath) {
            const el = this.el.querySelector(`[data-studio-xpath="${lastClickedXpath}"]`);
            if (el && isVisible(el)) {
                this.env.config.onNodeClicked({
                    xpath: lastClickedXpath,
                    target: el,
                });
                //////////////////
                // factorize code!
                el.closest(".o-web-studio-editor--element-clickable").classList.add(
                    "o-web-studio-editor--element-clicked"
                );
                ///////////////
                return;
            }
            this.props.resetSidebar();
        }
    }
    unselectedElements() {
        this.lastClickedXpath = null;
        this.el.querySelectorAll(".o-web-studio-editor--element-clicked").forEach((el) => {
            el.classList.remove("o-web-studio-editor--element-clicked");
        });
    }
    handleDrop() {}
    highlightNearestHook($helper, position) {
        const draggedEl = $helper[0];
        const studioStructure = $helper.data("structure");
        const pos = { x: position.pageX, y: position.pageY };
        draggedEl.dataset.studioStructure = studioStructure;
        return this.env.config.executeCallback("highlightNearestHook", draggedEl, pos);
    }
    setSelectable() {}
    selectField(fName) {
        this.env.config.executeCallback("selectField", fName);
    }
}
registry.category("wowl_editors_wrappers").add("form", BasicEditorWrapper);
registry.category("wowl_editors_wrappers").add("kanban", BasicEditorWrapper);

class ListEditorWrapper extends BasicEditorWrapper {
    setup() {
        super.setup();
        const { columns } = this.props.controllerProps.archInfo;

        const colFieldInfo = {};
        for (const col of columns) {
            if (col.type === "field") {
                colFieldInfo[col.name] = col;
            }
        }

        const listFieldsInfo = this.state.fieldsInfo["list"];
        for (const fName of Object.keys(listFieldsInfo)) {
            const fInfo = { ...listFieldsInfo[fName] };
            const { rawAttrs } = colFieldInfo[fName] || {};
            listFieldsInfo[fName] = {
                ...(rawAttrs || {}),
                ...fInfo,
                ...colFieldInfo[fName],
            };
        }
    }

    setLocalState(state = {}) {
        this.lastClickedXpath = state.lastClickedXpath || null;
        if (!this.el) {
            return;
        }

        const lastClickedXpath = this.lastClickedXpath;
        this.unselectedElements();

        if (lastClickedXpath) {
            const el = this.el.querySelector(
                `th[data-studio-xpath="${lastClickedXpath}"], button[data-studio-xpath="${lastClickedXpath}"]`
            );
            if (el && isVisible(el)) {
                el.click();
                return;
            }
            this.props.resetSidebar();
        }
    }
}
registry.category("wowl_editors_wrappers").add("list", ListEditorWrapper);
