odoo.define('web_gantt.gantt_mobile_tests', function (require) {
"use strict";

const GanttView = require('web_gantt.GanttView');
const testUtils = require('web.test_utils');

const createView = testUtils.createView;

let initialDate = new Date(2018, 11, 20, 8, 0, 0);
initialDate = new Date(initialDate.getTime() - initialDate.getTimezoneOffset() * 60 * 1000);

QUnit.module('LegacyViews', {
    beforeEach: function () {
        this.data = {
            tasks: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    start: {string: 'Start Date', type: 'datetime'},
                    stop: {string: 'Stop Date', type: 'datetime'},
                    user_id: {string: 'Assign To', type: 'many2one', relation: 'users'},
                },
                records: [
                    { id: 1, start: '2018-11-30 18:30:00', stop: '2018-12-31 18:29:59', user_id: 1},
                    { id: 2, start: '2018-12-17 11:30:00', stop: '2018-12-22 06:29:59', user_id: 2},
                    { id: 3, start: '2018-12-27 06:30:00', stop: '2019-01-03 06:29:59', user_id: 2},
                    { id: 4, start: '2018-12-19 22:30:00', stop: '2018-12-20 06:29:59', user_id: 1},
                    { id: 5, start: '2018-11-08 01:53:10', stop: '2018-12-04 01:34:34', user_id: 1},
                ],
            },
            users: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    name: {string: 'Name', type: 'char'},
                },
                records: [
                    {id: 1, name: 'User 1'},
                    {id: 2, name: 'User 2'},
                ],
            },
        };
    },
}, function () {
    QUnit.module('GanttView (legacy) - Mobile');

    QUnit.test('Progressbar: check the progressbar percentage visibility.', async function (assert) {
        assert.expect(11);

        const gantt = await createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: `<gantt date_start="start" date_stop="stop"
                        default_scale="week" scales="week"
                        default_group_by="user_id"
                        progress_bar="user_id">
                        <field name="user_id"/>
                   </gantt>`,
            viewOptions: {
                initialDate: initialDate,
            },
            config: {device: {isMobile: true}},
            mockRPC: function (route, args) {
                if (args.method === 'gantt_progress_bar') {
                    assert.strictEqual(args.model, "tasks");
                    assert.deepEqual(args.args[0], ['user_id']);
                    assert.deepEqual(args.args[1], {user_id: [1, 2]});
                    return Promise.resolve({
                        user_id: {
                            1: {value: 50, max_value: 100},
                            2: {value: 25, max_value: 200},
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        const progressbar = gantt.el.querySelectorAll('.o_gantt_row_sidebar .o_gantt_progressbar');
        assert.strictEqual(progressbar.length, 2, "Gantt should include two progressbars");
        assert.strictEqual(progressbar[0].style.width, "50%");
        assert.strictEqual(progressbar[1].style.width, "12.5%");
        assert.hasClass(progressbar[0], 'o_gantt_group_success', "Progress bar should have the success class");
        assert.hasClass(progressbar[1], 'o_gantt_group_success', "Progress bar should have the success class");
        const progressbarText = gantt.el.querySelectorAll('.o_gantt_row_sidebar .o_gantt_text_mobile');
        assert.hasClass(progressbarText[0], 'o_gantt_text_mobile', "Progress bar should be visible.");
        assert.hasClass(progressbarText[1], 'o_gantt_text_mobile', "Progress bar should be visible.");
        assert.isVisible(gantt.el.querySelector('.o_gantt_row_sidebar .o_gantt_group_hours'), "Progressbar Title should be visible.");

        gantt.destroy();
    });
    QUnit.test('horizontal scroll applies only to the content, not to the whole controller [SMALL SCREEN]', async function (assert) {
        assert.expect(7);
        const gantt = await createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: `<gantt date_start="start" date_stop="stop">
                        <field name="user_id"/>
                   </gantt>`,
            viewOptions: {
                initialDate: initialDate,
            },
            debug: true, // for this test, we need the elements to be visible in the viewport
        });

        const o_view_controller = document.querySelector(".o_view_controller");
        const o_content = o_view_controller.querySelector('.o_content');
        const o_gantt_header_cell = gantt.el.querySelector('.o_gantt_header_cell:first-child');
        const o_gantt_cp_btn_today = gantt.el.querySelector('.o_gantt_button_today');
        const initialXCpBtn = o_gantt_cp_btn_today.getBoundingClientRect().x;
        const initialXHeaderCell = o_gantt_header_cell.getBoundingClientRect().x;

        assert.hasClass(o_view_controller, "o_action_delegate_scroll",
            "the 'o_view_controller' should be have the 'o_action_delegate_scroll'.");
        assert.strictEqual(window.getComputedStyle(o_view_controller).overflow,"hidden",
            "The view controller should have overflow hidden");
        assert.strictEqual(window.getComputedStyle(o_content).overflow,"auto", "The view content should have the overflow auto");
        assert.strictEqual(o_content.scrollLeft, 0, "Te o_content should not have scroll value");

        // Horizontal scroll
        o_content.scrollLeft = 100;
        await testUtils.nextTick();

        assert.strictEqual(o_content.scrollLeft, 100, "the o_content should be 100 due to the overflow auto");
        assert.ok(o_gantt_header_cell.getBoundingClientRect().x < initialXHeaderCell,
            "the gantt header cell x position value should be lower after the scroll");
        assert.ok(o_gantt_cp_btn_today.getBoundingClientRect().x === initialXCpBtn,
            "the btn x position of the control panel button should be the same after the scroll");
        gantt.destroy();
    });
});
});
