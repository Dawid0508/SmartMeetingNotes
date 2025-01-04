const express = require('express');
const multer = require('multer');
const speech = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const client = new speech.SpeechClient();

app.post('/transcribe', upload.single('file'), async (req, res) => {
    console.log('Received file:', req.file); // Debug: informacje o pliku
    console.log('File size:', req.file.size, 'bytes'); // Debug: rozmiar pliku
    const filePath = req.file.path;

    try {
        // Odczytanie i konwersja audio do Base64
        const audio = {
            content: fs.readFileSync(filePath).toString('base64'),
        };

        const config = {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'pl-PL',
            enableWordTimeOffsets: true, // Włączanie offsetów czasowych
        };

        const request = { audio, config };

        // Wykonanie transkrypcji
        const [response] = await client.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        console.log(`Transcription: ${transcription}`);

        // Tworzenie szczegółowej analizy słów z czasami
        const wordDetails = [];
        response.results.forEach(result => {
            result.alternatives[0].words.forEach(wordInfo => {
                const startSecs = `${wordInfo.startTime.seconds || 0}.${(wordInfo.startTime.nanos || 0) / 100000000}`;
                const endSecs = `${wordInfo.endTime.seconds || 0}.${(wordInfo.endTime.nanos || 0) / 100000000}`;
                wordDetails.push({
                    word: wordInfo.word,
                    start: startSecs,
                    end: endSecs,
                });
            });
        });

        // Tworzenie ścieżki do pliku
        const outputFilePath = path.join(__dirname, 'uploads', `${req.file.filename}-transcription.txt`);
        const wordDetailsFilePath = path.join(__dirname, 'uploads', `${req.file.filename}-word-details.json`);

        // Zapisanie transkrypcji do pliku
        fs.writeFileSync(outputFilePath, transcription, 'utf8');

        // Zapisanie szczegółów słów do pliku JSON
        fs.writeFileSync(wordDetailsFilePath, JSON.stringify(wordDetails, null, 2), 'utf8');

        // Odpowiedź do klienta
        res.json({ 
            message: 'Transcription completed', 
            transcription, 
            transcriptionFilePath: outputFilePath, 
            wordDetailsFilePath 
        });

        // Usunięcie oryginalnego pliku audio po zapisaniu transkrypcji
        fs.unlinkSync(filePath);
    } catch (err) {
        console.error('Error during transcription:', err);
        res.status(500).send('Error during transcription');
    }
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
