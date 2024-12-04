//server node.js

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const speech = require('@google-cloud/speech');
const nodemailer = require('nodemailer');

const app = express();
const upload = multer({storage: multer.memoryStorage() });

app.post('/convert', upload.single('file'), async(req, res) => {
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

    res.json({ transcryption })

})

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