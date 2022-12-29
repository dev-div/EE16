/** @odoo-module **/

import { PostKanbanCompiler } from './post_kanban_compiler';
import { StreamPostKanbanController } from './stream_post_kanban_controller';
import { StreamPostKanbanModel } from './stream_post_kanban_model';
import { StreamPostKanbanRenderer } from './stream_post_kanban_renderer';

import { kanbanView } from '@web/views/kanban/kanban_view';
import { registry } from '@web/core/registry';

export const StreamPostKanbanView = {
    ...kanbanView,
    Controller: StreamPostKanbanController,
    Model: StreamPostKanbanModel,
    Renderer: StreamPostKanbanRenderer,
    buttonTemplate: 'StreamPostKanbanView.buttons',
    props: (genericProps, view) => {
        return {
            ...kanbanView.props(genericProps, view),
            Compiler: PostKanbanCompiler,
        };
    },
};

registry.category("views").add("social_stream_post_kanban_view", StreamPostKanbanView);
