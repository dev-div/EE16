/** @odoo-module **/

/**
 * Throw an `Unknown scale interval` error.
 *
 * @param interval the unknown scale interval.
 * @private
 */
function _throwUnknownScaleIntervalError(interval) {
    throw new Error(`Unknown scale interval: ${interval}`);
}

/**
 * Throw an `Unknown scale` error.
 *
 * @param scale the unknown scale.
 * @private
 */
function _throwUnknownScaleError(scale) {
    throw new Error(`Unknown scale: ${scale}`);
}

/**
 * Return a step according to scale interval.
 *
 * @param scale a valid Gantt scale.
 * @param SCALES the Object containing scales properties.
 * @throws Error if the scale or the scale interval is unknown.
 * @return {*} Object that can be passed to Luxon DateTime plus() method.
 */
export function getIntervalStepAccordingToScaleInterval(scale, SCALES) {
    const scaleProperties = SCALES[scale];
    if (!scaleProperties) {
        _throwUnknownScaleError(scale);
    }
    let period = "";
    if (["month", "day", "hour"].includes(scaleProperties.interval)) {
        period = `${scaleProperties.interval}s`;
    } else {
        _throwUnknownScaleIntervalError(scaleProperties.interval);
    }
    return { [period]: 1 };
}

/**
 * Serialize the provided Luxon DateTime according to the provided scale and timezone.
 *
 * @param date a Luxon DateTime.
 * @param scale a valid Gantt scale.
 * @param SCALES the Object containing scales properties.
 * @param tz timezone as string ("UTC", etc.).
 * @throws Error if the scale or the scale interval is unknown.
 * @return {*} Luxon DateTime.
 */
export function serializeDateTimeAccordingToScale(date, scale, SCALES, tz) {
    const scaleProperties = SCALES[scale];
    if (!scaleProperties) {
        _throwUnknownScaleError(scale);
    }
    let format = "";
    if (scaleProperties.interval === "month") {
        format = "yyyy-MM-01 00:00:00";
    } else if (scaleProperties.interval === "day") {
        format = "yyyy-MM-dd 00:00:00";
    } else if (scaleProperties.interval === "hour") {
        format = "yyyy-MM-dd HH:mm:ss";
    } else {
        _throwUnknownScaleIntervalError(scaleProperties.interval);
    }
    return date.setZone(tz).toFormat(format, { numberingSystem: "latn" });
}
