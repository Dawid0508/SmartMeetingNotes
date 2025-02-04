(function () {
    if (window.hasRun) {
        return;
    }
    window.hasRun = true;

    console.log("Content script injected successfully!");

    let recorder = null;
    let audioContext;
    let destination;
    let displayStream;
    let micStream;

    function onAccessApproved(stream) {
        recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm; codecs=vp8,opus'
        });

        recorder.start();
        chrome.runtime.sendMessage({ action: "log", message: "Recording started" });

        recorder.onstop = function () {
            stream.getTracks().forEach(track => {
                if (track.readyState === "live") {
                    track.stop();
                }
            });
            displayStream?.getTracks().forEach(track => track.stop());
        };

        recorder.ondataavailable = function (event) {
            let recordedBlob = event.data;
            let url = URL.createObjectURL(recordedBlob);
            let a = document.createElement("a");

            a.style.display = "none";
            a.href = url;
            a.download = "screen-recording.webm";

            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);

            URL.revokeObjectURL(url);

            processAudio(recordedBlob);
        };
    }

    async function processAudio(audioBlob) {
        console.log('Preparing to send file');
        console.log('Blob size:', audioBlob.size, 'bytes');

        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');

        try {
            const response = await fetch('http://localhost:3000/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Error transcribing audio:', error);
                alert(`Error: ${error.error}, Details: ${error.details}`);
                return;
            }

            const result = await response.json();
            console.log('Transcription:', result.transcription);
            alert(`Transcription: ${result.transcription}`);
        } catch (error) {
            console.error('Error transcribing audio:', error);
        }
    }

    async function getAudioDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'audioinput');
    }

    async function getUserSelectedMicrophone() {
        const audioDevices = await getAudioDevices();
        if (audioDevices.length === 0) {
            throw new Error('No audio input devices found');
        }

        const selectedDevice = audioDevices[0];
        console.log(`Selected microphone: ${selectedDevice.label}`);
        return selectedDevice.deviceId;
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "request_recording") {
            chrome.runtime.sendMessage({ action: "log", message: "requesting recording" });

            sendResponse(`processed: ${message.action}`);

            navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: 1920,
                    height: 1080,
                },
                audio: true
            }).then(async (stream) => {
                displayStream = stream;
                try {
                    audioContext = new AudioContext();
                    destination = audioContext.createMediaStreamDestination();

                    const deviceId = await getUserSelectedMicrophone();
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            deviceId: { exact: deviceId },
                            echoCancellation: true,
                            noiseSuppression: true,
                            sampleRate: 44100
                        }
                    });

                    const displaySource = audioContext.createMediaStreamSource(displayStream);
                    const micSource = audioContext.createMediaStreamSource(micStream);

                    // Create gain nodes to adjust volume
                    const displayGain = audioContext.createGain();
                    const micGain = audioContext.createGain();

                    // Adjust gain levels
                    displayGain.gain.value = 1.0;
                    micGain.gain.value = 1.0; 

                    // Connect sources to gain nodes
                    displaySource.connect(displayGain);
                    micSource.connect(micGain);

                    // Connect gain nodes to destination
                    displayGain.connect(destination);
                    micGain.connect(destination);

                    const combinedStream = new MediaStream([
                        ...displayStream.getVideoTracks(),
                        ...destination.stream.getAudioTracks()
                    ]);

                    if (audioContext.state === 'suspended') {
                        audioContext.resume();
                    }

                    chrome.runtime.sendMessage({ action: "log", message: "Microphone and display audio are being captured" });
                    onAccessApproved(combinedStream);

                } catch (error) {
                    chrome.runtime.sendMessage({ action: "log", message: `Error: ${error}` });
                    console.error("Microphone error:", error);
                    onAccessApproved(displayStream); 
                }
            }).catch((error) => {
                chrome.runtime.sendMessage({ action: "log", message: `Error accessing display: ${error}` });
            });
        }

        if (message.action === "stopvideo") {
            chrome.runtime.sendMessage({ action: "log", message: "stopping video" });
            sendResponse(`processed: ${message.action}`);
            if (!recorder) return chrome.runtime.sendMessage({ action: "log", message: "no recorder" });

            recorder.stop();
        }
    });
})();