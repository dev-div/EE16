/** @odoo-module */

import { formView } from "@web/views/form/form_view";
import { FormEditorRenderer } from "./form_editor_renderer/form_editor_renderer";
import { FormEditorController } from "./form_editor_controller/form_editor_controller";
import { FormEditorCompiler } from "./form_editor_compiler";
import { registry } from "@web/core/registry";
import { omit } from "@web/core/utils/objects";
import { makeModelErrorResilient } from "@web_studio/client_action/view_editors/utils";

class EditorArchParser extends formView.ArchParser {
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

class Model extends formView.Model {}
Model.Record = class RecordNoEdit extends formView.Model.Record {
    get isInEdition() {
        return false;
    }
};

const formEditor = {
    ...formView,
    ArchParser: EditorArchParser,
    Compiler: FormEditorCompiler,
    Renderer: FormEditorRenderer,
    Controller: FormEditorController,
    props(genericProps, editor, config) {
        const props = formView.props(genericProps, editor, config);
        props.Model = makeModelErrorResilient(Model);
        props.preventEdit = true;
        return props;
    },
};
registry.category("studio_editors").add("form", formEditor);
