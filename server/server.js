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
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bodyParser = require('body-parser');
const postmark = require("postmark");
const nodemailer = require('nodemailer');
const { env } = require('process');
const sharp = require('sharp');
const PDFKitDocument = require('pdfkit');
const { PDFDocument } = require('pdf-lib');
const archiver = require('archiver');

const app = express();
app.use(cors());
app.use(bodyParser.json());
const upload = multer(); // Multer bez opcji 'dest', więc plik nie jest zapisywany na dysku lokalnym

require('dotenv').config();
process.env.GOOGLE_APPLICATION_CREDENTIALS.split(String.raw`\n`).join('\n');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Konfiguracja klienta Google Cloud Storage
const storage = new Storage();
const bucketName = 'smartmeetingnotes'; // Zmień na swoją nazwę bucketu

// Klient Google Speech-to-Text
const client = new speech.SpeechClient();

// Klient do wysylania maili Postmark
var serverToken = process.env.postmark;
var clientMail = new postmark.ServerClient(serverToken);


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
                console.log('File downloaded to ${destination}');
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
            .complexFilter([
                '[0:v] fps=1/5, crop=1580:980:40:140 [v]'
            ])
            .map('[v]')
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

async function detectChart(imagePath) {
    const image = sharp(imagePath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    // Prosty algorytm wykrywania wykresów na podstawie analizy kolorów i kształtów
    const width = info.width;
    const height = info.height;
    const threshold = 128;
    let chartDetected = false;

    // Analiza kolorów i kształtów
    let darkPixelCount = 0;
    const totalPixels = width * height;

    for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r < threshold && g < threshold && b < threshold) {
            darkPixelCount++;
        }
        
    }
    // Jeśli liczba ciemnych pikseli przekracza pewien procent, uznajemy, że jest to wykres
    const darkPixelPercentage = (darkPixelCount / totalPixels) * 100;
    if (darkPixelPercentage > 20) { // Możesz dostosować ten próg
        chartDetected = true;
    }

    return chartDetected;
}

function generatePDF(imagePaths, outputPath) {
    const doc = new PDFKitDocument();
    doc.pipe(fs.createWriteStream(outputPath));

    let imagesPerPage = 2; // Liczba obrazów na stronę
    let imagesOnCurrentPage = 0;

    imagePaths.forEach((imagePath, index) => {
        if (imagesOnCurrentPage === 0 && index !== 0) {
            // Dodaj nową stronę tylko po pierwszej stronie
            doc.addPage();
        }
        // Pobierz odpowiednią pozycję z tablicy
        const { x, y } = positions[imagesOnCurrentPage];

        // // Pozycja obrazu na stronie
        const x = 50; // Margines poziomy
        const y = imagesOnCurrentPage === 0 ? 100 : 400; // Margines pionowy zależny od obrazu

        doc.image(imagePath, x, y, {
            fit: [500, 300], // Dopasowanie obrazu
            align: 'center',
            valign: 'center',
        });

        imagesOnCurrentPage++;

        if (imagesOnCurrentPage === imagesPerPage) {
            imagesOnCurrentPage = 0; // Reset liczby obrazów na stronie
        }
    });

    doc.end();

}

// Funkcja do tworzenia archiwum ZIP
async function createZip(pdfPath, outputZipPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputZipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maksymalna kompresja
        });

        output.on('close', () => {
            console.log(`ZIP created at ${outputZipPath}`);
            resolve(outputZipPath);
        });

        archive.on('error', (err) => {
            console.error('Error creating ZIP:', err);
            reject(err);
        });

        archive.pipe(output);

        // Dodaj PDF do archiwum
        archive.file(pdfPath, { name: 'charts.pdf' });

        archive.finalize();
    });
}


async function performOCROnFrames(outputDir) {
    const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.png'));;
    const ocrResults = [];
    let previousHash = null;
    const threshold = 5;

    const chartFramesDir = path.join(outputDir, 'charts');
    if (!fs.existsSync(chartFramesDir)) {
        fs.mkdirSync(chartFramesDir, { recursive: true });
    }
    const chartImagePaths = [];

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

            if (await detectChart(filePath)) {
                const chartFilePath = path.join(chartFramesDir, path.basename(filePath));
                fs.copyFileSync(filePath, chartFilePath);
                console.log(`Chart detected and saved: ${chartFilePath}`);

                // Dodanie ścieżki do listy obrazów wykresów
                chartImagePaths.push(chartFilePath);
            }

            previousHash = currentHash;
        } catch (ocrError) {
            console.error(`Error performing OCR on ${filePath}:, ocrError`);
        }
    }

    // Generowanie PDF z wykresami
    const pdfPath = path.join(outputDir, 'charts.pdf');
    generatePDF(chartImagePaths, pdfPath);

    return { ocrResults, pdfPath };
}

