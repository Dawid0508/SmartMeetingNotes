//server node.js

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const speech = require('@google-cloud/speech');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const upload = multer({storage: multer.memoryStorage() });

app.post('/convert', upload.single('file'), async(req, res) => {
    try{

        console.log("Otrzymano żądanie POST");
        console.log("Nazwa pliku:", req.file?.originalname || "Brak pliku");
        console.log("Rozmiar pliku:", req.file?.size || 0);
        
        const client = new speech.SpeechClient();
        const audioBytes = req.file.buffer.toString('base64');

        const request = {
            audio: {content: audioBytes},
            config: {
                encoding: 'WEBM_OPUS',
                sampleRateHertz: 16000,
                languageCode: 'pl-PL'
            }
        };

        const [response] = await client.recognize(request);
        const transcryption = response.results.map((result) => result.alternatives[0].transcript).join('\n');

        await sendEmail(transcryption, "user@example.com")

        const filePath = path.join(__dirname, 'uploads','transcriptions.json');
        await saveToJSON(transcryption, filePath)

        res.json({ transcryption })
    }catch(error){
        console.error("Błąd podczas przetwarzania pliku:", error);
        res.status(500).json({ error: "Błąd serwera" });
    }

})

/** 
* Funkcja zapisująca transkrypcję do pliku JSON.
 * @param {string} transcription - Tekst transkrypcji do zapisania.
 * @param {string} filePath - Ścieżka do pliku JSON.
 */
async function saveToJSON(transcription, filePath) {
    let data = [];

    try {
        // Wczytywanie istniejących danych (jeśli plik istnieje)
        const fileContent = await fs.readFile(filePath, 'utf-8');
        data = JSON.parse(fileContent);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err; // Rzuć błąd, jeśli to nie problem z brakiem pliku
        }
    }

    // Dodanie nowej transkrypcji z datą
    const newEntry = {
        date: new Date().toISOString(),
        transcription
    };
    data.push(newEntry);

    // Zapis danych do pliku
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}



/**
 * The function `sendEmail` sends an email with a transcription to a specified recipient using
 * nodemailer and Gmail service.
 * @param transcription - The `transcription` parameter in the `sendEmail` function is the text content
 * of the transcription that you want to send in the email. It could be the written version of a
 * meeting or conversation that has been transcribed from an audio or video recording. This text will
 * be included in the body
 * @param recipient - The `recipient` parameter in the `sendEmail` function is the email address of the
 * person to whom you want to send the email containing the transcription. It is the email address
 * where the email will be delivered.
 */
async function sendEmail(transcription, recipient) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    await transporter.sendMail({
        from: '"Transkrypcja spotkań <mdm@gmail.com>',
        to: recipient,
        subject: 'Transkrypcja spotkania',
        text: transcription
    });
}

app.listen(3000, ()=> console.log('Serwer działa na porcie 3000'));