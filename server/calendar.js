const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
}

// Read the credentials from the file specified by the environment variable
const credentialsPath = path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS);
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

async function authorize() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
        },
        projectId: credentials.project_id,
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    return authClient;
}

async function createEvent(auth, eventDetails) {
    const calendar = google.calendar({ version: 'v3', auth });
    const event = {
        summary: eventDetails.summary,
        location: eventDetails.location,
        description: eventDetails.description,
        start: {
            dateTime: eventDetails.startDateTime,
            timeZone: eventDetails.timeZone,
        },
        end: {
            dateTime: eventDetails.endDateTime,
            timeZone: eventDetails.timeZone,
        },
    };

    try {
        console.log('Creating event with details:', event);
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });
        console.log('Event created successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error creating event:', error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { authorize, createEvent };