const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json()); // Damit JSON-Daten verarbeitet werden können

// MySQL Verbindung erstellen
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect(err => {
    if (err) {
        console.error("Fehler bei der Verbindung zur Datenbank:", err);
        return;
    }
    console.log("Mit MySQL verbunden!");
});

// API-Endpunkt zum Abrufen der Kurse
app.get("/api/kurse", (req, res) => {
    db.query("SELECT * FROM kurse", (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(result);
        }
    });
});

// Server starten
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
