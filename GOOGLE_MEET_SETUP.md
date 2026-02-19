# Google Meet Integration Setup Guide

This guide will help you set up Google Meet integration for your HRMS application.

## Prerequisites

1. **Google Cloud Project**: You need a Google Cloud project with billing enabled
2. **Google Workspace Account**: For full Google Meet API access
3. **Admin Access**: To configure service account permissions

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for the project (required for Google Meet API)

## Step 2: Enable APIs

Enable the following APIs in your Google Cloud project:

1. **Google Meet API**
   - Go to APIs & Services > Library
   - Search for "Google Meet API"
   - Click "Enable"

2. **Google Calendar API**
   - Search for "Google Calendar API" 
   - Click "Enable"

## Step 3: Create Service Account

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "Service Account"
3. Fill in service account details:
   - **Name**: HRMS Google Meet Integration
   - **Service account ID**: hrms-google-meet@your-project.iam.gserviceaccount.com
   - **Description**: Service account for HRMS Google Meet integration
4. Click "Create and Continue"
5. Skip granting roles for now (we'll configure permissions separately)
6. Click "Done"

## Step 4: Generate Service Account Key

1. Find your service account in the list
2. Click on the service account name
3. Go to "Keys" tab
4. Click "Add Key" > "Create new key"
5. Select "JSON" as key type
6. Click "Create"
7. Download the JSON file and keep it secure

## Step 5: Configure Service Account Permissions

### For Google Workspace Domains:

1. **Google Workspace Admin Console**:
   - Go to [Admin Console](https://admin.google.com/)
   - Navigate to Security > API Controls > Domain-wide Delegation
   - Click "Add New"
   - Enter the service account email
   - Add the following OAuth scopes:
     ```
     https://www.googleapis.com/auth/meetings.space.created
     https://www.googleapis.com/auth/meetings.space.readonly
     https://www.googleapis.com/auth/calendar
     https://www.googleapis.com/auth/calendar.events
     ```
   - Click "Authorize"

### For Calendar Sharing:

1. Share your calendar with the service account:
   - Open Google Calendar
   - Find the calendar you want to use
   - Click "Settings and sharing"
   - Under "Share with specific people", add the service account email
   - Give it "Make changes to events" permission

## Step 6: Update Environment Variables

Add the following to your `.env` file:

```bash
# Google Meet Integration Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key content here\n-----END PRIVATE KEY-----\n"
GOOGLE_ADMIN_EMAIL=admin@yourcompany.com
```

**Important**: 
- Copy the service account email from the JSON key file
- Copy the private key from the JSON file, replacing `\n` with actual newlines or using `\n` escape sequences
- Use an admin email that has Google Meet permissions

## Step 7: Test the Integration

1. Restart your backend server
2. Test the Google Meet service:
   ```bash
   curl -X GET http://localhost:5000/api/google-meet/test \
   -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## Step 8: Use the Integration

### In the Interview Scheduling Modal:

1. Select "Google Meet" as the meeting platform
2. Fill in interview date and time
3. Click "Create Meet" button
4. The system will:
   - Create a Google Meet space
   - Generate a meeting link
   - Create a calendar event (if configured)
   - Send invitations to interviewers

### Manual Meeting Creation:

You can also use the API endpoints directly:

```bash
# Create a meeting space
curl -X POST http://localhost:5000/api/google-meet/create-space \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Interview Meeting"}'

# Create complete interview meeting
curl -X POST http://localhost:5000/api/google-meet/create-interview-meeting \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "candidateName": "John Doe",
    "candidateEmail": "john@example.com",
    "interviewType": "Technical",
    "scheduledDate": "2024-01-15",
    "scheduledTime": "14:00",
    "interviewers": ["interviewer@company.com"],
    "position": "Software Engineer"
  }'
```

## Troubleshooting

### Common Issues:

1. **"Invalid Credentials" Error**
   - Check if service account email is correct
   - Verify private key format (should include newlines properly)
   - Ensure Google Meet API is enabled

2. **"Permission Denied" Error**
   - Verify domain-wide delegation is configured
   - Check if admin email has proper permissions
   - Ensure calendar is shared with service account

3. **"Meeting Creation Failed" Error**
   - Check Google Meet API quotas
   - Verify service account has required scopes
   - Check network connectivity to Google APIs

### Debug Mode:

Enable debug logging by setting:
```bash
NODE_ENV=development
```

This will provide detailed logs in the console for troubleshooting.

## Security Considerations

1. **Secure Storage**: Store service account keys securely
2. **Principle of Least Privilege**: Only grant necessary permissions
3. **Regular Rotation**: Rotate service account keys periodically
4. **Monitoring**: Monitor API usage and unusual activity

## API Limits and Quotas

- Google Meet API has usage quotas
- Monitor your API usage in Google Cloud Console
- Consider implementing rate limiting in production

## Support

For issues related to:
- **Google Cloud Setup**: Contact Google Cloud Support
- **API Integration**: Check application logs and error messages
- **Permissions**: Verify Google Workspace admin settings

## Features Included

✅ **Automatic Meeting Creation**: Create Google Meet spaces instantly
✅ **Calendar Integration**: Automatic calendar events for interviewers
✅ **Email Notifications**: Automatic email invitations
✅ **Meeting Management**: Update and cancel meetings
✅ **Error Handling**: Comprehensive error handling and logging
✅ **Security**: Secure authentication and authorization

The Google Meet integration is now ready to use in your HRMS application!
