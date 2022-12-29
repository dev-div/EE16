# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.appointment.tests.common import AppointmentCommon


class AppointmentOnboardingTest(AppointmentCommon):
    def test_no_error_if_steps_are_deleted(self):
        """Simulate the case where
            1. Someone opens the onboarding step from the onboarding panel
            2. The step record is deleted
            3. The first user tries to validate the step
        """
        appointment_onboarding_panel = self.env.ref('appointment.appointment_onboarding_panel')
        # Simulate controller to create onboarding_progress_id
        appointment_onboarding_panel._search_or_create_progress()

        self.env.ref('appointment.appointment_onboarding_create_appointment_type_step').unlink()
        # Step 1 is directly called from web client
        self.assertTrue(
            self.env['onboarding.onboarding.step'].action_save_appointment_onboarding_create_appointment_type_step())

        # Step 2 is validated from the wizard method
        wizard = self.env['appointment.onboarding.link'].create({
            'appointment_type_id': self.apt_type_bxls_2days.id,
            'short_code': 'something123'
        })
        # The wizard can also try to validate step 1 and shouldn't crash if it is missing
        res = wizard.search_or_create_onboarding_invite()
        self.assertIn('bookUrl', res, 'search_or_create_onboarding_invite should return a link when step 1 is missing.')
        self.assertTrue(res['wasFirstValidation'],
                        'wasFirstValidated should be True in order to refresh the onboarding panel when step 1 is missing.')

        # Also for step 2
        self.env.ref('appointment.appointment_onboarding_preview_invite_step').unlink()
        res = wizard.search_or_create_onboarding_invite()
        self.assertIn('bookUrl', res, 'search_or_create_onboarding_invite should return a link when step 2 is missing.')
        self.assertTrue(res['wasFirstValidation'],
                        'wasFirstValidated should be True in order to refresh the onboarding panel when step 2 is missing.')

        self.env.ref('appointment.appointment_onboarding_configure_calendar_provider_step').unlink()
        # Step 3 is directly called from web client
        self.env['onboarding.onboarding.step'].action_save_appointment_onboarding_configure_calendar_provider_step()
