document.addEventListener("DOMContentLoaded", () => {
    const startVideoButton = document.querySelector("button#start-recording");
    const stopVideoButton = document.querySelector("button#stop-recording");
    const createEventButton = document.querySelector("button#create-event");
    const submitEventButton = document.querySelector("button#submit-event");
    const eventForm = document.getElementById("event-form");
    const emailInput = document.getElementById("email");
    const addEmailButton = document.getElementById("add-email");
    const emailList = document.getElementById("email-list");

    function fetchEmails() {
        fetch('http://localhost:3000/emails')
            .then(response => response.json())
            .then(data => {
                emailList.innerHTML = '';
                data.emails.forEach(email => {
                    const listItem = document.createElement('li');
                    listItem.textContent = email;
                    listItem.addEventListener('click', () => {
                        fetch('http://localhost:3000/delete-email', {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ email })
                        })
                            .then(response => response.json())
                            .then(data => {
                                console.log('Email deleted:', email); // Log when email is deleted
                                fetchEmails(); // Refresh the email list
                            })
                            .catch(error => {
                                console.error('Error:', error);
                            });
                    });
                    emailList.appendChild(listItem);
                });
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

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

    addEmailButton.addEventListener("click", () => {
        const email = emailInput.value.trim();
        if (email) {
            fetch('http://localhost:3000/submit-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Email added successfully') {
                        console.log('Email added:', email); // Log when email is added
                        fetchEmails(); // Refresh the email list
                        emailInput.value = ''; // Clear the input field
                    } else {
                        alert(data.message);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        }
    });

    fetchEmails(); // Fetch and display emails when the popup is opened
});