/** @odoo-module **/

import { registerPatch } from "@mail/model/model_core";
import "@documents/models/document";

registerPatch({
    name: "Document",
    fields: {
        isViewable: {
            compute() {
                let result = this._super();
                if (result && this.record) {
                    result = this.record.data.handler !== "spreadsheet";
                }
                return result;
            },
        },
    },
});
