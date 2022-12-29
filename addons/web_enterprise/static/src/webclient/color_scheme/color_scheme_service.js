/** @odoo-module **/

import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";

import { switchColorSchemeItem } from "./color_scheme_menu_items";

const serviceRegistry = registry.category("services");
const userMenuRegistry = registry.category("user_menuitems");

export const colorSchemeService = {
    dependencies: ["cookie", "ui"],

    start(env, { cookie, ui }) {
        userMenuRegistry.add("color_scheme.switch", switchColorSchemeItem);
        return {
            switchToColorScheme(scheme) {
                cookie.setCookie("color_scheme", scheme);
                ui.block();
                browser.location.reload();
            },
        };
    },
};
serviceRegistry.add("color_scheme", colorSchemeService);
