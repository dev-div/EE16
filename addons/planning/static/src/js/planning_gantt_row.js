/** @odoo-module alias=planning.PlanningGanttRow **/

import fieldUtils from 'web.field_utils';

import { getIntervalStepAccordingToScaleInterval, serializeDateTimeAccordingToScale } from "./planning_gantt_utils";
import HrGanttRow from 'hr_gantt.GanttRow';
import EmployeeWithJobTitle from '@planning/js/widgets/employee_m2o_with_job_title';

const { DateTime } = luxon;


const PlanningGanttRow = HrGanttRow.extend({
    template: 'PlanningGanttView.Row',

    init(parent, pillsInfo, viewInfo, options) {
        this._super(...arguments);
        const isGroupedByResource = pillsInfo.groupedByField === 'resource_id';
        const isEmptyGroup = pillsInfo.groupId === 'empty';
        this.employeeID = (this.progressBar && this.progressBar.employee_id) || false;
        this.isResourceMaterial = !!(this.progressBar && this.progressBar.is_material_resource);
        this.showEmployeeAvatar = !this.isResourceMaterial && (isGroupedByResource && !isEmptyGroup && !!this.employeeID);
    },

    _getEmployeeID() {
        return this.employeeID;
    },

    /**
     * Add allocated hours formatted to context
     *
     * @private
     * @override
     */
    _getPopoverContext: function () {
        const data = this._super.apply(this, arguments);
        data.allocatedHoursFormatted = fieldUtils.format.float_time(data.allocated_hours);
        data.allocatedPercentageFormatted = fieldUtils.format.float(data.allocated_percentage);
        return data;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Initialize the avatar widget in virtual DOM.
     *
     * @private
     * @override
     * @returns {Promise}
     */
    async _preloadAvatarWidget() {
        const employee = [this._getEmployeeID(), this.name];
        this.avatarWidget = new EmployeeWithJobTitle(this, employee, this.planningHoursInfo);
        return this.avatarWidget.appendTo(document.createDocumentFragment());
    },

    /**
     * Return a step according to scale interval.
     *
     * @throws Error if the scale or the scale interval is unknown.
     * @return {*} Object that can be passed to Luxon DateTime plus() method.
     * @private
     */
    _getIntervalStepAccordingToScaleInterval() {
        return getIntervalStepAccordingToScaleInterval(this.state.scale, this.SCALES);
    },

    /**
     * Serialize the provided Luxon DateTime according to the provided timezone.
     *
     * @param date a Luxon DateTime.
     * @return {*} Luxon DateTime.
     * @private
     */
    _serializeDateTimeAccordingToScale(date) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return serializeDateTimeAccordingToScale(date, this.state.scale, this.SCALES, tz);
    },
    /**
     * Return the allocated hours for the provided pills and date.
     *
     * @param pills The pills the allocated hours have to be computed for.
     * @param date The date the allocated hours have to be computed for.
     * @return {number}
     * @private
     */
    _getAllocatedHours(pills, date) {
        const dateKey = this._serializeDateTimeAccordingToScale(DateTime.fromSeconds(date.unix()));
        return pills.reduce(
            (accumulator, current) => accumulator + (dateKey in current.allocatedHoursDict ? current.allocatedHoursDict[dateKey] : 0),
            0
        );
    },

    /**
     * @override
     */
    _getAggregateGroupedPillsDisplayName(pill) {
        const totalAllocatedHours = pill.intervals.reduce(
            (accumulator, interval) => {
                if (interval[0] < pill.stopDate && interval[0] >= pill.startDate) {
                    // As if a pill cross several Gantt intervals, it is currently added several times to
                    // aggregatedPills. So we need to ensure that it is only taken once into account, that's why we
                    // need to use the Set.
                    accumulator += this._getAllocatedHours([...new Set(pill.aggregatedPills)], interval[0]);
                }
                return accumulator;
            },
            0.0
        );
        return totalAllocatedHours ? fieldUtils.format.float_time(totalAllocatedHours) : "";
    },

    /**
     * @override
     */
    _getPillCount(pillsInThisInterval, intervalStart) {
        return this._getAllocatedHours(pillsInThisInterval, intervalStart);
    },

    /**
     * @override
     */
    _isPillsInInterval(pill, intervalStart, intervalStop) {
        return this._super(...arguments) && this._getAllocatedHours([pill], intervalStart);
    },

});

export default PlanningGanttRow;
