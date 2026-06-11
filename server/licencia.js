const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataDir } = require('./security/secrets');

const LICENCIA_FILE = path.join(dataDir(), 'licencia.dat');
const CLOCK_FILE = path.join(dataDir(), 'license-clock.json');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtEzd9SIWVwcvua2BwtWX
dO601Be+wJAZvxC+GAsJ7Cg65I700SCFSW91y2GgXBSz7JEWODI3F5GqBgvvgI11
p2/5JG6PIJcd050j9JCbuSkhg+G3y6BeKeTJDYf0kEs/AzYpEqpkhVPLC6gwA61X
svQIWiOcp77Myr7wmTF3ON80iGT1Hc0jTD3Ng1VFtwKYprmN2/UYVHKVFwQkEr39
jLT0mYqf4cR5USwkR3Dl39VAZEyupuXQJqQEwrnhWAAlDF1jKAjCsJCAQQV6hajJ
VMBadlu26NPtjr1VV5K/z3hxOTkmL7qH3hlLxz4Ap5cEqZdhqztTrJDvH2M9WRg4
HQIDAQAB
-----END PUBLIC KEY-----`;

let _machineIdCache = null;

function getMachineId() {
    if (_machineIdCache) return _machineIdCache;

    const cpus = os.cpus();
    let boardSerial = '';

    try {
        boardSerial = execSync(
            'powershell -command "(Get-WmiObject Win32_BaseBoard).SerialNumber"',
            { timeout: 4000 }
        ).toString().trim();
    } catch (_) {}

    const raw = [
        os.hostname(),
        cpus[0]?.model || '',
        boardSerial,
    ].join('|');

    _machineIdCache = crypto
        .createHash('sha256')
        .update(raw)
        .digest('hex')
        .substring(0, 16)
        .toUpperCase();

    return _machineIdCache;
}

function validarReloj() {
    const now = Date.now();
    try {
        if (fs.existsSync(CLOCK_FILE)) {
            const data = JSON.parse(fs.readFileSync(CLOCK_FILE, 'utf-8'));
            const lastSeen = Number(data.lastSeen || 0);
            if (lastSeen && now + 24 * 60 * 60 * 1000 < lastSeen) {
                return { ok: false, motivo: 'Reloj del sistema inconsistente' };
            }
        }
        fs.mkdirSync(path.dirname(CLOCK_FILE), { recursive: true });
        fs.writeFileSync(CLOCK_FILE, JSON.stringify({ lastSeen: now }, null, 2));
        return { ok: true };
    } catch (_) {
        return { ok: true };
    }
}

function verificarLicencia() {
    try {
        if (!fs.existsSync(LICENCIA_FILE)) {
            return { valida: false, motivo: 'Sin licencia' };
        }

        const reloj = validarReloj();
        if (!reloj.ok) return { valida: false, motivo: reloj.motivo };

        const data = JSON.parse(fs.readFileSync(LICENCIA_FILE, 'utf-8'));
        const machineId = getMachineId();

        if (data.machineId !== machineId) {
            return { valida: false, motivo: 'Licencia no valida para este equipo' };
        }

        const verify = crypto.createVerify('SHA256');
        verify.update(data.payload);
        const firmaValida = verify.verify(PUBLIC_KEY, data.firma, 'base64');
        if (!firmaValida) {
            return { valida: false, motivo: 'Firma de licencia invalida' };
        }

        const payloadParsed = JSON.parse(data.payload);
        const { empresa, fechaExpira } = payloadParsed;

        if (payloadParsed.machineId !== machineId) {
            return { valida: false, motivo: 'Licencia no valida para este equipo' };
        }

        if (fechaExpira !== 'PERMANENTE') {
            const expira = new Date(fechaExpira);
            if (isNaN(expira.getTime())) {
                return { valida: false, motivo: 'Fecha de expiracion invalida' };
            }
            if (new Date() > expira) {
                return { valida: false, motivo: 'Licencia expirada', expirada: true };
            }
        }

        return { valida: true, empresa, fechaExpira };
    } catch (err) {
        return { valida: false, motivo: 'Error al leer licencia' };
    }
}

function activarLicencia(claveCompleta) {
    try {
        const soloBase64 = String(claveCompleta || '')
            .split('\n')
            .map(l => l.trim())
            .find(l => l.startsWith('eyJ'));

        if (!soloBase64) return { exito: false, error: 'No se encontro una clave valida' };

        const decoded = JSON.parse(Buffer.from(soloBase64, 'base64').toString('utf-8'));
        const { payload, firma } = decoded;
        if (!payload || !firma) {
            return { exito: false, error: 'Formato de clave invalido' };
        }

        const verify = crypto.createVerify('SHA256');
        verify.update(payload);
        const firmaValida = verify.verify(PUBLIC_KEY, firma, 'base64');
        if (!firmaValida) {
            return { exito: false, error: 'Clave de activacion incorrecta' };
        }

        const { empresa, machineId, fechaExpira } = JSON.parse(payload);
        if (machineId !== getMachineId()) {
            return { exito: false, error: 'Esta clave fue generada para otro equipo' };
        }

        fs.mkdirSync(path.dirname(LICENCIA_FILE), { recursive: true });
        fs.writeFileSync(LICENCIA_FILE, JSON.stringify({ machineId, payload, firma }, null, 2));
        validarReloj();

        return { exito: true, empresa, fechaExpira };
    } catch (err) {
        return { exito: false, error: 'Clave invalida o corrupta' };
    }
}

module.exports = { getMachineId, verificarLicencia, activarLicencia };
