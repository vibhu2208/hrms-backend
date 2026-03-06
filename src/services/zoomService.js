const axios = require('axios');
const jwt = require('jsonwebtoken');

/**
 * Zoom Service for HRMS
 * Handles Zoom meeting creation via Zoom API
 * Uses JWT authentication for server-to-server communication
 */
class ZoomService {
  constructor() {
    this.apiKey = process.env.ZOOM_API_KEY;
    this.apiSecret = process.env.ZOOM_API_SECRET;
    this.baseUrl = process.env.ZOOM_API_BASE_URL || 'https://api.zoom.us/v2';
    this.enabled = !!(this.apiKey && this.apiSecret);

    if (!this.enabled) {
      console.warn('⚠️ Zoom API credentials not configured. Zoom meeting creation will be disabled.');
    }

    // Create axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Generate JWT token for Zoom API authentication
   * @returns {string} JWT token
   */
  generateJWTToken() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Zoom API credentials not configured');
    }

    const payload = {
      iss: this.apiKey,
      exp: Math.floor(Date.now() / 1000) + 3600 // Token expires in 1 hour
    };

    try {
      const token = jwt.sign(payload, this.apiSecret, { algorithm: 'HS256' });
      return token;
    } catch (error) {
      console.error('❌ Failed to generate Zoom JWT token:', error);
      throw new Error('Failed to generate Zoom authentication token');
    }
  }

  /**
   * Create a Zoom meeting
   * @param {Object} meetingData - Meeting configuration
   * @param {string} meetingData.topic - Meeting topic/title
   * @param {string} meetingData.startTime - Start time in ISO 8601 format (e.g., "2024-02-23T10:00:00Z")
   * @param {number} meetingData.duration - Duration in minutes (default: 30)
   * @param {string} meetingData.timezone - Timezone (default: "UTC")
   * @param {Object} meetingData.settings - Optional meeting settings
   * @returns {Promise<Object>} Meeting creation result with meetingLink and meetingId
   */
  async createMeeting(meetingData) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Zoom API credentials not configured'
      };
    }

    const {
      topic,
      startTime,
      duration = 30,
      timezone = 'UTC',
      settings = {}
    } = meetingData;

    // Validate required fields
    if (!topic || !startTime) {
      return {
        success: false,
        error: 'Topic and startTime are required'
      };
    }

    try {
      // Generate JWT token
      const token = this.generateJWTToken();

      // Prepare meeting payload
      const meetingPayload = {
        topic: topic,
        type: 2, // Scheduled meeting
        start_time: startTime,
        duration: duration,
        timezone: timezone,
        settings: {
          join_before_host: settings.join_before_host !== undefined ? settings.join_before_host : true,
          waiting_room: settings.waiting_room !== undefined ? settings.waiting_room : false,
          host_video: settings.host_video !== undefined ? settings.host_video : true,
          participant_video: settings.participant_video !== undefined ? settings.participant_video : true,
          mute_upon_entry: settings.mute_upon_entry !== undefined ? settings.mute_upon_entry : false,
          watermark: settings.watermark !== undefined ? settings.watermark : false,
          use_pmi: false, // Don't use Personal Meeting ID
          approval_type: 0, // Automatically approve
          registration_type: 0, // No registration required
          audio: 'both', // Both telephony and VoIP
          auto_recording: 'none' // Don't auto-record
        }
      };

      // Make API request to create meeting
      const response = await this.axiosInstance.post(
        '/users/me/meetings',
        meetingPayload,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data && response.data.join_url) {
        console.log('✅ Zoom meeting created successfully:', response.data.id);
        return {
          success: true,
          meetingLink: response.data.join_url,
          meetingId: response.data.id.toString(),
          startUrl: response.data.start_url, // Host URL (optional, for future use)
          topic: response.data.topic,
          startTime: response.data.start_time,
          duration: response.data.duration
        };
      } else {
        return {
          success: false,
          error: 'Invalid response from Zoom API'
        };
      }
    } catch (error) {
      console.error('❌ Failed to create Zoom meeting:', error.message);
      
      // Extract error message from Zoom API response if available
      let errorMessage = 'Failed to create Zoom meeting';
      if (error.response) {
        const zoomError = error.response.data;
        if (zoomError && zoomError.message) {
          errorMessage = zoomError.message;
        } else if (zoomError && zoomError.error) {
          errorMessage = zoomError.error.message || zoomError.error;
        } else {
          errorMessage = `Zoom API error: ${error.response.status} ${error.response.statusText}`;
        }
        
        // Add specific guidance for common errors
        if (error.response.status === 401) {
          errorMessage += '\n\n💡 Possible fixes:\n1. Ensure you have a JWT app (not OAuth app) in Zoom Marketplace\n2. Check that your app is activated and has "Meeting" scope\n3. Verify API Key and Secret are correct';
        } else if (error.response.status === 403) {
          errorMessage += '\n\n💡 Possible fixes:\n1. Check if your Zoom app has the required permissions\n2. Ensure your account has Pro/Business license';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Check if Zoom service is enabled and configured
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

// Export singleton instance
module.exports = new ZoomService();
