/** @odoo-module **/

import { registerPatch } from "@mail/model/model_core";

registerPatch({
    name: "Chatter",
    fields: {
        shouldReloadParentFromFileChanged: {
            compute() {
                // hr.applicant has OCR process in background when uploading a file
                // so reload view so that it shows alert of OCR process in progress.
                return (this.thread && this.thread.model === "hr.applicant") || this._super();
            },
        },
    },
});
