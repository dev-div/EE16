/** @odoo-module **/

import { registerCleanup } from "@web/../tests/helpers/cleanup";
import studioBus from "web_studio.bus";

QUnit.testStart(() => {
    const originalTrigger = studioBus.trigger;
    registerCleanup(() => {
        studioBus.trigger = originalTrigger;
    });
});
