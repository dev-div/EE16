/** @odoo-module */

import { WithSearch } from "@web/search/with_search/with_search";

import { Component, xml, useSubEnv, onError } from "@odoo/owl";

const HEIGHT = "height: 100%;";

export class StudioView extends Component {
    setup() {
        this.style = this.props.setOverlay ? `pointer-events: none; ${HEIGHT}` : HEIGHT;
        this.withSearchProps = {
            resModel: this.props.controllerProps.resModel,
            SearchModel: this.props.SearchModel,
            context: this.props.context,
            domain: this.props.domain,
            globalState: this.props.globalState,
            searchViewArch: this.props.searchViewArch,
            searchViewFields: this.props.searchViewFields,
            irFilters: this.props.searchViewIrFilters,
        };

        onError(this.env.config.handleRenderingError);

        useSubEnv({
            config: { ...this.env.config },
            __beforeLeave__: null,
            __getGlobalState__: null,
            __getLocalState__: null,
            __getContext__: null,
            __getOrderBy__: null,
        });
    }
}
StudioView.components = { WithSearch };
StudioView.template = xml`
    <div t-att-style="style">
        <WithSearch t-props="withSearchProps" t-slot-scope="search">
            <t t-component="props.Controller"
                t-props="props.controllerProps"
                context="search.context"
                domain="search.domain"
                groupBy="search.groupBy"
                orderBy="search.orderBy"
                comparison="search.comparison"
            />
        </WithSearch>
    </div>
`;
