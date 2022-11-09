/** @odoo-module alias=planning.PlanningGanttModel **/

import { _t } from 'web.core';
import { formatPercentage } from "@web/views/fields/formatters";
import { deserializeDateTime } from "@web/core/l10n/dates";

import GanttModel from 'web_gantt.GanttModel';
import { getIntervalStepAccordingToScaleInterval, serializeDateTimeAccordingToScale } from "./planning_gantt_utils";

const { DateTime } = luxon;


const GROUPBY_COMBINATIONS = [
    "role_id",
    "role_id,resource_id",
    "role_id,department_id",
    "department_id",
    "department_id,role_id",
    "project_id",
    "project_id,department_id",
    "project_id,resource_id",
    "project_id,role_id",
    "project_id,task_id,resource_id",
    "project_id,task_id,role_id",
    "task_id",
    "task_id,department_id",
    "task_id,resource_id",
    "task_id,role_id",
];

const PlanningGanttModel = GanttModel.extend({

    /**
     * @public
     * @returns {moment} startDate
     */
    getStartDate() {
        return this.convertToServerTime(this.get().startDate);
    },
    /**
     * @public
     * @param {Object} ctx
     * @returns {Object} context
     */
    getAdditionalContext(ctx) {
        const state = this.get();
        return Object.assign({}, ctx, {
            'default_start_datetime': this.convertToServerTime(state.startDate),
            'default_end_datetime': this.convertToServerTime(state.stopDate),
            'default_slot_ids': state.records.map(record => record.id),
            'scale': state.scale,
            'active_domain': this.domain,
            'active_ids': state.records,
            'default_employee_ids': state.rows.map(row => row.resId).filter(resId => !!resId),
        });
    },
    /**
     * Return a step according to scale interval.
     *
     * @throws Error if the scale or the scale interval is unknown.
     * @return {*} Object that can be passed to Luxon DateTime plus() method.
     * @private
     */
    _getIntervalStepAccordingToScaleInterval() {
        return getIntervalStepAccordingToScaleInterval(this.ganttData.scale, this.SCALES);
    },
    /**
     * Serialize the provided Luxon DateTime according to the provided timezone.
     *
     * @param date a Luxon DateTime.
     * @param utc force timezone to UTC instead of using browser timezone.
     * @return {*} Luxon DateTime.
     * @private
     */
    _serializeDateTimeAccordingToScale(date, utc = false) {
        const tz = utc ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone;
        return serializeDateTimeAccordingToScale(date, this.ganttData.scale, this.SCALES, tz);
    },
    /**
     * Generate and store (into `ganttData.resourceWorkIntervalsDict`) work intervals according to Gantt scale.
     *
     * @param workIntervals the work intervals returned by `gantt_resource_work_interval` rpc call.
     * @private
     */
    _generateAndStoreWorkIntervals(workIntervals) {
        const data = {};
        for (const resourceId of Object.keys(workIntervals)) {
            for (const [start, end] of workIntervals[resourceId]) {
                // Calculate interval start, stop and step that will be used to compute the allocated hours' dict.
                const startDate = deserializeDateTime(start);
                const endDate = deserializeDateTime(end);
                if (!(resourceId in data)) {
                    data[resourceId] = {};
                }
                const intervalStep = this._getIntervalStepAccordingToScaleInterval();
                const intervalStartDate = deserializeDateTime(
                    this._serializeDateTimeAccordingToScale(startDate, true)
                );
                const intervalStopDate = deserializeDateTime(
                    this._serializeDateTimeAccordingToScale(endDate.plus(intervalStep), true)
                );

                for (let currentDate = intervalStartDate; currentDate < intervalStopDate; currentDate = currentDate.plus(intervalStep)) {
                    if (currentDate >= endDate) {
                        break;
                    }
                    // Compute start and end date of current interval.
                    let periodStart = currentDate;
                    if (currentDate < startDate) {
                        periodStart = startDate;
                    }
                    let periodEnd = periodStart.plus(intervalStep);
                    periodEnd = periodEnd > endDate ? endDate : periodEnd;

                    // Populate dict with associated work interval.
                    const dateKey = this._serializeDateTimeAccordingToScale(periodStart);
                    if (!(dateKey in data[resourceId])) {
                        data[resourceId][dateKey] = [];
                    }
                    data[resourceId][dateKey].push([periodStart, periodEnd]);
                }
            }
        }
        this.ganttData.resourceWorkIntervalsDict = data;
    },
    /**
     * Fetch resources' work intervals.
     *
     * @returns {Deferred}
     * @private
     */
    _fetchResourceWorkInterval() {
        return this._rpc({
            model: this.modelName,
            method: 'gantt_resource_work_interval',
            args: [
                this._getSlotIdsFromRows(this.ganttData.rows),
            ],
            context: this.context,
        }).then((result) => {
            this._generateAndStoreWorkIntervals(result[0]);
        });
    },
    /**
     * Get the ids from the provided rows.
     *
     * @param {Object} rows in the format of ganttData.rows.
     * @returns {Array} the slot ids.
     * @private
     */
    _getSlotIdsFromRows(rows) {
        const result = rows.reduce(
            (accumulator, current) => {
                if (current.rows) {
                    for (const slotId in this._getSlotIdsFromRows(current.rows)) {
                        accumulator.add(slotId);
                    }
                }
                for (const record of Object.values(current.records)) {
                    if (record.id) {
                        accumulator.add(record.id);
                    }
                }
                return accumulator;
            },
            new Set()
        );
        return [...result];
    },
    /**
     * @override
     */
    _fetchDataPostProcess() {
        const proms = this._super.apply(this, arguments);
        if (!this.isSampleModel && this.ganttData.records.length) {
            proms.push(this._fetchResourceWorkInterval());
        }
        return proms;
    },
    /**
     * Populate the provided record with its related allocated hours per date according to the Gantt scale.
     *
     * @param record the record to populate
     * @private
     */
    _populateAllocatedHours(record) {
        record.allocatedHoursDict = {};

        // Convert moment date into Luxon
        const startDate = DateTime.fromSeconds(record.start_datetime.unix());
        const endDate = DateTime.fromSeconds(record.end_datetime.unix());

        // Calculate interval start, stop and step that will be used to compute the allocated hours' dict.
        const intervalStep = this._getIntervalStepAccordingToScaleInterval();
        const intervalStartDate = deserializeDateTime(this._serializeDateTimeAccordingToScale(startDate, true));
        const intervalStopDate = deserializeDateTime(
            this._serializeDateTimeAccordingToScale(endDate.plus(intervalStep), true)
        );

        for (let currentDate = intervalStartDate; currentDate < intervalStopDate; currentDate = currentDate.plus(intervalStep)) {
            if (currentDate >= endDate) {
                break;
            }
            // Compute start and end date of current interval.
            let periodStart = currentDate;
            if (currentDate < startDate) {
                periodStart = startDate;
            }
            let periodEnd = periodStart.plus(intervalStep);
            periodEnd = periodEnd > endDate ? endDate : periodEnd;

            // Populate record with associated allocated hours.
            const dateKey = this._serializeDateTimeAccordingToScale(periodStart);
            const workIntervals = this.ganttData.resourceWorkIntervalsDict
                                  && this.ganttData.resourceWorkIntervalsDict[record.resource_id && record.resource_id[0]]
                                  && this.ganttData.resourceWorkIntervalsDict[record.resource_id && record.resource_id[0]][dateKey]
                                  || [];
            for (const workInterval of workIntervals) {
                if (!(workInterval[1] <= periodStart || workInterval[0] >= periodEnd)) {
                    const overlapDuration = Math.min(
                        workInterval[1].diff(workInterval[0], 'hours').toObject().hours,
                        workInterval[1].diff(periodStart, 'hours').toObject().hours,
                        periodEnd.diff(periodStart, 'hours').toObject().hours,
                        periodEnd.diff(workInterval[0], 'hours').toObject().hours,
                    );
                    if (!(dateKey in record.allocatedHoursDict)) {
                        record.allocatedHoursDict[dateKey] = 0;
                    }
                    record.allocatedHoursDict[dateKey] += overlapDuration * record.allocated_percentage / 100;
                }
            }
        }
    },
    /**
     * @override
     */
    _fetchData: function () {
        this.context.show_job_title = true;
        return this._super.apply(this, arguments).then(result => {
            for (const record of Object.values(this.ganttData.records)) {
                this._populateAllocatedHours(record);
            }
        });
    },
    /**
     * @override
     */
    __reload(handle, params) {
        if ("context" in params) {
            params.context.show_job_title = true;
            if (params.context.planning_groupby_role && !params.groupBy.length) {
                params.groupBy.unshift('resource_id');
                params.groupBy.unshift('role_id');
            }
        }
        return this._super(handle, params);
    },
    /**
     * Check if the given groupedBy includes fields for which an empty fake group will be created
     * @param {string[]} groupedBy
     * @returns {boolean}
     */
    _allowCreateEmptyGroups(groupedBy) {
        return groupedBy.includes("resource_id");
    },
    /**
     * Check if the given groupBy is in the list that has to generate empty lines
     * @param {string[]} groupedBy
     * @returns {boolean}
     */
    _allowedEmptyGroups(groupedBy) {
        return GROUPBY_COMBINATIONS.includes(groupedBy.join(","));
    },
    /**
     * @private
     * @override
     * @returns {Object[]}
     */
    _generateRows(params) {
        const { groupedBy, groups, parentPath } = params;
        if (!this.hide_open_shift) {
            if (parentPath.length === 0) {
                // _generateRows is a recursive function.
                // Here, we are generating top level rows.
                if (this._allowCreateEmptyGroups(groupedBy)) {
                    // The group with false values for every groupby can be absent from
                    // groups (= groups returned by read_group basically).
                    // Here we add the fake group {} in groups in any case (this simulates the group
                    // with false values mentionned above).
                    // This will force the creation of some rows with resId = false
                    // (e.g. 'Open Shifts') from top level to bottom level.
                    groups.push({});
                }
                if (this._allowedEmptyGroups(groupedBy)) {
                    params.addOpenShifts = true;
                }
            }
            if (params.addOpenShifts && groupedBy.length === 1) {
                // Here we are generating some rows on last level (assuming
                // collapseFirstLevel is false) under a common "parent"
                // (if any: first level can be last level).
                // We make sure that a row with resId = false for
                // the unique groupby in groupedBy and same "parent" will be
                // added by adding a suitable fake group to the groups (a subset
                // of the groups returned by read_group).
                const fakeGroup = Object.assign({}, ...parentPath);
                groups.push(fakeGroup);
            }
        }
        const rows = this._super(params);
        // always move an empty row to the head and sort rows alphabetically
        if (groupedBy && groupedBy.length && rows.length > 1 && rows[0].resId) {
            rows.sort((curr, next) => {
                if (curr.resId && !next.resId) return 1;
                if (!curr.resId && next.resId) return -1;
                return curr.name.toLowerCase() > next.name.toLowerCase() ? 1 : -1;
            });
            this._reorderEmptyRow(rows);
        }
        return rows;
    },
    /**
     * Rename 'Undefined Resource' and 'Undefined Department' to 'Open Shifts'.
     *
     * @private
     * @override
     */
    _getRowName(groupedByField, value) {
        if (["department_id", "resource_id"].includes(groupedByField)) {
            const resId = Array.isArray(value) ? value[0] : value;
            if (!resId) {
                return _t("Open Shifts");
            }
        }
        return this._super(...arguments);
    },
    /**
     * Find an empty row and move it at the head of the array.
     *
     * @private
     * @param {Object[]} rows
     */
    _reorderEmptyRow(rows) {
        let emptyIndex = null;
        for (let i = 0; i < rows.length; ++i) {
            if (!rows[i].resId) {
                emptyIndex = i;
                break;
            }
        }
        if (emptyIndex) {
            const emptyRow = rows.splice(emptyIndex, 1)[0];
            rows.unshift(emptyRow);
        }
    },
    /**
     * Recursive function to add progressBar info to rows grouped by the field.
     *
     * @private
     * @override
     */
    _addProgressBarInfo(field, rows, progressBarInfo) {
        this._super(...arguments);
        const rowsWithProgressBar = rows.filter((row) => row.progressBar && row.progressBar.max_value_formatted);
        for (const row of rowsWithProgressBar) {
            row.progressBar.percentage = formatPercentage(row.progressBar.ratio / 100);
        }
    },
});

export default PlanningGanttModel;
