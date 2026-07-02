<div align="center">

# 🏔️ HUASCARAN POS

**Sistema de Punto de Venta e Inventario para MYPEs peruanas**  
*Point of Sale & Inventory Management System for Peruvian SMEs*

![Version](https://img.shields.io/badge/versión-1.2.2-teal?style=flat-square)
![Platform](https://img.shields.io/badge/plataforma-Windows-blue?style=flat-square)
![Status](https://img.shields.io/badge/estado-en%20desarrollo%20activo-green?style=flat-square)
![Peru](https://img.shields.io/badge/Hecho%20en-Perú%20🇵🇪-red?style=flat-square)
![SUNAT](https://img.shields.io/badge/SUNAT-compatible-orange?style=flat-square)

</div>

---

## 📋 Descripción / Description

### 🇵🇪 Español

**HUASCARAN** es un sistema de escritorio completo de Punto de Venta (POS) y gestión de inventario, diseñado específicamente para pequeñas y medianas empresas peruanas (MYPEs). Desarrollado bajo la marca **GiraDevs**, el sistema integra facturación electrónica conforme a los requisitos de SUNAT, actualizaciones automáticas y una experiencia de uso intuitiva pensada para el contexto del comercio local peruano.

El nombre rinde homenaje al nevado **Huascarán**, símbolo de la región Ancash, tierra de origen del proyecto.

### 🇺🇸 English

**HUASCARAN** is a complete desktop Point of Sale (POS) and inventory management system, specifically designed for small and medium-sized Peruvian businesses (MYPEs). Developed under the **GiraDevs** brand, it integrates electronic invoicing compliant with SUNAT requirements, automatic updates, and an intuitive user experience tailored to the Peruvian local commerce context.

The name pays tribute to **Huascarán**, the iconic mountain that represents the Ancash region — where this project was born.

---

## ⚡ Funcionalidades principales / Key Features

| Módulo | Descripción |
|--------|-------------|
| 🛒 **Ventas / POS** | Registro de ventas con escáner de código de barras, múltiples métodos de pago (Efectivo, Yape/Plin, Transferencia) |
| 📦 **Inventario** | Control de stock en tiempo real, alertas de bajo inventario, movimientos |
| 🧾 **Comprobantes** | Emisión de boletas y facturas electrónicas, generación de PDF (A4/A5/Ticket 80mm) |
| 💰 **Caja** | Apertura y cierre de caja, control de turnos, arqueo |
| 🛍️ **Productos** | Catálogo con categorías dinámicas, precios, imágenes y códigos de barra |
| 🏪 **Compras** | Registro de compras a proveedores, actualización automática de stock |
| 👥 **Clientes** | Gestión de cartera de clientes, historial de compras |
| 📊 **Dashboard** | Resumen visual de ventas, ingresos y métricas del negocio |
| 📈 **Reportes** | Reportes de ventas, inventario y movimientos exportables |
| 🔍 **Auditoría** | Registro de actividad del sistema, detección de inconsistencias, export PDF |
| 👤 **Usuarios** | Roles de Administrador y Cajero con permisos diferenciados |
| ⚙️ **Configuración** | Datos de empresa, ticket de impresión, backups automáticos |
| 🔐 **Activación** | Sistema de licencias por dispositivo con validación de máquina |

---

## 🛠️ Stack Tecnológico / Tech Stack

### Desktop & Frontend
![Electron](https://img.shields.io/badge/Electron_29-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)

### Backend & Base de Datos
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)

### Herramientas & Integraciones
![electron-updater](https://img.shields.io/badge/electron--updater-auto%20updates-teal?style=flat-square)
![jsPDF](https://img.shields.io/badge/jsPDF-generación%20PDF-red?style=flat-square)
![NubeFact](https://img.shields.io/badge/NubeFact-PSE%20SUNAT-orange?style=flat-square)
![NSIS](https://img.shields.io/badge/NSIS-instalador%20Windows-blue?style=flat-square)

---

## 🧾 Integración SUNAT / SUNAT Integration

### 🇵🇪 Español

HUASCARAN cumple con los requisitos de facturación electrónica de **SUNAT** a través de integración con **NubeFact** como Proveedor de Servicios Electrónicos (PSE). El sistema permite:

- Emisión de **boletas de venta** y **facturas electrónicas**
- Generación de **código QR** conforme al formato SUNAT
- **Comunicación de Baja** para anulación de comprobantes el mismo día
- Selección de formato de impresión: A4, A5 o Ticket térmico 80mm
- Los comprobantes quedan registrados ante SUNAT en tiempo real

### 🇺🇸 English

HUASCARAN complies with **SUNAT** electronic invoicing requirements through integration with **NubeFact** as an Electronic Service Provider (PSE). The system enables:

- Issuance of **sales receipts** (*boletas*) and **electronic invoices** (*facturas*)
- **QR code** generation per SUNAT format
- Same-day **cancellation notices** (*Comunicación de Baja*)
- Print format selection: A4, A5 or 80mm thermal ticket
- Receipts are registered with SUNAT in real time

---

## 📸 Capturas de pantalla / Screenshots

> 🚧 **Próximamente / Coming soon** — Las capturas del sistema estarán disponibles en la próxima actualización.

---

## 📥 Instalación / Installation

Descarga el instalador de la versión más reciente desde la sección de **[Releases](https://github.com/4ymar/huascaran-releases/releases)**.

Download the latest installer from the **[Releases](https://github.com/4ymar/huascaran-releases/releases)** section.

**Requisitos / Requirements:**
- Windows 10 / 11 (64-bit)
- 4 GB RAM mínimo / minimum
- Conexión a internet para facturación electrónica / Internet connection for electronic invoicing

---

## 👨‍💻 Autor / Author

<div align="center">

**GiraDevs**  
Desarrollado por / Developed by **Aymar** · Ancash, Perú 🇵🇪

[![Email](https://img.shields.io/badge/Email-nicegira9@gmail.com-teal?style=flat-square&logo=gmail)](mailto:nicegira9@gmail.com)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-%2B51%20924%20659%20250-25D366?style=flat-square&logo=whatsapp)](https://wa.me/51924659250)
[![GitHub](https://img.shields.io/badge/GitHub-4ymar-181717?style=flat-square&logo=github)](https://github.com/4ymar)

</div>

---

<div align="center">

*HUASCARAN POS © 2025 GiraDevs · Todos los derechos reservados / All rights reserved*

</div>
