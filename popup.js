document.addEventListener("DOMContentLoaded", () => {

    const startVideoButton = document.querySelector("button#start-recording");
    const stopVideoButton = document.querySelector("button#stop-recording");
    const createEventButton = document.querySelector("button#create-event");
    const submitEventButton = document.querySelector("button#submit-event");
    const eventForm = document.getElementById("event-form");


    startVideoButton.addEventListener("click", () => {
        const statusElement = document.getElementById("status");
        statusElement.innerText = "Rozpoczynanie nagrania...";

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "request_recording" }, function (response) {
                if (!chrome.runtime.lastError) {
                    console.log(response);
                } else {
                    console.log(chrome.runtime.lastError, 'error line 14');
                }
            });
        });
    });

    stopVideoButton.addEventListener("click", () => {
        const statusElement = document.getElementById("status");
        statusElement.innerText = "Zakończenie nagrywania.";

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "stopvideo" }, function (response) {
                if (!chrome.runtime.lastError) {
                    console.log(response);
                } else {
                    console.log(chrome.runtime.lastError, 'error line 27');
                }
            });
        });
    });

    createEventButton.addEventListener("click", () => {
        eventForm.style.display = eventForm.style.display === "none" ? "block" : "none";
    });

    submitEventButton.addEventListener("click", () => {
        const startDateTime = new Date(document.getElementById("startDateTime").value);
        const endDateTime = new Date(document.getElementById("endDateTime").value);
        const statusElement = document.getElementById("status");

        if (endDateTime <= startDateTime) {
            statusElement.innerText = "Koniec spotkania nie może wyprzedzać początku.";
            return;
        }

        const eventDetails = {
            summary: document.getElementById("summary").value,
            location: document.getElementById("location").value,
            description: document.getElementById("description").value,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: document.getElementById("timeZone").value
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: document.getElementById("timeZone").value
            }
        };

        chrome.runtime.sendMessage({ action: 'plan', eventDetails }, (response) => {
            if (response && response.error) {
                console.error('Błąd przy tworzeniu wydarzenia:', response.error);
                statusElement.innerText = "Wystąpił błąd przy tworzeniu wydarzenia.";
            } else {
                console.log('Event created:', response.data);
                statusElement.innerText = "Wydarzenie utworzono poprawnie!";
                eventForm.style.display = "none"; // Hide the form after submission
            }
        });
    });

    document.getElementById('email').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            const email = document.getElementById('email').value;
            fetch('/submit-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email })
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Sukces:', data);
                })
                .catch(error => {
                    console.error('Błąd:', error);
                });
        }
    });
});