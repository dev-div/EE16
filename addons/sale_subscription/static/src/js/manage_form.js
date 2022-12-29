odoo.define('sale_subscription.manage_form', require => {
    'use strict';

    const core = require('web.core');
    const Dialog = require('web.Dialog');

    const manageForm = require('payment.manage_form');

    const _t = core._t;

    manageForm.include({
        /**
         * Build the confirmation dialog based on the linked records' information.
         *
         * @override method from payment.manage_form
         * @private
         * @param {Array} linkedRecordsInfo - The list of information about linked records.
         * @param confirmCallback - The original callback method called when the user clicks on the
                                    confirmation button.
         * @return {object}
         */
        _buildConfirmationDialog: function (linkedRecordsInfo, confirmCallback) {
            if (!(linkedRecordsInfo.some(function(e) { return e.active_subscription; }))) {
                return this._super(...arguments);
            }
            const $dialogContentMessage = $(
                '<span>',
                {text: _t(
                    "This payment method cannot be removed as it is currently linked to the"
                    + " following active subscriptions:"
                )},
            );
            const $documentInfoList = $('<ul>');
            linkedRecordsInfo.forEach(documentInfo => {
                if (documentInfo.active_subscription) {
                    $documentInfoList.append($('<li>').append($(
                        '<a>', {
                            href: documentInfo.url,
                            target: '_blank',
                            title: documentInfo.description,
                            text: documentInfo.name
                        }
                    )));
                }
            });
            $dialogContentMessage.append($documentInfoList);
            $dialogContentMessage.append($(
                '<span>',
                {text: _t("Please provide another payment method for these subscriptions.")},
            ));
            return new Dialog(this, {
                title: _t("Warning!"),
                size: 'medium',
                $content: $('<div>').append($dialogContentMessage),
                buttons: [
                    {
                        text: _t("Cancel"), close: true
                    },
                ],
            });
        },
    });
});
