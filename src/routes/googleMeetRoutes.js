const express = require('express');
const router = express.Router();
const googleMeetService = require('../services/googleMeetService');
const { protect, authorize } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(protect);
router.use(tenantMiddleware);
router.use(authorize('admin', 'hr', 'company_admin'));

/**
 * Test Google Meet service connection
 * GET /api/google-meet/test
 */
router.get('/test', async (req, res) => {
  try {
    const result = await googleMeetService.testConnection();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        details: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Google Meet test route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Google Meet service',
      error: error.message
    });
  }
});

/**
 * Create a Google Meet space
 * POST /api/google-meet/create-space
 */
router.post('/create-space', async (req, res) => {
  try {
    const { title, coOwners = [] } = req.body;
    
    const result = await googleMeetService.createMeetingSpace({
      title: title || 'Interview Meeting',
      coOwners
    });
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Google Meet space created successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to create Google Meet space',
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Create Google Meet space error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Google Meet space',
      error: error.message
    });
  }
});

/**
 * Create a complete interview meeting (space + calendar event)
 * POST /api/google-meet/create-interview-meeting
 */
router.post('/create-interview-meeting', async (req, res) => {
  try {
    const interviewDetails = req.body;
    
    const result = await googleMeetService.createInterviewMeeting(interviewDetails);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Interview meeting created successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to create interview meeting',
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Create interview meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create interview meeting',
      error: error.message
    });
  }
});

/**
 * Get meeting space details
 * GET /api/google-meet/space/:spaceId
 */
router.get('/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;
    
    const result = await googleMeetService.getMeetingSpace(spaceId);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Failed to get meeting space',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get meeting space error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get meeting space',
      error: error.message
    });
  }
});

/**
 * Create calendar event
 * POST /api/google-meet/create-calendar-event
 */
router.post('/create-calendar-event', async (req, res) => {
  try {
    const eventDetails = req.body;
    
    const result = await googleMeetService.createCalendarEvent(eventDetails);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Calendar event created successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to create calendar event',
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create calendar event',
      error: error.message
    });
  }
});

/**
 * Update calendar event
 * PUT /api/google-meet/calendar-event/:eventId
 */
router.put('/calendar-event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;
    
    const result = await googleMeetService.updateCalendarEvent(eventId, updates);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Calendar event updated successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to update calendar event',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update calendar event',
      error: error.message
    });
  }
});

/**
 * Delete calendar event
 * DELETE /api/google-meet/calendar-event/:eventId
 */
router.delete('/calendar-event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const result = await googleMeetService.deleteCalendarEvent(eventId);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to delete calendar event',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete calendar event',
      error: error.message
    });
  }
});

module.exports = router;
