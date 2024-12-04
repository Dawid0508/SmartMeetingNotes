//logika interfejsu użytkownika

document.getElementById("start-recording").addEventListener("click", ()=> {
    chrome.runtime.sendMessage({command: "start-recording"});
    document.getElementById("status").textContent = "Nagrywanie w toku...";
    document.getElementById("stop-recording").disabled = false;
});

document.getElementById("stop-recording").addEventListener("click", ()=> {
    chrome.runtime.sendMessage({command: "stop-recording"});
    document.getElementById("status").textContent = "Nagrywanie zakończone.";
    document.getElementById("stop-recording").disabled = true;
})

