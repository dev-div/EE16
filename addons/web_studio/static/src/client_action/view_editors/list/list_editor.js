/** @odoo-module */
import { listView } from "@web/views/list/list_view";
import { computeXpath } from "../xml_utils";
import { registry } from "@web/core/registry";
import { omit } from "@web/core/utils/objects";

import { ListEditorRenderer } from "./list_editor_renderer";
import { RelationalModel } from "@web/views/relational_model";

import { Component, xml } from "@odoo/owl";

function parseStudioGroups(node) {
    if (node.hasAttribute("studio_groups")) {
        return node.getAttribute("studio_groups");
    }
}

class EditorArchParser extends listView.ArchParser {
    isColumnVisible() {
        return true;
    }

    parse(arch, models, modelName) {
        const parsed = super.parse(...arguments);
        const noFetchFields = Object.entries(parsed.fieldNodes).filter(
            ([fname, field]) => field.rawAttrs && field.rawAttrs.studio_no_fetch
        ).map(f => f[0]);
        parsed.fieldNodes = omit(parsed.fieldNodes, ...noFetchFields);
        parsed.activeFields = omit(parsed.activeFields, ...noFetchFields);
        parsed.columns = parsed.columns.filter(field => !noFetchFields.includes(field.name));
        return parsed;
    }

    parseFieldNode(node, models, modelName) {
        const parsed = super.parseFieldNode(...arguments);
        parsed.studioXpath = computeXpath(node, "list, tree");
        parsed.studio_groups = parseStudioGroups(node);
        return parsed;
    }

    parseWidgetNode(node, models, modelName) {
        const parsed = super.parseWidgetNode(...arguments);
        parsed.studioXpath = computeXpath(node, "list, tree");
        parsed.studio_groups = parseStudioGroups(node);
        return parsed;
    }

    processButton(node) {
        const parsed = super.processButton(node);
        if (!node.closest("header")) {
            parsed.studioXpath = computeXpath(node, "list, tree");
            parsed.studio_groups = parseStudioGroups(node);
        }
        return parsed;
    }
}

/**
 * X2Many fields can have their subview edited. There are some challenges currently with the RelationalModel
 * - We need to inject the context of the parent record from the outside. That way, within the subview's arch
 *   a snippet like `<field name="..." invisible="[['parent.id','=',False]]" />` works.
 * - We already know the resIds we have, since we are coming from a x2m. There is no need to search_read them, just to read them
 * - The RelationalModel doesn't really supports creatic staticLists as the root record
 *
 * StaticList supports the two first needs and not DynamicList, we assume that the amount of hacking
 * would be slightly bigger if our starting point is DynamicList. Hence, we choose
 * to extend StaticList instead of DynamicList, and make it the root record of the model.
 */
function modelUsesParentRecord(model, parentRecord, resIds) {
    if (!(model instanceof RelationalModel)) {
        throw new Error("The model instance is not of the right type to accept a parent record.");
    }
    model.rootType = "static_list";
    // eval right away to avoid keeping the parentRecord in the closure;
    const parentEvalContext = parentRecord.evalContext;
    model.rootParams.getParentRecordContext = () => parentEvalContext;

    const createDataPoint = model.createDataPoint.bind(model);
    const modelLoad = model.load.bind(model);
    model.load = (...args) => {
        // intercept the createDatapoint for the root staticList
        model.createDataPoint = (...args) => {
            const dataPoint = createDataPoint(...args);
            dataPoint.setCurrentIds(resIds);
            dataPoint.selection = [];
            // Immediate revert of the override
            model.createDataPoint = createDataPoint;
            return dataPoint;
        };
        return modelLoad(...args);
    };
}

class ListEditorController extends listView.Controller {
    setup() {
        super.setup();
        if (this.props.parentRecord) {
            modelUsesParentRecord(this.model, this.props.parentRecord, this.props.resIds);
        }
    }
}
ListEditorController.props = {
    ...listView.Controller.props,
    parentRecord: { type: Object, optional: true },
};

class ControllerShadow extends Component {
    get Component() {
        return ListEditorController;
    }

    get componentProps() {
        const props = { ...this.props };
        props.groupBy = [];
        return props;
    }
}
ControllerShadow.template = xml`<t t-component="Component" t-props="componentProps" />`;

const listEditor = {
    ...listView,
    Controller: ControllerShadow,
    ArchParser: EditorArchParser,
    Renderer: ListEditorRenderer,
    props() {
        const props = listView.props(...arguments);
        props.allowSelectors = false;
        props.editable = false;
        props.showButtons = false;
        return props;
    },
};
registry.category("studio_editors").add("list", listEditor);
