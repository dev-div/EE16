/** @odoo-module */

import { SpreadsheetSelectorDialog } from "@spreadsheet_edition/assets/components/spreadsheet_selector_dialog/spreadsheet_selector_dialog";
import { _t } from "@web/core/l10n/translation";
import ListController from "@web/legacy/js/views/list/list_controller";

/**
 * Remove user specific info from the context
 *
 * @param {Object} context
 * @returns {Object}
 */
function removeContextUserInfo(context) {
    context = { ...context };
    delete context.allowed_company_ids;
    delete context.tz;
    delete context.lang;
    delete context.uid;
    return context;
}

ListController.include({
    _insertListSpreadsheet() {
        const model = this.model.get(this.handle);
        const threshold = Math.min(model.count, model.limit);

        let name = this._title;
        const sortBy = model.orderedBy[0];
        if (sortBy) {
            name += ` ${_t("by")} ` + model.fields[sortBy.name].string;
        }
        const { list, fields } = this._getListForSpreadsheet(name);
        const actionOptions = {
            preProcessingAsyncAction: "insertList",
            preProcessingAsyncActionData: { list, threshold, fields },
        };
        const params = {
            threshold,
            type: "LIST",
            name,
            actionOptions,
        };
        this.call("dialog", "add", SpreadsheetSelectorDialog, params);
    },

    /**
     * Get the columns of a list to insert in spreadsheet
     *
     * @private
     *
     * @returns {Array<string>} Columns name
     */
    _getColumnsForSpreadsheet() {
        const fields = this.model.get(this.handle).fields;
        return this.renderer.columns
            .filter((col) => col.tag === "field")
            .filter((col) => col.attrs.widget !== "handle")
            .filter((col) => fields[col.attrs.name].type !== "binary")
            .map((col) => ({ name: col.attrs.name, type: fields[col.attrs.name].type }));
    },

    /**
     * Retrieves the list object from an existing view instance.
     *
     * @private
     * @param {string} name Name of the list
     *
     */
    _getListForSpreadsheet(name) {
        const data = this.model.get(this.handle);
        return {
            list: {
                model: data.model,
                domain: data.domain,
                orderBy: data.orderedBy,
                context: removeContextUserInfo(data.context),
                columns: this._getColumnsForSpreadsheet(),
                name,
            },
            fields: data.fields,
        };
    },

    on_attach_callback() {
        this._super(...arguments);
        if (this.searchModel) {
            this.searchModel.on("insert-list-spreadsheet", this, this._insertListSpreadsheet);
        }
    },

    on_detach_callback() {
        this._super(...arguments);
        if (this.searchModel) {
            this.searchModel.off("insert-list-spreadsheet", this);
        }
    },
});
