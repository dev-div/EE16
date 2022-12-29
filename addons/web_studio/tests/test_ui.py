# Part of Odoo. See LICENSE file for full copyright and licensing details.
# -*- coding: utf-8 -*-
from lxml import etree

import odoo.tests
from odoo import Command, api, http
from odoo.tools import mute_logger
from odoo.addons.web_studio.controllers.main import WebStudioController
from lxml import etree


@odoo.tests.tagged('post_install', '-at_install')
class TestUi(odoo.tests.HttpCase):

    def test_new_app_and_report(self):
        self.start_tour("/web", 'web_studio_new_app_tour', login="admin")

        # the report tour is based on the result of the former tour
        self.start_tour("/web?debug=tests", 'web_studio_new_report_tour', login="admin")
        self.start_tour("/web?debug=tests", "web_studio_new_report_basic_layout_tour", login="admin")

    def test_optional_fields(self):
        self.start_tour("/web?debug=tests", 'web_studio_hide_fields_tour', login="admin")

    def test_model_option_value(self):
        self.start_tour("/web?debug=tests", 'web_studio_model_option_value_tour', login="admin")

    def test_rename(self):
        self.start_tour("/web?debug=tests", 'web_studio_tests_tour', login="admin", timeout=200)

    def test_approval(self):
        self.start_tour("/web?debug=tests", 'web_studio_approval_tour', login="admin")

    def test_background(self):
        attachment = self.env['ir.attachment'].create({
            'datas': b'R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs=',
            'name': 'testFilename.gif',
            'public': True,
            'mimetype': 'image/gif'
        })
        self.env.company.background_image = attachment.datas
        self.start_tour("/web?debug=tests", 'web_studio_custom_background_tour', login="admin")

    def test_create_app_with_pipeline_and_user_assignment(self):
        # Mute the logger for read_group, indeed, because of the field
        # x_studio_sequence that is created during the tour, this method will
        # trigger a warning
        web_read_group = type(self.env["base"]).web_read_group
        @mute_logger("odoo.models")
        @api.model
        def muted_web_read_group(self, *args, **kwargs):
            return web_read_group(self, *args, **kwargs)

        self.patch(type(self.env["base"]), "web_read_group", muted_web_read_group)
        self.start_tour("/web?debug=tests", 'web_studio_create_app_with_pipeline_and_user_assignment', login="admin")

    def test_alter_field_existing_in_multiple_views(self):
        created_model_name = None
        studio_model_create = type(self.env["ir.model"]).studio_model_create
        def mock_studio_model_create(*args, **kwargs):
            nonlocal created_model_name
            res = studio_model_create(*args, **kwargs)
            created_model_name = res[0].model
            return res

        self.patch(type(self.env["ir.model"]), "studio_model_create", mock_studio_model_create)
        self.start_tour("/web?debug=tests", 'web_studio_alter_field_existing_in_multiple_views_tour', login="admin")

        # we can't assert xml equality as a lot of stuff in the arch are set randomly
        view = self.env["ir.ui.view"].search([("model", "=", created_model_name), ("type", "=", "form")], limit=1)
        tree = etree.fromstring(view.get_combined_arch())
        root = tree.getroottree()

        fields_of_interest = tree.xpath("//field[@name='message_partner_ids']")
        self.assertEqual(len(fields_of_interest), 2)

        # First field is on the main model: not below another field
        # The second one is in a subview
        self.assertEqual(root.getpath(fields_of_interest[0]), "/form/sheet/group/group[1]/field")
        self.assertEqual(root.getpath(fields_of_interest[1]), "/form/sheet/field[2]/tree/field[1]")

        # The tour in its final steps is putting invisible on the field in the subview
        self.assertEqual(fields_of_interest[0].get("invisible"), None)
        self.assertEqual(fields_of_interest[1].get("invisible"), "1")


def _get_studio_view(view):
    domain = [('inherit_id', '=', view.id), ('name', '=', "Odoo Studio: %s customization" % (view.name))]
    return view.search(domain, order='priority desc, name desc, id desc', limit=1)

def _transform_arch_for_assert(arch_string):
    parser = etree.XMLParser(remove_blank_text=True)
    arch_string = etree.fromstring(arch_string, parser=parser)
    return etree.tostring(arch_string, pretty_print=True, encoding='unicode')

def assertViewArchEqual(test, original, expected):
    if original:
        original = _transform_arch_for_assert(original)
    if expected:
        expected = _transform_arch_for_assert(expected)
    test.assertEqual(original, expected)

