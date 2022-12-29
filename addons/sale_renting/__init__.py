# -*- coding: utf-8 -*-

from . import models
from . import wizard
from . import report
from odoo.tools.sql import column_exists

def _pre_init_rental(cr):
    """ Allow installing sale_renting in databases with large sale.order / sale.order.line tables.
    The different rental fields are all NULL (falsy) for existing sale orders,
    the computation is way more efficient in SQL than in Python.
    """
    if not column_exists(cr, 'sale_order', 'rental_status'):
        cr.execute("""
            ALTER TABLE "sale_order"
            ADD COLUMN "rental_status" VARCHAR,
            ADD COLUMN "has_pickable_lines" bool,
            ADD COLUMN "has_returnable_lines" bool,
            ADD COLUMN "next_action_date" timestamp
        """)
        cr.execute("""
            ALTER TABLE "sale_order_line"
            ADD COLUMN "reservation_begin" timestamp,
            ADD COLUMN "start_date" timestamp
        """)
