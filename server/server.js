const express = require('express');
const multer = require('multer');
const speech = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const ffmpeg = require('fluent-ffmpeg');
const Tesseract = require('tesseract.js');
const crypto = require('crypto'); // Importowanie biblioteki crypto
const { imageHash } = require('image-hash');


const app = express();
app.use(cors());
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

async function extractFrames(videoPath, outputDir) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        console.log(`Extracting frames from ${videoPath} to ${outputDir}`);

        ffmpeg(videoPath)
            .on('error', (err) => {
                console.error('Error extracting frames:', err);
                reject(err);
            })
            .on('end', () => {
                console.log('Frames extracted successfully!');
                // Usuwanie plików tymczasowych po zakończeniu operacji ffmpeg
                try {
                    fs.unlinkSync(videoPath); // Usuwanie pliku wideo
                    console.log('Temporary files deleted successfully');
                } catch (cleanupErr) {
                    console.error('Error during cleanup:', cleanupErr);
                }
                resolve();
            })
            .output(path.join(outputDir, 'frame-%04d.png'))
            .outputOptions(['-vf fps=1']) // FPS = 1 frame per second
            .run();
    });
}

function deleteFramesDirectory(outputDir) {
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
        console.log(`Frames directory ${outputDir} deleted successfully`);
    }
}

function getImageHash(filePath) {
    return new Promise((resolve, reject) => {
        imageHash(filePath, 16, true, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}


function hammingDistance(hash1, hash2) {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) {
            distance++;
        }
    }
    return distance;
}

async function performOCROnFrames(outputDir) {
    const files = fs.readdirSync(outputDir);
    const ocrResults = [];
    let previousHash = null;
    const threshold = 5;

    for (const file of files) {
        const filePath = path.join(outputDir, file);
        console.log(`Performing OCR on ${filePath}`);

        const currentHash = await getImageHash(filePath);
        if (previousHash && hammingDistance(currentHash, previousHash) < threshold) {
            console.log(`Skipping OCR for ${filePath} as it is identical to the previous frame`);
            continue;
        }

        try {
            const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
            console.log(`OCR result for ${filePath}: ${text}`);
            ocrResults.push({ file: filePath, text });
            previousHash = currentHash;
        } catch (ocrError) {
            console.error(`Error performing OCR on ${filePath}:`, ocrError);
        }
    }

    return ocrResults;
}

app.post('/transcribe', upload.single('file'), async (req, res) => {
    console.log('Received file:', req.file); // Debug: informacje o pliku
    console.log('File size:', req.file.size, 'bytes'); // Debug: rozmiar pliku

    try {
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
        const outputFilePath = path.join(__dirname, 'uploads', 'transcription');

        try{
            // Zapisanie transkrypcji do pliku
            fs.writeFileSync(outputFilePath, transcription, 'utf8');
            console.log(`Transcription saved to ${outputFilePath}`)
             // Sprawdzenie, czy plik istnieje po zapisaniu
            if (fs.existsSync(outputFilePath)) {
                console.log(`File exists: ${outputFilePath}`);
            } else {
                console.error(`File does not exist after writing: ${outputFilePath}`);
            }
        } catch (err){
            console.error('Error writing transcription file:', err);
        }

        const localVideoPath = path.join(__dirname, 'uploads', req.file.originalname);
        await downloadFileFromGCS(gcsUri, localVideoPath);

        // Sprawdzenie, czy plik istnieje przed wywołaniem ffmpeg
        if (!fs.existsSync(localVideoPath)) {
            throw new Error(`File not found: ${localVideoPath}`);
        }

        const outputDir = path.join(__dirname, 'uploads', 'frames');
        // Usunięcie poprzednich ramek
        deleteFramesDirectory(outputDir);
        await extractFrames(localVideoPath, outputDir);

        // Wykonanie OCR na klatkach
        const ocrResults = await performOCROnFrames(outputDir);
        console.log('OCR results:', ocrResults);

        // Odpowiedź do klienta
        res.json({ 
            message: 'Transcription completed', 
            transcription, 
            transcriptionFilePath: outputFilePath,
            framesDirectory: outputDir 
        });

        // Usunięcie oryginalnego pliku audio po zapisaniu transkrypcji
        // fs.unlinkSync(filePath);
    } catch (err) {
        console.error('Error during transcription:', err);
        res.status(500).json({ error: 'Error during transcription', details: err.message });
    }
});


app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

