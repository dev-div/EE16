/** @odoo-module **/

import { KanbanCompiler } from '@web/views/kanban/kanban_compiler';

export class PostKanbanCompiler extends KanbanCompiler {
    /**
     * In v16, the post social views use forbidden owl directives (t-on) directly
     * in the arch. In master, they will be removed. We thus temporarily disable
     * the warnings fired when owl directives are used in the arch.
     * @override
     */
    validateNode() {}
}
