console.log("Hi, I have been injected whoopie!!!")

var recorder = null
function onAccessApproved(stream){
    recorder = new MediaRecorder(stream);

    recorder.start();

    recorder.onstop = function(){
        stream.getTracks().forEach(function(track){
            if(track.readyState === "live"){
                track.stop()
            }
        })
    }

    recorder.ondataavailable = function(event){
        let recordedBlob  = event.data;
        let url = URL.createObjectURL(recordedBlob);

        let a = document.createElement("a");

        a.style.display = "none";
        a.href = url;
        a.download = "screen-recording.webm"

        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        // Wywołanie processAudio, aby przesłać plik na serwer
        processAudio(recordedBlob);
    }
}

async function processAudio(audioBlob) {
    console.log('Blob size:', audioBlob.size, 'bytes'); // Debug: rozmiar pliku
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    try {
        const response = await fetch('http://localhost:3000/transcribe', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        console.log('Transcription:', result.transcription);
        alert(`Transcription: ${result.transcription}`);
    } catch (error) {
        console.error('Error transcribing audio:', error);
    }
}


chrome.runtime.onMessage.addListener( (message, sender, sendResponse)=>{

    if(message.action === "request_recording"){
        console.log("requesting recording")

        sendResponse(`processed: ${message.action}`);

        navigator.mediaDevices.getDisplayMedia({
            audio:true,
            video: {
                width:9999999999,
                height: 9999999999
            }
        }).then((stream)=>{
            onAccessApproved(stream)
        })  
    }

    if(message.action === "stopvideo"){
        console.log("stopping video");
        sendResponse(`processed: ${message.action}`);
        if(!recorder) return console.log("no recorder")

        recorder.stop();


    }

})