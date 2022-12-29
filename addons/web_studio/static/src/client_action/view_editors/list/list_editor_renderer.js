/** @odoo-module */
import { listView } from "@web/views/list/list_view";
import { debounce } from "@web/core/utils/timing";

import { closest, touching } from "@web/core/utils/ui";

import {
    useLegacyOnDropElement,
    hookPositionTolerance,
    cleanHooks,
    getHooks,
    getActiveHook,
    getDroppedValues,
} from "@web_studio/client_action/view_editors/utils";

import { useDraggable } from "@web/core/utils/draggable";

import { useEffect, useRef } from "@odoo/owl";

const colSelectedClass = "o-web-studio-editor--element-clicked";
const colHoverClass = "o-web-studio--col-hovered";
const colNearestHookClass = "o_web_studio_nearest_hook";

function cleanStyling(mainEl, classNames) {
    mainEl.querySelectorAll(`${classNames.map((c) => `.${c}`)}`).forEach((el) => {
        el.classList.remove(...classNames);
    });
}

function columnsStyling(mainEl, colSelector, classNames) {
    mainEl.querySelectorAll(`td${colSelector}, th${colSelector}`).forEach((el) => {
        el.classList.add(...classNames);
    });
}

function getSelectableCol(target, colSelector) {
    if (target.closest("button")) {
        return null;
    }
    const colEl = target.closest(`td${colSelector}, th${colSelector}`);
    return colEl;
}

export class ListEditorRenderer extends listView.Renderer {
    setup() {
        super.setup();
        this.onTableHover = debounce(this.onTableHover.bind(this), "animationFrame");

        // Prepare a legacy handler for JQuery UI's droppable
        const onLegacyDropped = useLegacyOnDropElement(this.rootRef);

        useEffect(
            (rootEl) => {
                rootEl.classList.add("o_web_studio_list_view_editor");

                // FIXME: legacy: interoperability with legacy studio components
                $(rootEl).droppable({
                    accept: ".o_web_studio_component",
                    drop: onLegacyDropped,
                });
                return () => {
                    $(rootEl).droppable("destroy");
                };
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
            const xpath = closestHookEl.dataset.xpath;
            const position = closestHookEl.dataset.position;
            columnsStyling(
                this.tableRef.el,
                `.o_web_studio_hook[data-xpath='${xpath}'][data-position='${position}']`,
                [colNearestHookClass]
            );
            return true;
        };
        this.env.config.registerCallback("highlightNearestHook", highlightNearestHook);
        this.env.config.registerCallback("selectField", (fName) => {
            const el = this.tableRef.el.querySelector(`th[data-name='${fName}']`);
            if (el) {
                el.click();
            }
        });

        const tableHeadRef = useRef("tableHead");
        let positionsBsClasses = null;
        useDraggable({
            ref: tableHeadRef,
            elements: ".o-draggable",
            onDragStart({ element }) {
                element.classList.add("o-draggable--dragging");
                positionsBsClasses = Array.from(element.classList).filter((c) =>
                    c.startsWith("position-")
                );
                element.classList.remove(...positionsBsClasses);
            },
            onDrag({ x, y, element }) {
                element.classList.remove("o-draggable--drop-ready");
                if (highlightNearestHook(element, { x, y })) {
                    element.classList.add("o-draggable--drop-ready");
                }
            },
            onDragEnd({ element }) {
                element.classList.remove("o-draggable--dragging");
                if (positionsBsClasses) {
                    element.classList.add(...positionsBsClasses);
                    positionsBsClasses = null;
                }
            },
            onDrop: ({ element }) => {
                const rootRef = this.rootRef;
                const targetHook = getActiveHook(rootRef.el);
                if (!targetHook) {
                    return;
                }
                const { xpath, position } = targetHook.dataset;
                const droppedData = element.dataset;
                droppedData.fieldName = element.dataset.name;
                const values = getDroppedValues({ droppedData, xpath, position });

                cleanHooks(rootRef.el);

                if (!values) {
                    return;
                }
                this.env.config.structureChange(values);
            },
        });
    }

    get canResequenceRows() {
        return false;
    }

    getColumnHookData(col, position) {
        let xpath;
        if (!col) {
            return { xpath: "/tree", position: "inside" };
        }
        if (col.type === "button_group") {
            if (position === "before") {
                xpath = col.buttons[0].studioXpath;
            } else {
                xpath = col.buttons[col.buttons.length - 1].studioXpath;
            }
        } else {
            xpath = col.studioXpath;
        }
        return {
            xpath,
            position,
        };
    }

    addColsHooks(_cols) {
        const rawAttrs = { width: "1px" };
        const options = {};
        const cols = [];
        let hookId = 0;
        const firstCol = _cols.find((c) => c.optional !== "hide");
        const { xpath, position } = this.getColumnHookData(firstCol, "before");
        cols.push({
            type: "studio_hook",
            position,
            xpath,
            id: `studio_hook_${hookId++}_${(firstCol && firstCol.id) || 0}`,
            rawAttrs,
            options,
        });
        for (const col of _cols) {
            if (col.optional === "hide") {
                continue;
            }
            cols.push(col);
            const { xpath, position } = this.getColumnHookData(col, "after");
            cols.push({
                type: "studio_hook",
                position,
                xpath,
                id: `studio_hook_${hookId++}_${col.id}`,
                rawAttrs,
                options,
            });
        }
        return cols;
    }

    get allColumns() {
        let cols = this._allColumns;
        if (this.env.config.studioShowInvisible) {
            cols = cols.map((c) => {
                return {
                    ...c,
                    optional: false,
                    studioIsInvisible:
                        c.optional === "hide" ||
                        (c.modifiers && c.modifiers.column_invisible === true),
                };
            });
        } else {
            cols = cols.filter((c) => !c.modifiers || c.modifiers.column_invisible !== true);
        }
        return this.addColsHooks(cols);
    }

    set allColumns(cols) {
        this._allColumns = cols;
    }

    onTableHover(ev) {
        const table = this.tableRef.el;
        cleanStyling(table, [colHoverClass]);
        if (ev.type !== "mouseover") {
            return;
        }
        const colEl = getSelectableCol(ev.target, "[data-studio-xpath]");
        if (!colEl) {
            return;
        }
        const xpath = colEl.dataset.studioXpath;
        columnsStyling(table, `[data-studio-xpath='${xpath}']:not(.o_web_studio_hook)`, [
            colHoverClass,
        ]);
    }

    onTableClicked(ev) {
        ev.stopPropagation();
        const table = ev.currentTarget;
        cleanStyling(table, [colSelectedClass]);
        const colEl = getSelectableCol(ev.target, "[data-studio-xpath]");
        if (!colEl) {
            return;
        }
        const xpath = colEl.dataset.studioXpath;
        columnsStyling(table, `[data-studio-xpath='${xpath}']:not(.o_web_studio_hook)`, [
            colSelectedClass,
        ]);
        this.env.config.onNodeClicked({ xpath: colEl.dataset.studioXpath, target: colEl });
    }
}
ListEditorRenderer.template = "web_studio.ListEditorRenderer";
ListEditorRenderer.recordRowTemplate = "web_studio.ListEditorRenderer.RecordRow";
