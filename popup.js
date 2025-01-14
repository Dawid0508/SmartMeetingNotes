document.addEventListener("DOMContentLoaded", ()=>{
    // GET THE SELECTORS OF THE BUTTONS
    const startVideoButton = document.querySelector("button#start-recording")
    const stopVideoButton = document.querySelector("button#stop-recording")

    // adding event listeners

    startVideoButton.addEventListener("click", ()=>{
        const statusElement = document.getElementById("status");
        statusElement.innerText = "Rozpoczynanie nagrania...";

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {action: "request_recording"},  function(response){
                if(!chrome.runtime.lastError){
                    console.log(response)
                } else{
                    console.log(chrome.runtime.lastError, 'error line 14')
                }
            })
        } )
    })


    stopVideoButton.addEventListener("click", ()=>{
        const statusElement = document.getElementById("status");
        statusElement.innerText = "Zakończenie nagrywania.";

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {action: "stopvideo"},  function(response){
                if(!chrome.runtime.lastError){
                    console.log(response)
                } else{
                    console.log(chrome.runtime.lastError, 'error line 27')
                }
            })
        } )
    })
})
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