def watch_edit_view(test, on_edit_view):
    clear_routing = test.env["ir.http"]._clear_routing_map

    clear_routing()
    edit_view = WebStudioController.edit_view

    @http.route('/web_studio/edit_view', type='json', auth='user')
    def edit_view_mocked(*args, **kwargs):
        on_edit_view(*args, **kwargs)
        return edit_view(*args, **kwargs)

    test.patch(WebStudioController, "edit_view", edit_view_mocked)
    test.addCleanup(clear_routing)


@odoo.tests.tagged('post_install', '-at_install')
class TestStudioUIUnit(odoo.tests.HttpCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.testView = cls.env["ir.ui.view"].create({
            "name": "simple partner",
            "model": "res.partner",
            "type": "form",
            "arch": '''
                <form>
                    <field name="name" />
                </form>
            '''
        })
        cls.testAction = cls.env["ir.actions.act_window"].create({
            "name": "simple partner",
            "res_model": "res.partner",
            "view_ids": [Command.create({"view_id": cls.testView.id, "view_mode": "form"})]
        })
        cls.testActionXmlId = cls.env["ir.model.data"].create({
            "name": "studio_test_partner_action",
            "model": "ir.actions.act_window",
            "module": "web_studio",
            "res_id": cls.testAction.id,
        })
        cls.testMenu = cls.env["ir.ui.menu"].create({
            "name": "Studio Test Partner",
            "action": "ir.actions.act_window,%s" % cls.testAction.id
        })
        cls.testMenuXmlId = cls.env["ir.model.data"].create({
            "name": "studio_test_partner_menu",
            "model": "ir.ui.menu",
            "module": "web_studio",
            "res_id": cls.testMenu.id,
        })

    def test_form_view_not_altered_by_studio_xml_edition(self):
        self.start_tour("/web?debug=tests", 'web_studio_test_form_view_not_altered_by_studio_xml_edition', login="admin", timeout=200)

    def test_edit_with_xml_editor(self):
        studioView = self.env["ir.ui.view"].create({
            'type': self.testView.type,
            'model': self.testView.model,
            'inherit_id': self.testView.id,
            'mode': 'extension',
            'priority': 99,
            'arch': "<data><xpath expr=\"//field[@name='name']\" position=\"after\"> <div class=\"someDiv\"/></xpath></data>",
            'name': "Odoo Studio: %s customization" % (self.testView.name)
        })

        self.start_tour("/web?debug=tests", 'web_studio_test_edit_with_xml_editor', login="admin", timeout=200)
        self.assertEqual(studioView.arch, "<data/>")

    def test_enter_x2many_edition_and_add_field(self):
        doesNotHaveGroup = self.env["res.groups"].create({
            "name": "studio does not have"
        })
        doesNotHaveGroupXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_doesnothavegroup",
            "model": "res.groups",
            "module": "web_studio",
            "res_id": doesNotHaveGroup.id,
        })

        userView = self.env["ir.ui.view"].create({
            "name": "simple user",
            "model": "res.users",
            "type": "form",
            "arch": '''
                <form>
                    <t groups="{doesnothavegroup}" >
                        <div class="condition_group" />
                    </t>
                    <group>
                        <field name="name" />
                    </group>
                </form>
            '''.format(doesnothavegroup=doesNotHaveGroupXmlId.complete_name)
        })

        userViewXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_user_view",
            "model": "ir.ui.view",
            "module": "web_studio",
            "res_id": userView.id,
        })

        self.testView.arch = '''<form><field name="user_ids" context="{'form_view_ref': '%s'}" /></form>''' % userViewXmlId.complete_name
        studioView = _get_studio_view(self.testView)
        self.assertFalse(studioView.exists())

        self.start_tour("/web?debug=tests", 'web_studio_enter_x2many_edition_and_add_field', login="admin", timeout=200)
        studioView = _get_studio_view(self.testView)

        assertViewArchEqual(self, studioView.arch, """
            <data>
               <xpath expr="//field[@name='user_ids']" position="inside">
                 <form>
                   <t groups="{doesnothavegroup}" >
                     <div class="condition_group" />
                   </t>
                   <group>
                     <field name="name"/>
                     <field name="log_ids"/>
                   </group>
                 </form>
               </xpath>
             </data>
            """.format(doesnothavegroup=doesNotHaveGroupXmlId.complete_name))

    def test_enter_x2many_auto_inlined_subview(self):
        userView = self.env["ir.ui.view"].create({
            "name": "simple user",
            "model": "res.users",
            "type": "tree",
            "arch": '''
                <tree>
                    <field name="display_name" />
                </tree>
            '''
        })

        userViewXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_user_view",
            "model": "ir.ui.view",
            "module": "web_studio",
            "res_id": userView.id,
        })

        self.testView.arch = '''<form><field name="user_ids" context="{'tree_view_ref': '%s'}" /></form>''' % userViewXmlId.complete_name
        studioView = _get_studio_view(self.testView)
        self.assertFalse(studioView.exists())

        self.start_tour("/web?debug=tests", 'web_studio_enter_x2many_auto_inlined_subview', login="admin", timeout=200)
        studioView = _get_studio_view(self.testView)

        assertViewArchEqual(self, studioView.arch, """
            <data>
               <xpath expr="//field[@name='user_ids']" position="inside">
                 <tree>
                   <field name="display_name" />
                   <field name="log_ids" optional="show" />
                 </tree>
               </xpath>
             </data>
            """)

    def test_field_with_group(self):
        operations = []
        def edit_view_mocked(*args, **kwargs):
            operations.extend(kwargs["operations"] if "operations" in kwargs else args[3])

        watch_edit_view(self, edit_view_mocked)

        doesNotHaveGroup = self.env["res.groups"].create({
            "name": "studio does not have"
        })
        doesNotHaveGroupXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_doesnothavegroup",
            "model": "res.groups",
            "module": "web_studio",
            "res_id": doesNotHaveGroup.id,
        })
        self.testView.write({
            "type": "tree",
            "arch": '''
                <tree>
                    <field name="display_name" />
                    <field name="employee" groups="{doesnothavegroup}" />
                    <field name="function" />
                    <field name="lang" />
                </tree>
            '''.format(doesnothavegroup=doesNotHaveGroupXmlId.complete_name)
        })
        self.testAction.write({
            "view_ids": [Command.clear(), Command.create({"view_id": self.testView.id, "view_mode": "tree"})]
        })

        self.start_tour("/web?debug=tests", 'web_studio_field_with_group', login="admin", timeout=200)

        self.assertEqual(len(operations), 1)
        self.assertEqual(operations[0]["target"]["xpath_info"], [{'tag': 'tree', 'indice': 1}, {'tag': 'field', 'indice': 3}])
        studioView = _get_studio_view(self.testView)
        assertViewArchEqual(self, studioView.arch, """
             <data>
                <xpath expr="//field[@name='function']" position="after">
                    <field name="website" optional="show"/>
                </xpath>
            </data>
        """)

    def test_elements_with_groups_form(self):
        operations = []
        def edit_view_mocked(*args, **kwargs):
            operations.extend(kwargs["operations"] if "operations" in kwargs else args[3])

        watch_edit_view(self, edit_view_mocked)

        doesNotHaveGroup = self.env["res.groups"].create({
            "name": "studio does not have"
        })
        doesNotHaveGroupXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_doesnothavegroup",
            "model": "res.groups",
            "module": "web_studio",
            "res_id": doesNotHaveGroup.id,
        })

        hasGroup = self.env["res.groups"].create({
            "name": "studio has group",
            "users": [Command.link(2)]
        })
        hasGroupXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_hasgroup",
            "model": "res.groups",
            "module": "web_studio",
            "res_id": hasGroup.id,
        })

        self.patch(type(self.env["res.partner"]).function, "groups", doesNotHaveGroupXmlId.complete_name)

        self.testView.write({
            "arch": '''
                <form>
                    <group>
                        <field name="function" groups="{hasgroup}" />
                        <field name="employee" groups="{doesnothavegroup}" />
                        <field name="display_name" />
                    </group>
                </form>
            '''.format(doesnothavegroup=doesNotHaveGroupXmlId.complete_name, hasgroup=hasGroupXmlId.complete_name)
        })
        self.start_tour("/web", 'web_studio_elements_with_groups_form', login="admin", timeout=600000)
        self.assertEqual(len(operations), 1)
        self.assertEqual(operations[0]["target"]["xpath_info"], [{'indice': 1, 'tag': 'form'}, {'indice': 1, 'tag': 'group'}, {'indice': 3, 'tag': 'field'}])
        studioView = _get_studio_view(self.testView)
        assertViewArchEqual(self, studioView.arch, """
            <data>
               <xpath expr="//field[@name='display_name']" position="after">
                 <field name="website"/>
               </xpath>
            </data>
        """)
