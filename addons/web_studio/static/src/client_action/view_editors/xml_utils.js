/** @odoo-module */
import { isComponentNode, appendAttr } from "@web/views/view_compiler";

const nodeWeak = new WeakMap();
export function computeXpath(node, upperBoundSelector = "form") {
    if (nodeWeak.has(node)) {
        return nodeWeak.get(node);
    }
    const tagName = node.tagName;
    let count = 1;
    let previous = node;
    while ((previous = previous.previousElementSibling)) {
        if (previous.tagName === tagName) {
            count++;
        }
    }
    let xpath = `${tagName}[${count}]`;
    const parent = node.parentElement;
    if (!node.matches(upperBoundSelector)) {
        const parentXpath = computeXpath(parent, upperBoundSelector);
        xpath = `${parentXpath}/${xpath}`;
    } else {
        xpath = `/${xpath}`;
    }
    nodeWeak.set(node, xpath);
    return xpath;
}

export const nodeStudioXpathSymbol = Symbol("nodeStudioXpath");
function xmlNodeToLegacyNode(xpath, node) {
    const attrs = {};

    for (const att of node.getAttributeNames()) {
        if (att === "studioXpath") {
            attrs[nodeStudioXpathSymbol] = node.getAttribute(att);
            continue;
        }
        attrs[att] = node.getAttribute(att);
    }

    if (attrs.modifiers) {
        attrs.modifiers = JSON.parse(attrs.modifiers);
    } else {
        attrs.modifiers = {};
    }

    if (!attrs[nodeStudioXpathSymbol]) {
        attrs[nodeStudioXpathSymbol] = xpath;
    } else if (attrs.studioXpath !== xpath) {
        // WOWL to remove
        throw new Error("You rascal!");
    }

    const legNode = {
        tag: node.tagName,
        attrs,
    };
    return legNode;
}

export function getLegacyNode(xpath, xml) {
    const nodes = getNodesFromXpath(xpath, xml);
    if (nodes.length !== 1) {
        throw new Error(`xpath ${xpath} yielded no or multiple nodes`);
    }
    return xmlNodeToLegacyNode(xpath, nodes[0]);
}

export function xpathToLegacyXpathInfo(xpath) {
    // eg: /form[1]/field[3]
    // RegExp notice: group 1 : form ; group 2: [1], group 3: 1
    const xpathInfo = [];
    const matches = xpath.matchAll(/\/?(\w+)(\[(\d+)\])?/g);
    for (const m of matches) {
        const info = {
            tag: m[1],
            indice: parseInt(m[3] || 1),
        };
        xpathInfo.push(info);
    }
    return xpathInfo;
}

function getXpathNodes(xpathResult) {
    const nodes = [];
    let res;
    while ((res = xpathResult.iterateNext())) {
        nodes.push(res);
    }
    return nodes;
}

export function getNodesFromXpath(xpath, xml) {
    const owner = "evaluate" in xml ? xml : xml.ownerDocument;
    const xpathResult = owner.evaluate(xpath, xml, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    return getXpathNodes(xpathResult);
}

const parser = new DOMParser();
export const parseStringToXml = (str) => {
    return parser.parseFromString(str, "text/xml");
};

const serializer = new XMLSerializer();
export const serializeXmlToString = (xml) => {
    return serializer.serializeToString(xml);
};

// This function should be used in Compilers to apply the "invisible" modifiers on
// the compiled templates's nodes
export function applyInvisible(invisible, compiled, params) {
    // Just return the node if it is always Visible
    if (!invisible) {
        return compiled;
    }

    let isVisileExpr;
    // If invisible is dynamic (via Domain), pass a props or apply the studio class.
    if (typeof invisible !== "boolean") {
        const recordExpr = params.recordExpr || "props.record";
        isVisileExpr = `!evalDomainFromRecord(${recordExpr},${JSON.stringify(invisible)})`;
        if (isComponentNode(compiled)) {
            compiled.setAttribute("studioIsVisible", isVisileExpr);
        } else {
            appendAttr(compiled, "class", `o_web_studio_show_invisible:!${isVisileExpr}`);
        }
    } else {
        if (isComponentNode(compiled)) {
            compiled.setAttribute("studioIsVisible", "false");
        } else {
            appendAttr(compiled, "class", `o_web_studio_show_invisible:true`);
        }
    }

    // Finally, put a t-if on the node that accounts for the parameter in the config.
    const studioShowExpr = `env.config.studioShowInvisible`;
    isVisileExpr = isVisileExpr ? `(${isVisileExpr} or ${studioShowExpr})` : studioShowExpr;
    if (compiled.hasAttribute("t-if")) {
        const formerTif = compiled.getAttribute("t-if");
        isVisileExpr = `( ${formerTif} ) and ${isVisileExpr}`;
    }
    compiled.setAttribute("t-if", isVisileExpr);
    return compiled;
}
