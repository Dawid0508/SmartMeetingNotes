let mediaRecorder;
let recordedChunks = [];
let currentStream; // Zmienna globalna dla przechowywanego strumienia

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "start-recording") {
        // Uzyskanie strumienia w background.js
        navigator.mediaDevices
            .getDisplayMedia({ audio: true, video: false })
            .then((stream) => {
                currentStream = stream; // Przechowaj strumień
                startRecording(stream);
                sendResponse({ success: true, message: "Nagrywanie rozpoczęte." });
            })
            .catch((error) => {
                console.error("Nie udało się uzyskać strumienia:", error);
                sendResponse({ success: false, message: "Nie udało się przechwycić strumienia." });
            });
        return true; // Wskazuje, że odpowiedź będzie asynchroniczna
    }

    if (message.command === "stop-recording") {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();

            // Zatrzymaj strumień
            if (currentStream) {
                currentStream.getTracks().forEach((track) => track.stop());
                currentStream = null;
            }

            sendResponse({ success: true, message: "Nagrywanie zatrzymane." });
        } else {
            console.warn("Nagrywanie nie zostało rozpoczęte.");
            sendResponse({ success: false, message: "Brak aktywnego nagrywania." });
        }
    }
});

/**
 * Funkcja obsługująca nagrywanie danych audio.
 * @param {MediaStream} stream - Strumień do nagrywania.
 */
function startRecording(stream) {
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });

        // Wyślij dane na serwer
        sendToServer(blob);

        // Zatrzymaj strumień
        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
            currentStream = null;
        }

        console.log("Nagrywanie zakończone, strumień zatrzymany.");
    };

    mediaRecorder.start();
    console.log("Nagrywanie rozpoczęte.");
}

/**
 * Funkcja wysyłająca dane audio na serwer.
 * @param {Blob} audioData - Dane audio do przesłania.
 */
function sendToServer(audioData) {
    console.log("Wysyłanie danych na serwer...");
    fetch("http://localhost:3000/convert", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: audioData
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Błąd serwera: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            console.log("Transkrypcja:", data.transcription);
        })
        .catch((error) => {
            console.error("Nie udało się połączyć z serwerem:", error.message);
        });
}
