# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
from datetime import datetime

from odoo.fields import Command
from odoo.tests import Form, common
from odoo.addons.industry_fsm_sale.tests.common import TestFsmFlowSaleCommon


@common.tagged('post_install', '-at_install')
class TestFsmFlowStock(TestFsmFlowSaleCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.product_lot = cls.env['product.product'].create({
            'name': 'Acoustic Magic Bloc',
            'list_price': 2950.0,
            'type': 'product',
            'invoice_policy': 'delivery',
            'taxes_id': False,
            'tracking': 'lot',
        })

        cls.lot_id1 = cls.env['stock.lot'].create({
            'product_id': cls.product_lot.id,
            'name': "Lot_1",
            'company_id': cls.env.company.id,
        })

        cls.lot_id2 = cls.env['stock.lot'].create({
            'product_id': cls.product_lot.id,
            'name': "Lot_2",
            'company_id': cls.env.company.id,
        })

        cls.lot_id3 = cls.env['stock.lot'].create({
            'product_id': cls.product_lot.id,
            'name': "Lot_3",
            'company_id': cls.env.company.id,
        })

        cls.warehouse = cls.env['stock.warehouse'].search([('company_id', '=', cls.env.company.id)], limit=1)
        quants = cls.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': cls.product_lot.id,
            'inventory_quantity': 4,
            'lot_id': cls.lot_id1.id,
            'location_id': cls.warehouse.lot_stock_id.id,
        })
        quants |= cls.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': cls.product_lot.id,
            'inventory_quantity': 2,
            'lot_id': cls.lot_id2.id,
            'location_id': cls.warehouse.lot_stock_id.id,
        })
        quants |= cls.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': cls.product_lot.id,
            'inventory_quantity': 2,
            'lot_id': cls.lot_id3.id,
            'location_id': cls.warehouse.lot_stock_id.id,
        })
        quants.action_apply_inventory()

        cls.storable_product_ordered = cls.env['product.product'].create({
            'name': 'Storable product ordered',
            'list_price': 60,
            'type': 'product',
            'invoice_policy': 'order',
            'taxes_id': False,
        })

        cls.storable_product_delivered = cls.env['product.product'].create({
            'name': 'Storable product delivered',
            'list_price': 75.6,
            'type': 'product',
            'invoice_policy': 'delivery',
            'taxes_id': False,
        })

    def test_fsm_flow(self):
        '''
            3 delivery step
            1. Add product and lot on SO
            2. Check that default lot on picking are not the same as chosen on SO
            3. Validate fsm task
            4. Check that lot on validated picking are the same as chosen on SO
        '''
        self.warehouse.delivery_steps = 'pick_pack_ship'

        self.task.write({'partner_id': self.partner_1.id})
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()
        self.task.sale_order_id.write({
            'order_line': [
                Command.create({
                    'product_id': self.product_lot.id,
                    'product_uom_qty': 3,
                    'fsm_lot_id': self.lot_id2.id,
                })
            ]
        })
        self.task.sale_order_id.action_confirm()

        move = self.task.sale_order_id.order_line.move_ids
        while move.move_orig_ids:
            move = move.move_orig_ids
        self.assertNotEqual(move.move_line_ids.lot_id, self.lot_id2, "Lot automatically added on move lines is not the same as asked. (By default, it's the first lot available)")
        self.task.with_user(self.project_user).action_fsm_validate()
        self.assertEqual(move.move_line_ids.lot_id, self.lot_id2, "Asked lots are added on move lines.")
        self.assertEqual(move.move_line_ids.qty_done, 3, "We deliver 3 (even they are only 2 in stock)")

        self.assertEqual(self.task.sale_order_id.picking_ids.mapped('state'), ['done', 'done', 'done'], "Pickings should be set as done")

    def test_fsm_mixed_pickings(self):
        '''
            1. Add normal product on SO
            2. Validate fsm task
            3. Check that pickings are not auto validated
        '''
        self.task.write({'partner_id': self.partner_1.id})
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()
        self.task.sale_order_id.write({
            'order_line': [
                Command.create({
                    'product_id': self.product_a.id,
                    'product_uom_qty': 1,
                })
            ]
        })
        self.task.sale_order_id.action_confirm()
        self.task.with_user(self.project_user).action_fsm_validate()
        self.assertNotEqual(self.task.sale_order_id.picking_ids.mapped('state'), ['done'], "Pickings should be set as done")

    def test_fsm_flow_with_default_warehouses(self):
        '''
            When the multi warehouses feature is activated, a default warehouse can be set
            on users.
            The user set on a task should be propagated from the task to the sales order
            and his default warehouse set as the warehouse of the SO.
            If the customer has a salesperson assigned to him, the creation of a SO
            from a task overrides this to set the user assigned on the task.
        '''
        warehouse_A = self.env['stock.warehouse'].create({'name': 'WH A', 'code': 'WHA', 'company_id': self.env.company.id, 'partner_id': self.env.company.partner_id.id})
        self.partner_1.write({'user_id': self.uid})

        self.project_user.write({'property_warehouse_id': warehouse_A.id})

        self.task.write({'partner_id': self.partner_1.id})
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()

        self.assertEqual(self.project_user.property_warehouse_id.id, self.task.sale_order_id.warehouse_id.id)
        self.assertEqual(self.project_user.id, self.task.sale_order_id.user_id.id)


    def test_fsm_stock_already_validated_picking(self):
        '''
            1 delivery step
            1. add product and lot on SO
            2. Validate picking with another lot
            3. Open wizard for lot, and ensure that the lot validated is the one chosen in picking
            4. Add a new lot and quantity in wizard
            5. Validate fsm task
            6. Ensure that lot and quantity are correct
        '''
        self.warehouse.delivery_steps = 'ship_only'

        self.task.write({'partner_id': self.partner_1.id})
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()
        self.task.sale_order_id.write({
            'order_line': [
                Command.create({
                    'product_id': self.product_lot.id,
                    'product_uom_qty': 1,
                    'fsm_lot_id': self.lot_id2.id,
                    'task_id': self.task.id,
                })
            ]
        })
        self.task.sale_order_id.action_confirm()

        action_stock_tracking = self.product_lot.with_context({'fsm_task_id': self.task.id}).action_assign_serial()
        self.assertEqual(action_stock_tracking['res_model'], 'fsm.stock.tracking')
        wizard = self.env['fsm.stock.tracking'].browse(action_stock_tracking['res_id'])
        self.assertFalse(wizard.tracking_validated_line_ids, "There aren't validated line")
        self.assertEqual(wizard.tracking_line_ids.product_id, self.product_lot, "There are one line with the right product")
        self.assertEqual(wizard.tracking_line_ids.lot_id, self.lot_id2, "The line has lot_id2")

        move = self.task.sale_order_id.order_line.move_ids
        move.quantity_done = 1
        picking_ids = self.task.sale_order_id.picking_ids
        picking_ids.with_context(skip_sms=True, cancel_backorder=True).button_validate()
        self.assertEqual(picking_ids.mapped('state'), ['done'], "Pickings should be set as done")
        self.assertEqual(move.move_line_ids.lot_id, self.lot_id2, "The line has lot_id2")

        action_stock_tracking = self.product_lot.with_context({'fsm_task_id': self.task.id}).action_assign_serial()
        wizard = self.env['fsm.stock.tracking'].browse(action_stock_tracking['res_id'])
        self.assertFalse(wizard.tracking_line_ids, "There aren't line to validate")
        self.assertEqual(wizard.tracking_validated_line_ids.product_id, self.product_lot, "There are one line with the right product")
        self.assertEqual(wizard.tracking_validated_line_ids.lot_id, self.lot_id2, "The line has lot_id2 (the lot choosed at the beginning)")

        wizard.write({
            'tracking_line_ids': [
                Command.create({
                    'product_id': self.product_lot.id,
                    'quantity': 3,
                    'lot_id': self.lot_id3.id,
                })
            ]
        })
        wizard.generate_lot()

        self.task.with_user(self.project_user).action_fsm_validate()
        order_line_ids = self.task.sale_order_id.order_line.filtered(lambda l: l.product_id == self.product_lot)
        move = order_line_ids.move_ids
        self.assertEqual(len(order_line_ids), 2, "There are 2 order lines.")
        self.assertEqual(move.move_line_ids.lot_id, self.lot_id2 + self.lot_id3, "Lots stay the same.")
        self.assertEqual(sum(move.move_line_ids.mapped('qty_done')), 4, "We deliver 4 (1+3)")

        self.assertEqual(self.task.sale_order_id.picking_ids.mapped('state'), ['done', 'done'], "The 2 pickings should be set as done")

    def test_modify_quantity_for_tracked_product_by_lot_and_sn(self):
        '''
            1. Try to add a product tracked by Lots
            2. Assert failure because Lot validation is missing
            3. Validate Lot Number and assert product is added
            4. Repeat same steps for remove operation
            5. Repeat same steps with a product tracked by Serial Number
        '''
        self.assertFalse(self.task.material_line_product_count, "No product should be linked to a new task")
        self.task.write({'partner_id': self.partner_1.id})

        expected_product_count = 0
        self.product_lot.with_context({'fsm_task_id': self.task.id}).fsm_add_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, "No product should be linked to the task, you should validate Lot Number before")

        action_stock_tracking = self.product_lot.with_context({'fsm_task_id': self.task.id}).action_assign_serial()
        self.assertEqual(action_stock_tracking['res_model'], 'fsm.stock.tracking')
        wizard = self.env['fsm.stock.tracking'].browse(action_stock_tracking['res_id'])
        expected_product_count = 8
        wizard.write({
            'tracking_line_ids': [
                Command.create({
                    'quantity': 3,
                    'lot_id': self.lot_id3.id,
                }),
                Command.create({
                    'quantity': 5,
                    'lot_id': self.lot_id1.id,
                }),
            ],
        })
        wizard.generate_lot()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        self.product_lot.with_context({'fsm_task_id': self.task.id}).fsm_remove_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        wizard.write({
            'tracking_line_ids': [Command.unlink(wizard.tracking_line_ids[0].id)],
        })
        wizard.generate_lot()
        expected_product_count -= 3
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task, you should validate Lot Number before")

        product_tracked_by_sn = self.env['product.product'].create({
            'name': 'Product Storable by Serial Number',
            'list_price': 600,
            'type': 'product',
            'invoice_policy': 'delivery',
            'tracking': 'serial',
        })

        serial1 = self.env['stock.lot'].create({
            'name': 'serial1',
            'product_id': product_tracked_by_sn.id,
            'company_id': self.env.company.id,
        })

        serial2 = self.env['stock.lot'].create({
            'name': 'serial2',
            'product_id': product_tracked_by_sn.id,
            'company_id': self.env.company.id,
        })

        product_tracked_by_sn.with_context({'fsm_task_id': self.task.id}).fsm_add_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task, you should validate Serial Number before")

        product_tracked_by_sn_wizard = product_tracked_by_sn.with_context({'fsm_task_id': self.task.id}).action_assign_serial()
        product_tracked_by_sn_wizard_id = self.env['fsm.stock.tracking'].browse(product_tracked_by_sn_wizard['res_id'])
        expected_product_count += 1
        product_tracked_by_sn_wizard_id.write({
            'tracking_line_ids': [
                Command.create({
                    'lot_id': serial1.id,
                }),
            ],
        })
        product_tracked_by_sn_wizard_id.generate_lot()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")
        product_tracked_by_sn.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).set_fsm_quantity(2)
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task, you should validate Lot Number before")
        product_tracked_by_sn_wizard_id.write({
            'tracking_line_ids': [
                Command.create({
                    'lot_id': serial2.id,
                }),
            ],
        })
        expected_product_count += 1
        product_tracked_by_sn_wizard_id.generate_lot()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task, you should validate Serial Number before")

        product_tracked_by_sn.with_context({'fsm_task_id': self.task.id}).fsm_remove_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task, you should validate Serial Number before, Serial Number validation is mandatory")

        product_tracked_by_sn_wizard_id.write({
            'tracking_line_ids': [
                Command.unlink(product_tracked_by_sn_wizard_id.tracking_line_ids[0].id),
            ],
        })
        product_tracked_by_sn_wizard_id.generate_lot()
        expected_product_count -= 1
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task, you should validate Serial Number before")

    def test_fsm_stock_validate_half_SOL_manually(self):
        '''
            1 delivery step
            1. add product and lot with wizard
            2. Validate SO
            3. In picking, deliver the half of the quantity of the SOL
            4. Open wizard for lot, and ensure that:
                a. the lot validated is the one chosen in picking
                b. the not yet validated line has the half of the quantity
            5. In wizard, add quantity in the non validated line
            6. Validate fsm task
            7. Ensure that lot and quantity are correct
        '''
        self.warehouse.delivery_steps = 'ship_only'

        self.task.write({'partner_id': self.partner_1.id})
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()

        wizard = self.product_lot.with_context({'fsm_task_id': self.task.id}).action_assign_serial()
        wizard_id = self.env['fsm.stock.tracking'].browse(wizard['res_id'])

        wizard_id.write({
            'tracking_line_ids': [
                Command.create({
                    'product_id': self.product_lot.id,
                    'quantity': 5,
                    'lot_id': self.lot_id3.id,
                })
            ]
        })
        wizard_id.generate_lot()

        self.task.sale_order_id.action_confirm()

        order_line_ids = self.task.sale_order_id.order_line.filtered(lambda l: l.product_id == self.product_lot)
        ml_vals = order_line_ids[0].move_ids[0]._prepare_move_line_vals(quantity=0)
        # We chose the quantity to deliver manually
        ml_vals['qty_done'] = 3
        # And we chose the lot
        ml_vals['lot_id'] = self.lot_id2.id
        self.env['stock.move.line'].create(ml_vals)

        # When we validate the picking manually, we create a backorder.
        backorder_wizard_dict = self.task.sale_order_id.picking_ids.button_validate()
        backorder_wizard = Form(self.env[backorder_wizard_dict['res_model']].with_context(backorder_wizard_dict['context'])).save()
        backorder_wizard.process()

        wizard = self.product_lot.with_context({'fsm_task_id': self.task.id}).action_assign_serial()
        wizard_id = self.env['fsm.stock.tracking'].browse(wizard['res_id'])
        self.assertEqual(wizard_id.tracking_line_ids.product_id, self.product_lot, "There are one (non validated) line with the right product")
        self.assertEqual(wizard_id.tracking_line_ids.lot_id, self.lot_id3, "The line has lot_id3, (the lot choosed at the beginning in the wizard)")
        self.assertEqual(wizard_id.tracking_line_ids.quantity, 2, "Quantity is 2 (5 from the beginning in the wizard - 3 already delivered)")
        self.assertEqual(wizard_id.tracking_validated_line_ids.product_id, self.product_lot, "There are one validated line with the right product")
        self.assertEqual(wizard_id.tracking_validated_line_ids.lot_id, self.lot_id2, "The line has lot_id2, (not the lot choosed at the beginning, but the lot put in picking)")
        self.assertEqual(wizard_id.tracking_validated_line_ids.quantity, 3, "Quantity is 3, chosen in the picking")

        # We add 2 to already present quantity on non validated line (2+2=4)
        wizard_id.tracking_line_ids.quantity = 4
        wizard_id.generate_lot()

        self.assertEqual(order_line_ids.product_uom_qty, 7, "Quantity on SOL is 7 (3 already delivered and 4 set in wizard)")
        self.assertEqual(order_line_ids.qty_delivered, 3, "Quantity already delivered is 3, chosen in the picking")

        self.task.with_user(self.project_user).action_fsm_validate()
        order_line_ids = self.task.sale_order_id.order_line.filtered(lambda l: l.product_id == self.product_lot)
        move = order_line_ids.move_ids
        self.assertEqual(len(order_line_ids), 1, "There are 1 order lines, delivered in 2 times (first manually, second with fsm task validation).")
        self.assertEqual(move.move_line_ids.lot_id, self.lot_id2 + self.lot_id3, "Lot stay the same.")
        self.assertEqual(sum(move.move_line_ids.mapped('qty_done')), 7, "We deliver 7 (4+3)")

        self.assertEqual(self.task.sale_order_id.picking_ids.mapped('state'), ['done', 'done'], "The 2 pickings should be set as done")

    def test_action_quantity_set(self):
        self.task.partner_id = self.partner_1
        product = self.product_lot.with_context(fsm_task_id=self.task.id)
        action = product.fsm_add_quantity()
        self.assertEqual(product.fsm_quantity, 0)
        self.assertEqual(action.get('type'), 'ir.actions.act_window', "It should redirect to the tracking wizard")
        self.assertEqual(action.get('res_model'), 'fsm.stock.tracking', "It should redirect to the tracking wizard")


    def test_set_quantity_with_no_so(self):
        self.task.partner_id = self.partner_1
        product = self.consu_product_ordered.with_context(fsm_task_id=self.task.id)
        self.assertFalse(self.task.sale_order_id)
        product.fsm_add_quantity()
        self.assertEqual(product.fsm_quantity, 1)
        order_line = self.task.sale_order_id.order_line
        self.assertEqual(order_line.product_id.id, product.id)
        self.assertEqual(order_line.product_uom_qty, 1)
        self.assertEqual(order_line.qty_delivered, 0)

        product.set_fsm_quantity(5)
        self.assertEqual(product.fsm_quantity, 5)
        self.assertEqual(order_line.product_id.id, product.id)
        self.assertEqual(order_line.product_uom_qty, 5)
        self.assertEqual(order_line.qty_delivered, 0)

        product.set_fsm_quantity(3)
        self.assertEqual(product.fsm_quantity, 3)
        self.assertEqual(order_line.product_id.id, product.id)
        self.assertEqual(order_line.product_uom_qty, 3)
        self.assertEqual(order_line.qty_delivered, 0)

    def test_set_quantity_with_done_so(self):
        self.task.write({'partner_id': self.partner_1.id})
        product = self.consu_product_ordered.with_context({'fsm_task_id': self.task.id})
        product.set_fsm_quantity(1)

        so = self.task.sale_order_id
        line01 = so.order_line[-1]
        self.assertEqual(line01.product_uom_qty, 1)
        so.action_confirm()
        so.picking_ids.button_validate()
        validate_form_data = so.picking_ids.button_validate()
        validate_form = Form(self.env[validate_form_data['res_model']].with_context(validate_form_data['context'])).save()
        validate_form.process()

        product.set_fsm_quantity(3)
        self.assertEqual(line01.product_uom_qty, 3)

    def test_validate_task_before_delivery(self):
        """ Suppose a 3-steps delivery. After confirming the two first steps, the user directly validates the task
        The three pickings should be done with a correct value"""
        product = self.product_a
        task = self.task

        # 3 steps
        self.warehouse.delivery_steps = 'pick_pack_ship'

        product.type = 'product'
        self.env['stock.quant']._update_available_quantity(product, self.warehouse.lot_stock_id, 5)

        task.write({'partner_id': self.partner_1.id})
        task.with_user(self.project_user)._fsm_ensure_sale_order()
        so = task.sale_order_id
        so.write({
            'order_line': [
                Command.create({
                    'product_id': product.id,
                    'product_uom_qty': 1,
                    'task_id': task.id,
                })
            ]
        })
        so.action_confirm()

        # Confirm two first pickings
        for picking in so.picking_ids.sorted(lambda p: p.id)[:2]:
            picking.move_line_ids_without_package.qty_done = 1
            picking.button_validate()

        task.with_user(self.project_user).action_fsm_validate()

        for picking in so.picking_ids:
            self.assertEqual(picking.state, 'done')
            self.assertEqual(len(picking.move_line_ids_without_package), 1)
            self.assertEqual(picking.move_line_ids_without_package.qty_done, 1)

    def test_fsm_qty(self):
        """ Making sure industry_fsm_stock/Product.set_fsm_quantity()
            returns the same result as industry_fsm_sale/Product.set_fsm_quantity()
        """
        self.task.write({'partner_id': self.partner_1.id})
        product = self.consu_product_ordered.with_context({'fsm_task_id': self.task.id})
        self.assertEqual(product.set_fsm_quantity(-1), None)
        self.assertEqual(product.set_fsm_quantity(6), True)
        self.assertEqual(product.set_fsm_quantity(5), True)

        product.tracking = 'lot'
        self.assertIn('name', product.set_fsm_quantity(4))

        product.tracking = 'none'
        self.task.with_user(self.project_user).action_fsm_validate()
        self.task.sale_order_id.sudo().state = 'done'
        self.assertEqual(product.set_fsm_quantity(3), False)

    def test_stock_moves_and_pickings_when_task_is_done(self):
        """
        1) Assert no stock moves, no stock pickings and available qty from storable_product_ordered is 0
        2) Add product and mark task as done
        3) Assert changes on stock moves, stock pickings and available qty from storable_product_ordered
        """
        self.task.write({'partner_id': self.partner_1.id})
        stock_moves = self.env['stock.move'].search([('product_id', '=', self.storable_product_ordered.id)])
        expected_stock_moves_count = 0
        self.assertFalse(stock_moves)
        expected_qty_available = 0
        self.assertEqual(self.storable_product_ordered.qty_available, expected_qty_available)
        expected_stock_pickings_count = 0
        stock_pickings = self.env['stock.picking'].search([('product_id', '=', self.storable_product_ordered.id)])
        self.assertFalse(stock_pickings)

        product_quantity_used_to_add = 6
        self.storable_product_ordered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).set_fsm_quantity(product_quantity_used_to_add)
        self.task.action_fsm_validate()
        stock_moves = self.env['stock.move'].search([('product_id', '=', self.storable_product_ordered.id)])
        expected_stock_moves_count += 1
        self.assertEqual(len(stock_moves), expected_stock_moves_count)
        stock_move = stock_moves[0]
        expected_qty_available -= product_quantity_used_to_add
        self.assertEqual(self.storable_product_ordered.qty_available, expected_qty_available)
        expected_stock_pickings_count += 1
        stock_pickings = self.env['stock.picking'].search([('product_id', '=', self.storable_product_ordered.id)])
        self.assertEqual(len(stock_pickings), expected_stock_pickings_count)
        stock_picking = stock_pickings[0]
        self.assertEqual(stock_picking.product_id, self.storable_product_ordered)
        self.assertEqual(stock_picking.move_ids, stock_move)

    def test_fsm_flow_with_multi_routing(self):
        """
        1) Change delivery_steps to pick_pack_ship
        2) Add Acoustic Bloc Screens to fsm task
        3) Validate task
        4) Assert 3 delivery with done state
        """
        self.warehouse.write({'delivery_steps': 'pick_pack_ship'})
        self.task.write({'partner_id': self.partner_1.id})

        self.assertEqual(self.task.material_line_product_count, 0)
        self.consu_product_ordered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).fsm_add_quantity()
        self.assertEqual(self.task.material_line_product_count, 1)

        self.assertFalse(self.task.sale_order_id.delivery_count)
        self.task.with_user(self.project_user).action_fsm_validate()
        self.assertEqual(self.task.sale_order_id.delivery_count, 3)
        self.assertEqual(self.task.sale_order_id.picking_ids.mapped('state'), ['done', 'done', 'done'], "Pickings should be set as done")

    def test_fsm_delivered_timesheet(self):
        """
        If the fsm has a service_invoice = "delivered_timesheet",
        once we validate the task, the qty_deliverd should be the
        time we logged on the task, not the ordered qty of the so.
        This test is in this module to test for regressions when
        stock module is installed.
        """
        self.task.write({'partner_id': self.partner_1.id})
        product = self.service_product_delivered.with_context({'fsm_task_id': self.task.id})
        # prep the product
        product.type = 'service'
        product.service_policy = 'delivered_timesheet'
        # create the sale order
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()
        sale_order = self.task.sale_order_id
        # sell 4 units of the fsm service
        sale_order_line = self.env['sale.order.line'].create({
            'product_id': product.id,
            'order_id': sale_order.id,
            'name': 'sales order line 0',
            'product_uom_qty': 4,
            'task_id': self.task.id,
        })
        # link the task to the already created sale_order_line,
        # to prevent a new one to be created when we validate the task
        self.task.sale_line_id = sale_order_line.id
        sale_order.action_confirm()
        # timesheet 2 units on the task of the sale order
        timesheet = self.env['account.analytic.line'].create({
            'name': 'Test Line',
            'project_id': self.task.project_id.id,
            'task_id': self.task.id,
            'date': datetime.now(),
            'unit_amount': 2,
            'employee_id': self.employee_user2.id,
        })
        # validate the task
        self.task.with_user(self.project_user).action_fsm_validate()
        self.assertEqual(sale_order.order_line[0].qty_delivered, timesheet.unit_amount,
                         "The delivered quantity should be the same as the timesheet amount")
        self.assertEqual(sale_order.order_line[0].qty_to_invoice, timesheet.unit_amount,
                         "The quantity to invoice should be the same as the timesheet amount")

    def test_child_location_dispatching_serial_number(self):
        """
        1. Create a child location
        2. Create a product and set quantity for the child location
        3. Add to the SO-fsm, one unit of the product
        4. Validate the task
        5. Verify that the location_id of the move-line is the child location
        """
        parent_location = self.warehouse.lot_stock_id
        child_location = self.env['stock.location'].create({
                'name': 'Shell',
                'location_id': parent_location.id,
        })
        product = self.env['product.product'].create({
            'name': 'Cereal',
            'type': 'product',
            'tracking': 'serial',
        })
        sn1 = self.env['stock.lot'].create({
            'name': 'SN0001',
            'product_id': product.id,
            'company_id': self.env.company.id,
        })
        task_sn = self.env['project.task'].create({
            'name': 'Fsm task cereal',
            'user_ids': [(4, self.project_user.id)],
            'project_id': self.fsm_project.id,
        })
        self.env['stock.quant']._update_available_quantity(product, child_location, quantity=1, lot_id=sn1)
        # create so field service
        task_sn.write({'partner_id': self.partner_1.id})
        task_sn.with_user(self.project_user)._fsm_ensure_sale_order()
        task_sn.sale_order_id.action_confirm()
        # add product
        wizard = product.with_context({'fsm_task_id': task_sn.id}).action_assign_serial()
        wizard_id = self.env['fsm.stock.tracking'].browse(wizard['res_id'])
        wizard_id.write({
            'tracking_line_ids': [
                (0, 0, {
                    'product_id': product.id,
                    'lot_id': sn1.id,
                })
            ]
        })
        wizard_id.generate_lot()
        # task: mark as done
        task_sn.with_user(self.project_user).action_fsm_validate()

        self.assertEqual(task_sn.sale_order_id.order_line.move_ids.move_line_ids.location_id, child_location)

    def test_multiple_fsm_task(self):
        """
            1. Create a new so.
            2. Create a field_service product, and 2 sol linked to the so with that product. create the material product to add to the task later on.
            3. Confirm the so.
            4. Adds product to the task created at the confirmation of the so.
            5. Check that the delivery created has the correct amount of each product for each task.
            6. Mark task linked to sol 0 as done.
            7. Check that the qty_delivered of the sol, the qty_done of the move_line of the delivery and the status of the delivery are correct.
            8. Mark task linked to sol 1 as done.
            9. Check that the qty_delivered of the sol, the qty_done of the move_line of the delivery and the status of the delivery are correct.
        """
        # 1. create sale order
        self.task.write({'partner_id': self.partner_1.id})
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()
        sale_order = self.task.sale_order_id
        # 2. create necessary records
        product_field_service, product_a, product_b = self.env['product.product'].create([{
            'name': 'field service',
            'list_price': 885.0,
            'type': 'service',
            'service_policy': 'delivered_timesheet',
            'taxes_id': False,
            'project_id': self.fsm_project.id,
            'service_tracking': 'task_global_project',
        }, {
            'name': 'product A',
            'list_price': 2950.0,
            'type': 'product',
            'invoice_policy': 'delivery',
            'taxes_id': False,
            'tracking': 'lot',
        }, {
            'name': 'product B',
            'list_price': 2950.0,
            'type': 'product',
            'invoice_policy': 'delivery',
            'taxes_id': False,
            'tracking': 'lot',
        }])
        self.env['sale.order.line'].create([{
            'product_id': product_field_service.id,
            'order_id': sale_order.id,
            'name': 'sales order line 0',
        }, {
            'product_id': product_field_service.id,
            'order_id': sale_order.id,
            'name': 'sales order line 1',
        }])
        lot_a, lot_b = self.env["stock.lot"].create([{
            'product_id': product_a.id,
            'name': "Lot_1",
            'company_id': self.env.company.id,
        }, {
            'product_id': product_b.id,
            'name': "Lot_1",
            'company_id': self.env.company.id,
        }])

        # 3. confirm sale order
        sale_order.action_confirm()
        task_sol_0 = sale_order.order_line[0].task_id
        task_sol_1 = sale_order.order_line[1].task_id

        # 4. add products to tasks
        self._add_product_to_fsm_task(product_a, lot_a, task_sol_0, 2)
        self._add_product_to_fsm_task(product_b, lot_b, task_sol_0, 4)
        self._add_product_to_fsm_task(product_a, lot_a, task_sol_1, 1)
        self._add_product_to_fsm_task(product_b, lot_b, task_sol_1, 3)

        self.assertEqual(6, len(sale_order.order_line), "It is expected to have the 2 new sol that were created when the products were added to the task")

        # 5. check that the delivery contains all the materials product from task_sol_0 and task_sol_1
        move_lines = sale_order.picking_ids.move_ids
        sale_order_lines = sale_order.order_line
        self.assertEqual(0, move_lines[0].quantity_done, "the task is no yet done: the qty done must be 0")
        self.assertEqual(2, move_lines[0].product_uom_qty, "quantity must be 2")
        self.assertEqual(product_a, move_lines[0].product_id, "product must be product a")
        self.assertEqual(0, move_lines[1].quantity_done, "the task is no yet done: the qty done must be 0")
        self.assertEqual(4, move_lines[1].product_uom_qty, "quantity must be 4")
        self.assertEqual(product_b, move_lines[1].product_id, "product must be product b")
        self.assertEqual(0, move_lines[2].quantity_done, "the task is no yet done: the qty done must be 0")
        self.assertEqual(1, move_lines[2].product_uom_qty, "quantity must be 1")
        self.assertEqual(product_a, move_lines[2].product_id, "product must be product a")
        self.assertEqual(0, move_lines[3].quantity_done, "the task is no yet done: the qty done must be 0")
        self.assertEqual(3, move_lines[3].product_uom_qty, "quantity must be 3")
        self.assertEqual(product_b, move_lines[3].product_id, "product must be product b")

        # 6. task 1: mark as done
        task_sol_0.with_user(self.project_user).action_fsm_validate()
        # 7. only the move_line corresponding to task_sol_0 must change. The delivery must not be set as 'done'.
        self.assertEqual(2, move_lines[0].quantity_done, "quantity done must be set to 2")
        self.assertEqual(4, move_lines[1].quantity_done, "quantity done must be set to 4")
        self.assertEqual(0, move_lines[2].quantity_done, "quantity done must not change, since its task is not yet marked as done")
        self.assertEqual(0, move_lines[3].quantity_done, "quantity done must not change, since its task is not yet marked as done")
        self.assertEqual(2, sale_order_lines[2].qty_delivered, "quantity delivered must be set to 2")
        self.assertEqual(4, sale_order_lines[3].qty_delivered, "quantity delivered must be set to 4")
        self.assertEqual(0, sale_order_lines[4].qty_delivered, "quantity delivered must not change, since its task is not yet marked as done")
        self.assertEqual(0, sale_order_lines[5].qty_delivered, "quantity delivered must not change, since its task is not yet marked as done")
        self.assertEqual('confirmed', sale_order.picking_ids[0].state, "state must not change as some products have yet to be send")

        # 8. task 1: mark as done
        task_sol_1.with_user(self.project_user).action_fsm_validate()
        # 9. only the move_line corresponding to task_sol_1 must change. The delivery must be set as 'done'.
        self.assertEqual(2, move_lines[0].quantity_done, "marking the next task as done must not change the precedent validation")
        self.assertEqual(4, move_lines[1].quantity_done, "marking the next task as done must not change the precedent validation")
        self.assertEqual(1, move_lines[2].quantity_done, "quantity done must be set to 1")
        self.assertEqual(3, move_lines[3].quantity_done, "quantity done must be set to 3")
        self.assertEqual(2, sale_order_lines[2].qty_delivered, "marking the next task as done must not change the precedent validation")
        self.assertEqual(4, sale_order_lines[3].qty_delivered, "marking the next task as done must not change the precedent validation")
        self.assertEqual(1, sale_order_lines[4].qty_delivered, "quantity delivered must be set to 1")
        self.assertEqual(3, sale_order_lines[5].qty_delivered, "quantity delivered must be set to 3")
        self.assertEqual('done', sale_order.picking_ids[0].state, "all products have been sent, the delivery must be mark as done")

    def _add_product_to_fsm_task(self, product, lot, task, qty):
        wizard = product.with_context(fsm_task_id=task.id).action_assign_serial()
        wizard_id = self.env['fsm.stock.tracking'].browse(wizard['res_id'])
        wizard_id.write({
            'tracking_line_ids': [
                (0, 0, {
                    'product_id': product.id,
                    'quantity': qty,
                    'lot_id': lot.id,
                })
            ]
        })
        wizard_id.generate_lot()

    def test_fsm_update_salesperson(self):
        '''Check that the edit of the person assigned to a task of the field service project updates the salesperson on the sale order.'''
        # create a project that does not have the fsm tag (fsm_project exists)
        other_project = self.env['project.project'].create({
            'name': 'Other Project',
            'is_fsm': False,
        })
        # create service products
        product_field_service, product_other_service = self.env['product.product'].create([
            {
                'name': "Field service product",
                'type': 'service',
                'service_tracking': 'task_global_project',
                'project_id': self.fsm_project.id,
            },
            {
                'name': "Other service product",
                'type': 'service',
                'service_tracking': 'task_global_project',
                'project_id': other_project.id,
            }
        ])
        # create sales
        sale_order_field_service, sale_order_other_service = self.env['sale.order'].with_context(mail_notrack=True, mail_create_nolog=True).create([
            {'partner_id': self.partner_1.id},
            {'partner_id': self.partner_1.id},
        ])
        sale_order_lines = self.env['sale.order.line'].create([
            {
                'order_id': sale_order_field_service.id,
                'name': product_field_service.name,
                'product_id': product_field_service.id,
            },
            {
                'order_id': sale_order_other_service.id,
                'name': product_other_service.name,
                'product_id': product_other_service.id,
            },
        ])
        sales_orders = sale_order_field_service + sale_order_other_service
        # confirm sales to create the related task automatically
        sales_orders.action_confirm()
        # check salespersons
        self.assertEqual(sale_order_field_service.user_id, self.env.user)
        self.assertEqual(sale_order_other_service.user_id, self.env.user)
        # create other users
        project_user2, project_user3 = self.env['res.users'].create([
            {
                'name': 'User 2',
                'login': 'user2',
            },
            {
                'name': 'User 3',
                'login': 'user3',
            }
        ])
        # change the person assigned to the task
        sales_orders.state = 'draft'
        sale_order_lines.task_id.write({
                'user_ids': [Command.set([self.project_user.id, project_user2.id, project_user3.id])]
        })
        sales_orders.action_confirm()
        # check that there is a change only for the sale order which concerns the field service
        self.assertEqual(sale_order_field_service.user_id, self.project_user, 'The salesperson must have been updated')
        self.assertEqual(sale_order_other_service.user_id, self.env.user, 'The salesperson must not have been updated')
