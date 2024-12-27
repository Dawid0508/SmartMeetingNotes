const { response } = require("express");

//logika interfejsu użytkownika
const recordTab = document.querySelector("#tab");
const recordScreen = document.querySelector("#screen");

document.getElementById("start-recording").addEventListener("click", ()=> {
    console.log("Rozpoczęto nagrywanie"); // Log rozpoczęcia nagrywania
    chrome.runtime.sendMessage({command: "start-recording"});
    document.getElementById("status").textContent = "Nagrywanie w toku...";
    document.getElementById("stop-recording").disabled = false;
});

document.getElementById("stop-recording").addEventListener("click", ()=> {
    console.log("Zakończono nagrywanie"); // Log zakończenia nagrywania
    chrome.runtime.sendMessage({command: "stop-recording"});
    document.getElementById("status").textContent = "Nagrywanie zakończone.";
    document.getElementById("stop-recording").disabled = true;
})

