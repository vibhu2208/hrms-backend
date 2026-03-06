const axios = require('axios');

/**
 * Zoom OAuth Service for HRMS
 * Handles Zoom meeting creation via Server-To-Server OAuth authentication
 */
class ZoomOAuthService {
  constructor() {
    this.clientId = process.env.ZOOM_CLIENT_ID;
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
    this.accountId = process.env.ZOOM_ACCOUNT_ID;
    this.baseUrl = process.env.ZOOM_API_BASE_URL || 'https://api.zoom.us/v2';
    this.enabled = !!(this.clientId && this.clientSecret && this.accountId);
    this.accessToken = null;
    this.tokenExpiry = null;

    if (!this.enabled) {
      console.warn('⚠️ Zoom OAuth credentials not configured. Zoom meeting creation will be disabled.');
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
   * Get OAuth access token
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    if (!this.enabled) {
      throw new Error('Zoom OAuth credentials not configured');
    }

    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://zoom.us/oauth/token',
        null,
        {
          params: {
            grant_type: 'account_credentials',
            account_id: this.accountId
          },
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        // Set expiry to 1 minute before actual expiry to be safe
        this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
        console.log('✅ Zoom OAuth access token obtained successfully');
        console.log('📋 Token scopes:', response.data.scope || 'No scopes specified');
        return this.accessToken;
      } else {
        throw new Error('Invalid response from OAuth token endpoint');
      }
    } catch (error) {
      console.error('❌ Failed to get Zoom OAuth access token:', error.message);
      if (error.response) {
        console.error('OAuth Response:', error.response.status, error.response.data);
      }
      throw new Error('Failed to obtain Zoom access token');
    }
  }

  /**
   * Create a Zoom meeting using OAuth
   * @param {Object} meetingData - Meeting configuration
   * @returns {Promise<Object>} Meeting creation result
   */
  async createMeeting(meetingData) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Zoom OAuth credentials not configured'
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
      // Get access token
      const token = await this.getAccessToken();

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
        console.log('✅ Zoom meeting created successfully via OAuth:', response.data.id);
        return {
          success: true,
          meetingLink: response.data.join_url,
          meetingId: response.data.id.toString(),
          startUrl: response.data.start_url,
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
      console.error('❌ Failed to create Zoom meeting via OAuth:', error.message);
      
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
          errorMessage += '\n\n💡 Possible fixes:\n1. Ensure your Server-to-Server OAuth app is activated\n2. Check that your app has "meeting:write:admin" scope\n3. Verify Client ID, Client Secret, and Account ID are correct';
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
module.exports = new ZoomOAuthService();
