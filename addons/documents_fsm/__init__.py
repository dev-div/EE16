# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models

from odoo import api, SUPERUSER_ID


def _documents_fsm_post_init(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    fsm_projects = env["project.project"].search([("is_fsm", "=", True), ("use_documents", "=", True)])
    read_group_var = (
        env["documents.document"]
        .with_context(active_test=False)
        ._read_group(
            [("folder_id", "in", fsm_projects.documents_folder_id.ids)],
            ["folder_id"],
            ["folder_id"],
        )
    )
    workspaces_doc_count = {d["folder_id"][0]: d["folder_id_count"] for d in read_group_var}
    for project in fsm_projects:
        if project.document_count == 0:
            project.use_documents = False

            if workspaces_doc_count.get(project.documents_folder_id.id, 0) == 0:
                project.documents_folder_id.unlink()
            else:
                project.documents_folder_id = False
