/** @odoo-module */
import tour from "web_tour.tour";

tour.register(
    "web_studio_test_form_view_not_altered_by_studio_xml_edition",
    {
        test: true,
        url: "/web",
        sequence: 260
    },
    [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']"
        },
        {
            trigger: ".o_form_view .o_form_editable"
        },
        {
            trigger: ".o_web_studio_navbar_item a"
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_view"
        },
        {
            trigger: ".o_web_studio_xml_editor"
        },
        {
            extra_trigger: ".o_ace_view_editor",
            trigger: ".o_web_studio_leave"
        },
        {
            trigger: ".o_form_view .o_form_editable"
        }
    ]
);

/* global ace */
tour.register(
    "web_studio_test_edit_with_xml_editor",
    {
        test: true,
        url: "/web",
        sequence: 260
    },
    [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']"
        },
        {
            extra_trigger: ".someDiv",
            trigger: ".o_web_studio_navbar_item a"
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_view"
        },
        {
            trigger: ".o_web_studio_xml_editor"
        },
        {
            extra_trigger: ".o_ace_view_editor",
            trigger: ".select2-container:not(.d-none)",
            run() {
                const aceViewList = document.querySelector("#ace-view-list");
                const studioViewItem = Array.from(aceViewList.querySelectorAll("option")).filter(
                    (el) => {
                        return el.textContent.includes("Odoo Studio");
                    }
                )[0];

                if (!studioViewItem) {
                    throw new Error("There is no studio view");
                }

                const select2 = $(aceViewList).select2();
                select2.val(studioViewItem.value).trigger("change");
            }
        },
        {
            trigger: ".ace_content",
            run() {
                ace.edit("ace-view-editor").setValue("<data/>");
            }
        },
        {
            trigger: ".o_ace_view_editor .o_button_section [data-action='save']"
        },
        {
            trigger: ".o_web_studio_snackbar_icon:not('.fa-spin')"
        },
        {
            trigger: ".o_form_view",
            run() {
                if (document.querySelector(".someDiv")) {
                    throw new Error("The edition of the view's arch via the xml editor failed");
                }
            }
        }
    ]
);

tour.register(
    "web_studio_enter_x2many_edition_and_add_field",
    {
        test: true,
        sequence: 260
    },
    [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']"
        },
        {
            trigger: ".o_form_view .o_form_editable"
        },
        {
            trigger: ".o_web_studio_navbar_item a"
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='user_ids']",
        },
        {
            extra_trigger: ".o-web-studio-edit-x2manys-buttons",
            trigger: ".o_web_studio_editX2Many[data-type='form']"
        },
        {
            extra_trigger: ".o_web_studio_breadcrumb .breadcrumb-item:contains('Subview Form')",
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header"
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='User log entries']",
            run() {
                $(".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='User log entries']")[0].scrollIntoView();
            }
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='User log entries']",
            run: "drag_and_drop (.o_web_studio_form_view_editor .o_web_studio_hook:eq(1))",
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='log_ids']",
            run() {
                const countFields = document.querySelectorAll(".o_web_studio_form_view_editor .o_field_widget").length;
                if (!countFields === 2) {
                    throw new Error("There should be 2 fields in the form view")
                }
            }
        }
    ]
);

tour.register(
    "web_studio_enter_x2many_auto_inlined_subview",
    {
        test: true,
        sequence: 260
    },
    [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']"
        },
        {
            trigger: ".o_form_view .o_form_editable"
        },
        {
            trigger: ".o_web_studio_navbar_item a"
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='user_ids'] .o_field_x2many_list",
        },
        {
            extra_trigger: ".o-web-studio-edit-x2manys-buttons",
            trigger: ".o_web_studio_editX2Many[data-type='list']"
        },
        {
            extra_trigger: ".o_web_studio_breadcrumb .breadcrumb-item:contains('Subview List')",
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header"
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='User log entries']",
            run() {
                $(".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='User log entries']")[0].scrollIntoView();
            }
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='User log entries']",
            run: "drag_and_drop (.o_web_studio_list_view_editor .o_web_studio_hook:eq(1))",
        },
        {
            trigger: ".o_web_studio_list_view_editor th[data-name='log_ids']",
            run() {
                const countFields = document.querySelectorAll(".o_web_studio_form_view_editor th[data-name]").length;
                if (!countFields === 2) {
                    throw new Error("There should be 2 fields in the form view")
                }
            }
        }
    ]
);

tour.register(
    "web_studio_field_with_group",
    {
        test: true,
        sequence: 260
    },
    [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']"
        },
        {
            trigger: ".o_list_view"
        },
        {
            trigger: ".o_web_studio_navbar_item a"
        },
        {
            trigger: ".o_web_studio_list_view_editor th[data-name='function']",
            run() {}
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header"
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='Website Link']",
            run() {
                $(".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='Website Link']")[0].scrollIntoView();
            }
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='Website Link']",
            run: "drag_and_drop (.o_web_studio_list_view_editor th.o_web_studio_hook:eq(2))",
        },
        {
            extra_trigger: ".o_web_studio_list_view_editor th.o_web_studio_hook:not(.o_web_studio_nearest_hook)",
            trigger: ".o_web_studio_list_view_editor th[data-name='website']",
            run() {
                const countFields = document.querySelectorAll(".o_web_studio_list_view_editor th[data-name]").length;
                if (!countFields === 3) {
                    throw new Error("There should be 3 fields in the form view")
                }
            }
        }
    ]
);

tour.register(
    "web_studio_elements_with_groups_form",
    {
        test: true,
        sequence: 260
    },
    [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']"
        },
        {
            trigger: ".o_form_view"
        },
        {
            trigger: ".o_web_studio_navbar_item a"
        },
        {
            trigger: ".o_web_studio_form_view_editor",
            run() {}
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header"
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='Website Link']",
            run() {
                $(".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='Website Link']")[0].scrollIntoView();
            }
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[title='Website Link']",
            run: "drag_and_drop (.o_web_studio_form_view_editor .o_inner_group .o_web_studio_hook:eq(1))",
        },
        {
            extra_trigger: ".o_web_studio_form_view_editor .o_web_studio_hook:not(.o_web_studio_nearest_hook)",
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='website']",
            run() {
                const countFields = document.querySelectorAll(".o_web_studio_form_view_editor .o_field_widget[name]").length;
                if (!countFields === 2) {
                    throw new Error("There should be 2 fields in the form view")
                }
            }
        }
    ]
);
