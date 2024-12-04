//logika nagrywania i przetwarzania
let mediaRecorder;
let recordedChunks = [];

chrome.runtime.onMessage.addListener((message) => {
    if (message.command === "start-recording") {
        navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, {type: 'audio/webm'});
                const fileReader = new FileReader();
                fileReader.onload = () => sendToServer(fileReader.result);
            };

        });
    }

    if (message.command === "stop-recording") {
        mediaRecorder.stop();
    }
});

/**
 * The function `sendToServer` sends audio data to a server for conversion and then logs the
 * transcription result.
 * @param audioData - The `audioData` parameter in the `sendToServer` function is expected to be the
 * audio data that needs to be sent to the server for conversion. This data should be in the form of a
 * binary/octet-stream, as indicated by the `"Content-Type": "application/octet-stream"` header in
 */
function sendToServer(audioData) {
    fetch("http://localhost:3000/convert", {
        method: "POST",
        headers: {"Content-Type": "application/octet-stream"},
        body: audioData
    }).then((response) => response.json())
        .then((data) => console.log("Transkrypcja:", data.transcription));
}