async function summarizeTranscription(transcription, ocrResults) {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: "gemini-1.5-pro" });
    let ocrSummary = 'Wyniki OCR:\n';
    ocrResults.forEach(result => {
        ocrSummary += `Plik: ${result.file}\nTekst: ${result.text}\n\n`;
    });

    const prompt = `Podsumuj następującą transkrypcję, opisz czego dotyczyło spotkanie i wypisz jego najbardziej istotne fragmenty:\n\n${transcription}\n\n${ocrSummary}, oddziel transkrypcję od OCR summary, w podsumowaniu pomijaj przypadkowe symbole i frazy zebrane w trakcie OCR. Sformatuj całe podsumowanie w HTML.`;

    const result = await model.generateContent(prompt);
    //console.log(result.response.text())
    return result.response.text();

}

// Konfiguracja transportu SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Adres serwera SMTP
    port: 587, // Port SMTP (587 dla STARTTLS, 465 dla SSL)
    secure: false, // Używaj 'true', jeśli port to 465
    auth: {
        user: process.env.EMAIL, // Twój adres e-mail
        pass: process.env.EMAIL_PASSWORD, // Twoje hasło do skrzynki e-mail
    },
});

// let userMail;
let userMails = [];

app.post('/submit-email', (req, res) => {
    const { email } = req.body;
    if (email && !userMails.includes(email)) {
        userMails.push(email);
        console.log('Email added:', email); // Log when email is added
        res.json({ message: 'Email added successfully', emails: userMails });
    } else {
        res.status(400).json({ message: 'Nieprawidłowy lub powielony adres.' });
    }
});

app.get('/emails', (req, res) => {
    res.json({ emails: userMails });
});

app.delete('/delete-email', (req, res) => {
    const { email } = req.body;
    userMails = userMails.filter(e => e !== email);
    console.log('Email deleted:', email); // Log when email is deleted
    res.json({ message: 'Email deleted successfully', emails: userMails });
});


app.post('/log-event', (req, res) => {
    const eventDetails = req.body;
    console.log('Received event details:', eventDetails);
    res.json({ message: 'Event details logged successfully' });
});

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

        try {
            // Zapisanie transkrypcji do pliku
            fs.writeFileSync(outputFilePath, transcription, 'utf8');
            console.log(`Transcription saved to ${outputFilePath}`)
            // Sprawdzenie, czy plik istnieje po zapisaniu
            if (fs.existsSync(outputFilePath)) {
                console.log(`File exists: ${outputFilePath}`);
            } else {
                console.error(`File does not exist after writing: ${outputFilePath}`);
            }
        } catch (err) {
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
        const {ocrResults, pdfPath} = await performOCROnFrames(outputDir);
        console.log('OCR results:', ocrResults);

        // Podsumowanie transkrypcji
        const summary = await summarizeTranscription(transcription, ocrResults);
        console.log('Summary:', summary);

        const zipPath = path.join(outputDir, 'charts.zip');
        await createZip(pdfPath, zipPath);

        // Odpowiedź do klienta
        res.json({
            message: 'Transcription completed',
            transcription,
            summary,
            transcriptionFilePath: outputFilePath,
            framesDirectory: outputDir,
        });

        // Przygotowanie załączników z klatkami wykresów
        const chartFramesDir = path.join(outputDir, 'charts');
        const attachments = fs.readdirSync(chartFramesDir).map(file => ({
            filename: file,
            path: path.join(chartFramesDir, file)
        }));


        const mailOptions = {
            from: process.env.EMAIL, // Adres nadawcy
            to: userMails, // Adres odbiorcy (może być lista rozdzielona przecinkami)
            subject: 'Podsumowanie spotkania', // Temat wiadomości
            text: `Oto twoje podsumowanie: ${summary} \n Transkrypcja: \n ${transcription}`, // Treść w formacie tekstowym
            html:`
                <h1>Podsumowanie spotkania</h1>
                <p><strong>Podsumowanie:</strong></p>
                <p>${summary}</p>
                <hr>
                <p><strong>Transkrypcja:</strong></p>
                <pre>${transcription}</pre>
            `,
            attachments: [
                {   
                    filename: 'charts.pdf',
                    path: pdfPath
                },
                {
                    filename: 'charts.zip',
                    path: zipPath, // Archiwum ZIP
                }
            ]
        };

        // Wysyłanie wiadomości
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error occurred:', error.message);
            } else {
                console.log('Email sent:', info.response);
            }
        });

        // Usunięcie oryginalnego pliku audio po zapisaniu transkrypcji
        // fs.unlinkSync(filePath);
    } catch (err) {
        console.error('Error during transcription:', err);
        if (!res.headersSent){
            res.status(500).json({ error: 'Error during transcription', details: err.message });
        }
    }
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});