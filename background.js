console.log("Hello, background working");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'start') {
        startRecording();
        sendResponse({ message: 'Recording started' });
    } else if (message.action === 'stop') {
        stopRecording();
        sendResponse({ message: 'Recording stopped' });
    } else if (message.action === 'plan') {
        planMeeting(message.eventDetails, sendResponse);
        return true; // Indicates that the response will be sent asynchronously
    } else if (message.action === 'fetchEvents') {
        fetchUpcomingEvents(sendResponse);
        return true; // Indicates that the response will be sent asynchronously
    } else if (message.action === 'log') {
        console.log(message.message);
    }
});

function startRecording() {
    // Implement screen recording start logic
    console.log('Screen recording started');
}

function stopRecording() {
    // Implement screen recording stop logic
    console.log('Screen recording stopped');
}

function planMeeting(eventDetails, sendResponse) {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
            sendResponse({ error: chrome.runtime.lastError });
            return;
        }

        console.log('Sending request to create event with details:', eventDetails);

        fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(eventDetails)
        })
            .then(response => response.json())
            .then(data => {
                console.log('Event created:', data);
                sendResponse({ message: 'Event created successfully!', data });

                // Send event details to the server for logging
                fetch('http://localhost:3000/log-event', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(eventDetails)
                })
                    .then(logResponse => logResponse.json())
                    .then(logData => {
                        console.log('Event details logged:', logData);
                    })

                // Schedule screen recording
                scheduleRecording(eventDetails.start.dateTime, eventDetails.end.dateTime);
            })
            .catch((error) => {
                console.error('Error creating event:', error);
                sendResponse({ error: 'Error creating event.', details: error });
            });
    });
}

// Inject content script when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && /^http/.test(tab.url)) {
        chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"]
        }).then(() => {
            console.log("Content script injected successfully into tab:", tabId);
        }).catch(err => {
            console.error("Error injecting content script into tab:", tabId, "Error:", err);
        });
    }
});