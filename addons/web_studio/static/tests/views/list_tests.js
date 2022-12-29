/** @odoo-module **/

import {
    click,
    getFixture,
    patchWithCleanup,
    legacyExtraNextTick,
} from "@web/../tests/helpers/utils";
import { doAction, getActionManagerServerData } from "@web/../tests/webclient/helpers";
import { patch, unpatch } from "@web/core/utils/patch";
import { session } from "@web/session";
import { ListRenderer } from "@web/views/list/list_renderer";
import { createEnterpriseWebClient } from "@web_enterprise/../tests/helpers";
import { patchListRendererDesktop } from "@web_enterprise/views/list/list_renderer_desktop";
import { registerStudioDependencies } from "@web_studio/../tests/helpers";
import { patchListRendererStudio } from "@web_studio/views/list/list_renderer";

let serverData;
let target;

QUnit.module("Studio", (hooks) => {
    hooks.beforeEach(() => {
        serverData = getActionManagerServerData();
        serverData.views["base.automation,false,list"] = '<tree><field name="name"/></tree>';
        serverData.views["base.automation,false,search"] = "<search></search>";
        serverData.models["base.automation"] = {
            fields: {
                id: { string: "Id", type: "integer" },
                name: { string: "Name", type: "char" },
            },
            records: [],
        };
        registerStudioDependencies();
        patchWithCleanup(session, { is_system: true });
        target = getFixture();
        patch(
            ListRenderer.prototype,
            "web_enterprise.ListRendererDesktop",
            patchListRendererDesktop
        );
        patch(ListRenderer.prototype, "web_studio.ListRenderer", patchListRendererStudio);
    });

    hooks.afterEach(() => {
        unpatch(ListRenderer.prototype, "web_enterprise.ListRendererDesktop");
        unpatch(ListRenderer.prototype, "web_studio.ListRenderer");
    });

    QUnit.module("ListView");

    QUnit.test("add custom field button with other optional columns", async function (assert) {
        serverData.views["partner,false,list"] = `
            <tree>
                <field name="foo"/>
                <field name="bar" optional="hide"/>
            </tree>`;

        const webClient = await createEnterpriseWebClient({ serverData });
        await doAction(webClient, 3);
        assert.containsOnce(target, ".o_list_view");
        assert.containsOnce(target, ".o_list_view .o_optional_columns_dropdown_toggle");

        await click(target.querySelector(".o_optional_columns_dropdown_toggle"));
        assert.containsN(target, ".o_optional_columns_dropdown .dropdown-item", 2);
        assert.containsOnce(target, ".o_optional_columns_dropdown .dropdown-item-studio");

        await click(target.querySelector(".o_optional_columns_dropdown .dropdown-item-studio"));
        await legacyExtraNextTick();
        assert.containsNone(target, ".modal-studio");
        assert.containsOnce(
            target,
            ".o_studio .o_web_studio_editor .o_web_studio_list_view_editor"
        );
    });

    QUnit.test("add custom field button without other optional columns", async function (assert) {
        // by default, the list in serverData doesn't contain optional fields
        const webClient = await createEnterpriseWebClient({ serverData });
        await doAction(webClient, 3);

        assert.containsOnce(target, ".o_list_view");
        assert.containsOnce(target, ".o_list_view .o_optional_columns_dropdown_toggle");
        await click(target.querySelector(".o_optional_columns_dropdown_toggle"));

        assert.containsOnce(target, ".o_optional_columns_dropdown .dropdown-item");
        assert.containsOnce(target, ".o_optional_columns_dropdown .dropdown-item-studio");

        await click(target.querySelector(".o_optional_columns_dropdown .dropdown-item-studio"));
        await legacyExtraNextTick();
        assert.containsNone(target, ".modal-studio");
        assert.containsOnce(
            target,
            ".o_studio .o_web_studio_editor .o_web_studio_list_view_editor"
        );
    });

    QUnit.test("should render the no content helper of studio actions", async function (assert) {
        const webClient = await createEnterpriseWebClient({ serverData });
        await doAction(webClient, 3);
        await click(target.querySelector(".o_web_studio_navbar_item a"));
        await legacyExtraNextTick();
        const automationsLink = [...target.querySelectorAll(".o_web_studio_menu_item a")].find(
            (link) => link.textContent === "Automations"
        );
        await click(automationsLink);
        assert.containsOnce(target, ".no_content_helper_class");
    });
});
