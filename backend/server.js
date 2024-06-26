const express = require('express');
const multer = require('multer');
const Minio = require('minio');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs'); // Importa el módulo fs

const app = express();
const upload = multer({ dest: 'uploads/' });

// Habilitar CORS
app.use(cors());

// Configuración del cliente MinIO
const minioClient = new Minio.Client({
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin'
});

// MongoDB setup (use Mongoose)
mongoose.connect('mongodb://localhost/mydb', { useNewUrlParser: true });
const FileSchema = new mongoose.Schema({
    url: String
});
const FileModel = mongoose.model('File', FileSchema);

app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send('No file uploaded.');
    }

    const metaData = {
        'Content-Type': file.mimetype
    };

    // Subir el archivo a MinIO
    minioClient.fPutObject('my-bucket', file.originalname, file.path, metaData, async (err, etag) => {
        if (err) {
            console.error('Error uploading file to Minio:', err);
            return res.status(500).send('Error uploading file to Minio.');
        }

        console.log('Archivo subido con éxito a Minio.');

        // Generar el enlace compartido con validez de 1 año (31536000 segundos)
        const expiration = 7 * 24 * 60 * 60;
        minioClient.presignedGetObject('my-bucket', file.originalname, expiration, async (err, url) => {
            if (err) {
                console.error('Error generating shared link:', err);
                return res.status(500).send('Error generating shared link.');
            }

            console.log('Enlace compartido generado:', url);

            // Guardar el enlace en MongoDB
            const newFile = new FileModel({ url: url });

            try {
                await newFile.save();
                console.log('URL del archivo guardada en MongoDB.');
                res.status(200).json({ url: url });
            } catch (error) {
                console.error('Error saving URL to MongoDB:', error);
                res.status(500).send('Error saving URL to MongoDB.');
            }

            // Eliminar el archivo temporal después de subirlo
            fs.unlinkSync(file.path);
        });
    });
});

app.listen(3000, () => {
    console.log('Servidor corriendo en el puerto 3000');
});
