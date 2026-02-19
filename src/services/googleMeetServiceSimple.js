/**
 * Simple Google Meet Service for Testing
 * This creates mock Google Meet links for testing purposes
 * Replace with real Google Meet API integration once OAuth is configured
 */

class GoogleMeetServiceSimple {
  constructor() {
    console.log('✅ Simple Google Meet service initialized (mock mode)');
  }

  /**
   * Create a mock Google Meet link for testing
   * @param {Object} meetingDetails - Meeting configuration
   * @returns {Promise<Object>} Mock meeting details
   */
  async createMeetingSpace(meetingDetails = {}) {
    try {
      // Generate a random meet code (similar to Google Meet format)
      const meetCode = this.generateMeetCode();
      const meetUri = `https://meet.google.com/${meetCode}`;
      
      console.log('🔧 Creating mock Google Meet space with code:', meetCode);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        spaceId: `spaces/${meetCode}`,
        meetingUri: meetUri,
        meetingCode: meetCode,
        joinUrl: meetUri,
        phoneAccess: {
          phone: '+1-555-123-4567',
          pin: meetCode.slice(-4)
        },
        adminRequest: null
      };
    } catch (error) {
      console.error('❌ Failed to create mock Google Meet space:', error.message);
      return {
        success: false,
        error: error.message,
        code: 'MOCK_ERROR'
      };
    }
  }

  /**
   * Generate a Google Meet-style code
   * @returns {string} Random meet code
   */
  generateMeetCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      if (i === 3 || i === 7) {
        result += '-';
      } else {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return result;
  }

  /**
   * Create a mock calendar event
   * @param {Object} eventDetails - Calendar event configuration
   * @returns {Promise<Object>} Mock calendar event details
   */
  async createCalendarEvent(eventDetails) {
    try {
      const eventId = `event_${Date.now()}`;
      const eventLink = `https://calendar.google.com/calendar/event?eid=${eventId}`;
      
      console.log('🔧 Creating mock calendar event:', eventId);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        eventId: eventId,
        eventLink: eventLink,
        meetLink: eventDetails.conferenceData?.createRequest ? 
          `https://meet.google.com/${this.generateMeetCode()}` : null,
        attendees: eventDetails.attendees?.map(email => ({ email, responseStatus: 'needsAction' })) || [],
        startTime: eventDetails.start,
        endTime: eventDetails.end
      };
    } catch (error) {
      console.error('❌ Failed to create mock calendar event:', error.message);
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
      console.log('🚀 Creating complete mock interview meeting:', interviewDetails);

      // Create mock Google Meet space
      const spaceResult = await this.createMeetingSpace({
        title: `${interviewDetails.interviewType} Interview - ${interviewDetails.candidateName}`,
        coOwners: interviewDetails.interviewers || []
      });

      if (!spaceResult.success) {
        throw new Error(`Failed to create meeting space: ${spaceResult.error}`);
      }

      // Create mock calendar event
      const startTime = new Date(`${interviewDetails.scheduledDate}T${interviewDetails.scheduledTime}`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later

      const eventResult = await this.createCalendarEvent({
        title: `${interviewDetails.interviewType} Interview - ${interviewDetails.candidateName}`,
        description: `
Interview Details:
- Position: ${interviewDetails.position || 'TBD'}
- Candidate: ${interviewDetails.candidateName} (${interviewDetails.candidateEmail})
- Interview Type: ${interviewDetails.interviewType}
- Company: ${interviewDetails.companyName || 'TechThrive System'}

Join the meeting: ${spaceResult.joinUrl}

This is an automated interview invitation from the HRMS system.
        `.trim(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        attendees: [
          interviewDetails.candidateEmail,
          ...(interviewDetails.interviewers || [])
        ].filter(Boolean),
        location: 'Google Meet',
        conferenceData: {
          createRequest: {
            requestId: `interview-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        }
      });

      console.log('✅ Mock interview meeting created successfully');

      return {
        success: true,
        meetingSpace: spaceResult,
        calendarEvent: eventResult,
        meetingLink: spaceResult.joinUrl,
        calendarLink: eventResult.eventLink,
        eventId: eventResult.eventId,
        note: 'This is a mock Google Meet service for testing. Replace with real Google API integration.'
      };
    } catch (error) {
      console.error('❌ Failed to create mock interview meeting:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test the service connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      // Simulate a quick test
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        success: true,
        message: 'Mock Google Meet service connection successful',
        spacesCount: 0,
        note: 'This is a mock service. Replace with real Google Meet API integration.'
      };
    } catch (error) {
      console.error('❌ Mock Google Meet service connection test failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect to mock Google Meet service'
      };
    }
  }
}

// Export singleton instance
const googleMeetServiceSimple = new GoogleMeetServiceSimple();
module.exports = googleMeetServiceSimple;
