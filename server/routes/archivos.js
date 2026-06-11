const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DESCARGAS_DIR = path.join(__dirname, '../../descargas');

// Asegurar que exista el directorio base
if (!fs.existsSync(DESCARGAS_DIR)) {
    fs.mkdirSync(DESCARGAS_DIR, { recursive: true });
}

router.post('/guardar', (req, res) => {
    try {
        const { modulo, filename, content, isBase64 } = req.body;

        if (!modulo || !filename || !content) {
            return res.status(400).json({ error: 'Faltan datos requeridos (modulo, filename, content)' });
        }

        const moduloDir = path.join(DESCARGAS_DIR, modulo);
        if (!fs.existsSync(moduloDir)) {
            fs.mkdirSync(moduloDir, { recursive: true });
        }

        const filePath = path.join(moduloDir, filename);

        if (isBase64) {
            // Limpiar la cabecera data URI (e.g. data:application/pdf;filename=generated.pdf;base64,...)
            const base64Data = content.includes('base64,') ? content.split('base64,').pop() : content;
            fs.writeFileSync(filePath, base64Data, 'base64');
        } else {
            // Archivo de texto plano (como CSV)
            fs.writeFileSync(filePath, content, 'utf8');
        }

        res.json({ message: 'Archivo guardado correctamente', path: filePath });
    } catch (error) {
        console.error('Error al guardar archivo:', error);
        res.status(500).json({ error: 'Error al guardar el archivo en el servidor' });
    }
});

module.exports = router;
