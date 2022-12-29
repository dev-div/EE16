/** @odoo-module */
import { Field, fieldVisualFeedback } from "@web/views/fields/field";
import { FieldContentOverlay } from "./field_content_overlay";

import { useStudioRef, studioIsVisible } from "@web_studio/client_action/view_editors/utils";

import { useState } from "@odoo/owl";

/*
 * Field:
 * - Displays an Overlay for X2Many fields
 * - handles invisible
 */
export class FieldStudio extends Field {
    setup() {
        super.setup();
        this.state = useState({
            displayOverlay: false,
        });
        useStudioRef("rootRef", this.onClick);
    }
    get fieldComponentProps() {
        const fieldComponentProps = super.fieldComponentProps;
        delete fieldComponentProps.studioXpath;
        delete fieldComponentProps.hasEmptyPlaceholder;
        delete fieldComponentProps.hasLabel;
        delete fieldComponentProps.studioIsVisible;
        return fieldComponentProps;
    }
    get classNames() {
        const classNames = super.classNames;
        classNames["o_web_studio_show_invisible"] = !studioIsVisible(this.props);
        classNames["o-web-studio-editor--element-clickable"] = !!this.props.studioXpath;
        if (!this.props.hasLabel && classNames["o_field_empty"]) {
            delete classNames["o_field_empty"];
            classNames["o_web_studio_widget_empty"] = true;
        }
        return classNames;
    }

    getEmptyPlaceholder() {
        const { hasEmptyPlaceholder, hasLabel, fieldInfo, name, record } = this.props;
        if (hasLabel || !hasEmptyPlaceholder) {
            return false;
        }
        const { empty } = fieldVisualFeedback(this.FieldComponent, record, name, fieldInfo);
        return empty ? record.activeFields[name].string : false;
    }

    isX2ManyEditable(props) {
        const { name, record } = props;
        const field = record.fields[name];
        if (!["one2many", "many2many"].includes(field.type)) {
            return false;
        }
        const activeField = record.activeFields[name];
        if (["many2many_tags", "hr_org_chart"].includes(activeField.widget)) {
            return false;
        }
        return true;
    }

    onEditViewType(viewType) {
        const { name, record, studioXpath } = this.props;
        this.env.config.onEditX2ManyView({ viewType, fieldName: name, record, xpath: studioXpath });
    }

    onClick(ev) {
        if (ev.target.classList.contains("o_web_studio_editX2Many")) {
            return;
        }
        ev.stopPropagation();
        ev.preventDefault();
        this.env.config.onNodeClicked({
            xpath: this.props.studioXpath,
            target: ev.target,
        });
        this.state.displayOverlay = !this.state.displayOverlay;
    }
}
FieldStudio.components = { ...Field.components, FieldContentOverlay };
FieldStudio.template = "web_studio.Field";
