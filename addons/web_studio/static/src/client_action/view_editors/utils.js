/** @odoo-module */

import { useEnv, useSubEnv } from "@odoo/owl";

export const hookPositionTolerance = 50;

export function cleanHooks(el) {
    for (const hookEl of el.querySelectorAll(".o_web_studio_nearest_hook")) {
        hookEl.classList.remove("o_web_studio_nearest_hook");
    }
}

export function getActiveHook(el) {
    return el.querySelector(".o_web_studio_nearest_hook");
}

// A naive function that determines if the toXpath on which we dropped
// our object is actually the same as the fromXpath of the element we dropped.
// Naive because it won't evaluate xpath, just guess whether they are equivalent
// under precise conditions.
function isToXpathEquivalentFromXpath(position, toXpath, fromXpath) {
    if (toXpath === fromXpath) {
        return true;
    }
    const toParts = toXpath.split("/");
    const fromParts = fromXpath.split("/");

    // Are the paths at least in the same parent node ?
    if (toParts.slice(0, -1).join("/") !== fromParts.slice(0, -1).join("/")) {
        return false;
    }

    const nodeIdxRegExp = /(\w+)(\[(\d+)\])?/;
    const toMatch = toParts[toParts.length - 1].match(nodeIdxRegExp);
    const fromMatch = fromParts[fromParts.length - 1].match(nodeIdxRegExp);

    // Are the paths comparable in terms of their node tag ?
    if (fromMatch[1] !== toMatch[1]) {
        return false;
    }

    // Is the position actually referring to the same place ?
    if (position === "after" && parseInt(toMatch[3] || 1) + 1 === parseInt(fromMatch[3] || 1)) {
        return true;
    }
    return false;
}

export function getDroppedValues({ droppedData, xpath, fieldName, position }) {
    const isNew = droppedData.isNew;
    let values;
    if (isNew) {
        values = {
            type: "add",
            structure: droppedData.structure,
            field_description: droppedData.field_description,
            xpath,
            new_attrs: droppedData.new_attrs,
            position: position,
        };
    } else {
        if (isToXpathEquivalentFromXpath(position, xpath, droppedData.studioXpath)) {
            return;
        }
        values = {
            type: "move",
            xpath,
            position: position,
            structure: "field",
            new_attrs: {
                name: droppedData.fieldName,
            },
        };
    }
    return values;
}

export function getHooks(el) {
    return [...el.querySelectorAll(".o_web_studio_hook")];
}

export function extendEnv(env, extension) {
    const nextEnv = Object.create(env);
    const descrs = Object.getOwnPropertyDescriptors(extension);
    Object.defineProperties(nextEnv, descrs);
    return Object.freeze(nextEnv);
}

// A standardized method to determine if a component is visible
export function studioIsVisible(props) {
    return props.studioIsVisible !== undefined ? props.studioIsVisible : true;
}

function updateCurrentClickedElement(mainEl, currentTarget) {
    for (const el of mainEl.querySelectorAll(".o-web-studio-editor--element-clicked")) {
        el.classList.remove("o-web-studio-editor--element-clicked");
    }
    const clickable = currentTarget.closest(".o-web-studio-editor--element-clickable");
    if (clickable) {
        clickable.classList.add("o-web-studio-editor--element-clicked");
    }
}

export function useStudioClickedElements(ref) {
    const env = useEnv();
    // Handle click on elements
    const config = Object.create(env.config);
    const originalNodeClicked = config.onNodeClicked;
    config.onNodeClicked = (params) => {
        updateCurrentClickedElement(ref.el, params.target);
        return originalNodeClicked(params);
    };
    useSubEnv({ config });
}

export function useLegacyOnDropElement(ref, executeDrop) {
    const env = useEnv();
    executeDrop = executeDrop || env.config.structureChange;
    const onLegacyDropped = (ev, ui) => {
        const hitHook = getActiveHook(ref.el);
        if (!hitHook) {
            return cleanHooks(ref.el);
        }
        const { xpath, position } = hitHook.dataset;
        const $droppedEl = ui.draggable || $(ev.target);

        const droppedData = $droppedEl.data();
        const isNew = $droppedEl[0].classList.contains("o_web_studio_component");
        droppedData.isNew = isNew;
        // Fieldname is useless here since every dropped element is new.
        const values = getDroppedValues({ droppedData, xpath, position });
        cleanHooks(ref.el);
        executeDrop(values);
    };

    return onLegacyDropped;
}

export function useStudioRef(refName = "studioRef", onClick) {
    // create two hooks and call them here?
    const comp = owl.useComponent();
    const ref = owl.useRef(refName);
    owl.useEffect(
        (el) => {
            if (el) {
                el.setAttribute("data-studio-xpath", comp.props.studioXpath);
            }
        },
        () => [ref.el]
    );

    if (onClick) {
        const handler = onClick.bind(comp);
        owl.useEffect(
            (el) => {
                if (el) {
                    el.addEventListener("click", handler, { capture: true });
                    return () => {
                        el.removeEventListener("click", handler);
                    };
                }
            },
            () => [ref.el]
        );
    }
}

export function makeModelErrorResilient(ModelClass) {
    function logError(debug) {
        if (!debug) {
            return;
        }
        console.warn(
            "The onchange triggered an error. It may indicate either a faulty call to onchange, or a faulty model python side"
        );
    }
    // LEGACY
    if ("_trigger_up" in ModelClass.prototype) {
        return class ResilientModel extends ModelClass {
            _trigger_up(ev) {
                const evType = ev.name;
                const payload = ev.data;
                if (
                    evType === "call_service" &&
                    payload.service === "ajax" &&
                    payload.method === "rpc"
                ) {
                    const args = payload.args || [];
                    if (args[1] && args[1].method === "onchange") {
                        const _callback = payload.callback;
                        payload.callback = (prom) => {
                            _callback(
                                prom.catch((e) => {
                                    logError(this.env.debug);
                                    return Promise.resolve({});
                                })
                            );
                        };
                    }
                }
                return super._trigger_up(ev);
            }
        };
    }

    return class ResilientModel extends ModelClass {
        setup() {
            super.setup(...arguments);
            const orm = this.orm;
            const debug = this.env.debug;
            this.orm = Object.assign(Object.create(orm), {
                async call(model, method) {
                    if (method === "onchange") {
                        try {
                            return await orm.call.call(orm, ...arguments);
                        } catch {
                            logError(debug);
                        }
                        return {};
                    }
                    return orm.call.call(orm, ...arguments);
                },
            });
        }
    };
}
