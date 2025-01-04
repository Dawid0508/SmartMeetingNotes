const express = require('express');
const multer = require('multer');
const speech = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const client = new speech.SpeechClient();

app.post('/transcribe', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;

    try {
        // Odczytanie i konwersja audio do Base64
        const audio = {
            content: fs.readFileSync(filePath).toString('base64'),
        };

        const config = {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
        };

        const request = { audio, config };

        // Wykonanie transkrypcji
        const [response] = await client.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        console.log(`Transcription: ${transcription}`);

        // Tworzenie ścieżki do pliku
        const outputFilePath = path.join(__dirname, 'uploads', `${req.file.filename}-transcription.txt`);

        // Zapisanie transkrypcji do pliku
        fs.writeFileSync(outputFilePath, transcription, 'utf8');

        // Odpowiedź do klienta
        res.json({ message: 'Transcription completed', transcription, filePath: outputFilePath });

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
