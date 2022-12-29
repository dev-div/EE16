/** @odoo-module */

import { KanbanRecord } from '@web/views/kanban/kanban_record';

export class FsmProductKanbanRecord extends KanbanRecord {
    onGlobalClick(ev) {
        if (ev.target.closest('.o_fsm_product_quantity')) {
            return;
        }
        const { openAction, fieldNodes } = this.props.archInfo;
        const { fsm_quantity } = fieldNodes;
        if (openAction && ['fsm_add_quantity', 'fsm_remove_quantity'].includes(openAction.action) && fsm_quantity && fsm_quantity.widget === 'fsm_product_quantity') {
            let fsmProductQty = this.props.record.data.fsm_quantity;
            if (openAction.action === 'fsm_add_quantity') {
                fsmProductQty++;
            } else {
                fsmProductQty--;
            }
            this.props.record.update({ fsm_quantity: fsmProductQty })
            return;
        }
        return super.onGlobalClick(ev);
    }
}
