const express = require('express');
const multer = require('multer');
const speech = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const ffmpeg = require('fluent-ffmpeg');
// const path = require('path');

const app = express();
app.use(cors());
//const upload = multer({ dest: 'uploads/' });
const upload = multer(); // Multer bez opcji 'dest', więc plik nie jest zapisywany na dysku lokalnym

require('dotenv').config();
process.env.GOOGLE_APPLICATION_CREDENTIALS;
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Konfiguracja klienta Google Cloud Storage
const storage = new Storage();
const bucketName = 'smartmeetingnotes'; // Zmień na swoją nazwę bucketu


// Klient Google Speech-to-Text
const client = new speech.SpeechClient();

async function uploadStreamToGCS(buffer, destination) {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destination);

    const stream = file.createWriteStream({
        resumable: false,
    });

    stream.end(buffer);

    return new Promise((resolve, reject) => {
        stream.on('finish', () => {
            console.log(`File uploaded to ${bucketName}/${destination}`);
            resolve(`gs://${bucketName}/${destination}`);
        });
        stream.on('error', (err) => {
            console.error('Error uploading file to GCS:', err);
            reject(err);
        });
    });
}

//const client = new speech.SpeechClient();

app.post('/transcribe', upload.single('file'), async (req, res) => {
    console.log('Received file:', req.file); // Debug: informacje o pliku
    console.log('File size:', req.file.size, 'bytes'); // Debug: rozmiar pliku
    const filePath = req.file.path;

    try {
        // Przesyłanie pliku do GCS
        //const gcsUri = await uploadFileToGCS(filePath, req.file.filename);

        // Przesyłanie pliku bezpośrednio do GCS
        const gcsUri = await uploadStreamToGCS(req.file.buffer, req.file.originalname);

        const audio = {
            uri: gcsUri, // Użycie URI pliku w GCS
        };

        const config = {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'pl-PL',
            enableWordTimeOffsets: true, // Włączanie offsetów czasowych
        };

        const request = { audio, config };

        // Wykonanie długiej transkrypcji
            console.log('Starting longRunningRecognize...');
            const [operation] = await client.longRunningRecognize(request);
            const [response] = await operation.promise();
            console.log('Transcription completed.');
    
            // Przetwarzanie wyników
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
            console.log(`Transcription: ${transcription}`);

        // Tworzenie ścieżki do pliku
        const outputFilePath = path.join(__dirname, 'uploads', `${req.file.filename}-transcription.txt`);

        try{
            // Zapisanie transkrypcji do pliku
            fs.writeFileSync(outputFilePath, transcription, 'utf8');
            console.log(`Transcription saved to ${outputFilePath}`)
        } catch (err){
            console.error('Error writing transcription file:', err);
        }

        // Odpowiedź do klienta
        res.json({ 
            message: 'Transcription completed', 
            transcription, 
            transcriptionFilePath: outputFilePath 
        });

        // Usunięcie oryginalnego pliku audio po zapisaniu transkrypcji
        // fs.unlinkSync(filePath);
    } catch (err) {
        console.error('Error during transcription:', err);
        res.status(500).json({ error: 'Error during transcription', details: err.message });
    }
});


async function downloadFileFromGCS(gcsUri, destination) {
    const bucket = storage.bucket(bucketName);
    const fileName = gcsUri.split('/').pop();
    const file = bucket.file(fileName);

    return new Promise((resolve, reject) => {
        file.createReadStream()
            .pipe(fs.createWriteStream(destination))
            .on('finish', () => {
                console.log(`File downloaded to ${destination}`);
                resolve(destination);
            })
            .on('error', (err) => {
                console.error('Error downloading file from GCS:', err);
                reject(new Error(`Failed to extract frames: ${err.message}`));;
            });
    });
}


app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

