// dopecuts-server/src/routes/calendar.routes.ts
import { Router } from 'express';
import {
    getCalendarSettings,
    updateCalendarSettings,
    getWeeklySchedules,
    updateWeeklySchedules,
    getAvailability,
    getTimezone,
} from '../controllers/calendar.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

/**
 * @route   GET api/v1/calendar/settings
 * @desc    Get all calendar availability settings
 * @access  Public
 */
router.get('/settings', getCalendarSettings);

/**
 * @route GET api/v1/calendar/timezone
 * @desc  Get the business timezone
 * @access Public
 */
router.get('/timezone', getTimezone);

/**
 * @route   PUT api/v1/calendar/settings
 * @desc    Update the calendar availability settings
 * @access  Private (Admin only)
 */
router.put('/settings', isAdmin, updateCalendarSettings);

/**
 * @route   GET api/v1/calendar/weeks
 * @desc    Get weekly availability schedules
 * @access  Public
 */
router.get('/weeks', getWeeklySchedules);

/**
 * @route   PUT api/v1/calendar/weeks
 * @desc    Update weekly availability schedules
 * @access  Private (Admin only)
 */
router.put('/weeks', isAdmin, updateWeeklySchedules);

/**
 * @route   GET api/v1/calendar/availability/:date
 * @desc    Get available time slots for a given date
 * @access  Public
 */
router.get('/availability/:date', getAvailability);

export default router;
