/** @odoo-module */

import { formView } from '@web/views/form/form_view';
import { FormCompiler } from '@web/views/form/form_compiler';
import { registry } from "@web/core/registry";
import { createElement } from "@web/core/utils/xml";
import { KnowledgeArticleFormController } from './knowledge_controller.js';
import { KnowledgeArticleFormRenderer } from './knowledge_renderers.js';

class KnowledgeFormCompiler extends FormCompiler {
    setup() {
        super.setup();
        this.compilers.push({ selector: "PermissionPanel", fn: this.compilePermissionPanel });
    }
    /**
     * Defining sub components in the arch isn't supported by the framework, which
     * automatically lowercases tagnames s.t. owl doesn't consider them as sub
     * components (e.g. "Div" -> "div"). We thus here need to bypass that mechanism
     * by manually handling the PermissionPanel node, until we stop defining it in
     * the arch.
     * @param {Element} el
     * @returns {Element}
     */
    compilePermissionPanel(el) {
        const compiled = createElement(el.nodeName);
        for (const attr of el.attributes) {
            compiled.setAttribute(attr.name, attr.value);
        }
        return compiled;
    }
    /**
     * In v16, the knowledge app is a form view but uses a lot of implementation,
     * custom details in its arch (e.g. owl directives/components, attributes/functions
     * of the renderer). In master, this will be reworked not to use a form view
     * anymore (this could be a client action). We thus temporarily disable the
     * warnings fired when owl features are used in the arch.
     * @override
     */
    validateNode() {}
}

export const knowledgeArticleFormView = {
    ...formView,
    Controller: KnowledgeArticleFormController,
    Renderer: KnowledgeArticleFormRenderer,
    Compiler: KnowledgeFormCompiler,
    display: {controlPanel: false}
};

registry.category('views').add('knowledge_article_view_form', knowledgeArticleFormView);
