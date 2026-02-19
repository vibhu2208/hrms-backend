const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

class GoogleMeetService {
  constructor() {
    this.auth = null;
    this.meet = null;
    this.calendar = null;
    this.initializeAuth();
  }

  initializeAuth() {
    try {
      // Initialize OAuth2 client for user authentication
      this.auth = new google.auth.OAuth2({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI
      });

      // Initialize Google Meet API
      this.meet = google.meet({ version: 'v2', auth: this.auth });
      this.calendar = google.calendar({ version: 'v3', auth: this.auth });

      console.log('✅ Google Meet service initialized with OAuth2');
    } catch (error) {
      console.error('❌ Failed to initialize Google Meet service:', error.message);
      throw error;
    }
  }

  /**
   * Set user credentials for authenticated requests
   * @param {string} accessToken - User's OAuth2 access token
   */
  setUserCredentials(accessToken) {
    this.auth.setCredentials({
      access_token: accessToken
    });
    console.log('✅ User credentials set for Google Meet service');
  }

  /**
   * Create a new Google Meet space
   * @param {Object} meetingDetails - Meeting configuration
   * @returns {Promise<Object>} Meeting space details
   */
  async createMeetingSpace(meetingDetails = {}) {
    try {
      const config = {
        name: meetingDetails.title || 'Interview Meeting',
        // Meeting configuration
        config: {
          accessType: 'OPEN', // Anyone with the link can join
          regionCode: 'US', // Default region
          locale: 'en',
          entryPointAccess: 'ALL',
          moderation: 'DISABLED', // No moderation required
          coOwners: meetingDetails.coOwners || []
        }
      };

      console.log('🔧 Creating Google Meet space with config:', JSON.stringify(config, null, 2));

      const response = await this.meet.spaces.create({
        requestBody: config
      });

      const space = response.data;
      console.log('✅ Google Meet space created:', space.name);

      return {
        success: true,
        spaceId: space.name,
        meetingUri: space.meetingUri,
        meetingCode: space.meetingCode,
        // Additional meeting details
        joinUrl: `https://meet.google.com/${space.meetingCode}`,
        phoneAccess: space.phoneAccess || null,
        adminRequest: space.adminRequest || null
      };
    } catch (error) {
      console.error('❌ Failed to create Google Meet space:', error.message);
      
      // Return detailed error information
      return {
        success: false,
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        details: error.response?.data || null
      };
    }
  }

  /**
   * Get meeting space details
   * @param {string} spaceId - The space identifier
   * @returns {Promise<Object>} Meeting space details
   */
  async getMeetingSpace(spaceId) {
    try {
      const response = await this.meet.spaces.get({
        name: spaceId
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Failed to get meeting space:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a calendar event with Google Meet integration
   * @param {Object} eventDetails - Calendar event configuration
   * @returns {Promise<Object>} Calendar event details
   */
  async createCalendarEvent(eventDetails) {
    try {
      const {
        title,
        description,
        startTime,
        endTime,
        attendees = [],
        location = 'Google Meet',
        timeZone = 'America/New_York'
      } = eventDetails;

      const event = {
        summary: title,
        description: description,
        start: {
          dateTime: startTime,
          timeZone: timeZone
        },
        end: {
          dateTime: endTime,
          timeZone: timeZone
        },
        attendees: attendees.map(email => ({ email })),
        location: location,
        conferenceData: {
          createRequest: {
            requestId: `interview-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 } // 30 minutes before
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: 1
      });

      const createdEvent = response.data;
      console.log('✅ Calendar event created:', createdEvent.id);

      return {
        success: true,
        eventId: createdEvent.id,
        eventLink: createdEvent.htmlLink,
        meetLink: createdEvent.conferenceData?.conference?.entryPoints?.[0]?.uri,
        attendees: createdEvent.attendees,
        startTime: createdEvent.start,
        endTime: createdEvent.end
      };
    } catch (error) {
      console.error('❌ Failed to create calendar event:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Update an existing calendar event
   * @param {string} eventId - Event ID to update
   * @param {Object} updates - Event updates
   * @returns {Promise<Object>} Updated event details
   */
  async updateCalendarEvent(eventId, updates) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: updates
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Failed to update calendar event:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a calendar event
   * @param {string} eventId - Event ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteCalendarEvent(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });

      return {
        success: true,
        message: 'Calendar event deleted successfully'
      };
    } catch (error) {
      console.error('❌ Failed to delete calendar event:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a complete interview meeting (space + calendar event)
   * @param {Object} interviewDetails - Interview configuration
   * @returns {Promise<Object>} Complete meeting details
   */
  async createInterviewMeeting(interviewDetails) {
    try {
      const {
        candidateName,
        candidateEmail,
        interviewType,
        scheduledDate,
        scheduledTime,
        duration = 60, // Default 60 minutes
        interviewers = [],
        position,
        companyName = 'TechThrive System'
      } = interviewDetails;

      console.log('🚀 Creating complete interview meeting:', { candidateName, interviewType, scheduledDate, scheduledTime });

      // Create Google Meet space first
      const spaceResult = await this.createMeetingSpace({
        title: `${interviewType} Interview - ${candidateName}`,
        coOwners: interviewers
      });

      if (!spaceResult.success) {
        throw new Error(`Failed to create meeting space: ${spaceResult.error}`);
      }

      // Prepare calendar event attendees
      const attendees = [
        candidateEmail,
        ...interviewers
      ].filter(Boolean);

      // Create calendar event with Google Meet
      const startTime = new Date(`${scheduledDate}T${scheduledTime}`);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      const eventResult = await this.createCalendarEvent({
        title: `${interviewType} Interview - ${candidateName}`,
        description: `
Interview Details:
- Position: ${position || 'TBD'}
- Candidate: ${candidateName} (${candidateEmail})
- Interview Type: ${interviewType}
- Company: ${companyName}

Join the meeting: ${spaceResult.joinUrl}

This is an automated interview invitation from the HRMS system.
        `.trim(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        attendees: attendees,
        timeZone: 'UTC'
      });

      if (!eventResult.success) {
        console.warn('⚠️ Calendar event creation failed, but meeting space was created:', eventResult.error);
        // Return meeting space details even if calendar fails
        return {
          success: true,
          meetingSpace: spaceResult,
          calendarEvent: null,
          warning: 'Meeting space created but calendar event failed'
        };
      }

      console.log('✅ Complete interview meeting created successfully');

      return {
        success: true,
        meetingSpace: spaceResult,
        calendarEvent: eventResult,
        meetingLink: spaceResult.joinUrl,
        calendarLink: eventResult.eventLink,
        eventId: eventResult.eventId
      };
    } catch (error) {
      console.error('❌ Failed to create interview meeting:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test the Google Meet service connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      // Test by listing available spaces (should work even if no spaces exist)
      const response = await this.meet.spaces.list({
        pageSize: 1
      });

      return {
        success: true,
        message: 'Google Meet service connection successful',
        spacesCount: response.data.spaces?.length || 0
      };
    } catch (error) {
      console.error('❌ Google Meet service connection test failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect to Google Meet service'
      };
    }
  }
}

// Export singleton instance
const googleMeetService = new GoogleMeetService();
module.exports = googleMeetService;
