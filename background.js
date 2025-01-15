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
            console.error(chrome.runtime.lastError);
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

function fetchUpcomingEvents(sendResponse) {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
            console.error(chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError });
            return;
        }

        fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?orderBy=startTime&singleEvents=true&timeMin=' + new Date().toISOString(), {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
            .then(response => response.json())
            .then(data => {
                console.log('Upcoming events:', data.items);
                sendResponse({ events: data.items });

                // Schedule recordings for upcoming events
                data.items.forEach(event => {
                    if (event.start && event.start.dateTime && event.end && event.end.dateTime) {
                        scheduleRecording(event.start.dateTime, event.end.dateTime);
                    }
                });
            })
            .catch((error) => {
                console.error('Error fetching events:', error);
                sendResponse({ error: 'Error fetching events.', details: error });
            });
    });
}

function scheduleRecording(startDateTime, endDateTime) {
    const startTime = new Date(startDateTime).getTime();
    const endTime = new Date(endDateTime).getTime();
    const currentTime = Date.now();
    const startDelay = startTime - currentTime;
    const endDelay = endTime - currentTime;

    if (startDelay > 0) {
        console.log(`Scheduling screen recording to start in ${startDelay} milliseconds`);
        setTimeout(() => {
            startRecording();
        }, startDelay);
    } else {
        console.log('Event start time is in the past. Cannot schedule start recording.');
    }

    if (endDelay > 0) {
        console.log(`Scheduling screen recording to stop in ${endDelay} milliseconds`);
        setTimeout(() => {
            stopRecording();
        }, endDelay);
    } else {
        console.log('Event end time is in the past. Cannot schedule stop recording.');
    }
}

// Inject content script when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && /^http/.test(tab.url)) {
        chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"]
        }).then(() => {
            console.log("we have injected the content script");
        }).catch(err => console.log(err, "error in background script line 10"));
    }
});