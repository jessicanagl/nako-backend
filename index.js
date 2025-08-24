const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');

const { XMLParser } = require('fast-xml-parser');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer Setup
const upload = multer({ dest: 'uploads/' });

// MySQL-Verbindung
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Trage dein Passwort hier ein, wenn du eins hast
  database: 'person'
}).promise();

const fs = require('fs');
const csvParser = require('csv-parser');
const path = require('path');

function parseIntOrNull(value) {
  const num = parseInt(value);
  return isNaN(num) ? null : num;
}

function parseDateParts(dateStr) {
  if (!dateStr || !dateStr.includes('.')) return [null, null, null];
  const [day, month, year] = dateStr.split('.').map(parseIntOrNull);
  return [day, month, year];
}

function formatDateForMySQL(isoDateStr) {
  const date = new Date(isoDateStr);
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

app.post('/api/import-csv', upload.single('csvfile'), (req, res) => {
  const filePath = req.file.path;
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv({
      separator: '\t',
      mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/ /g, '_'),
      mapValues: ({ value }) => value.trim()
    }))
    .on('data', (row) => {
      // 🎯 Werte extrahieren und vorbereiten
      const geburtsdatum = row.geburtsdatum || '';
      const [tag, monat, jahr] = geburtsdatum.split('.') || [];
      const sterbedatum = row.auskunft_sterbedatum || '';
      const [tod_tag, tod_monat, tod_jahr] = sterbedatum.split('.') || [];
      const datum_ergebnis = row.datumzeit_ergebnis ? new Date(row.datumzeit_ergebnis).toISOString().slice(0, 19).replace('T', ' ') : null;

      results.push([
        row.auftragsposition || null,
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        'VITALSTATUS_RESPONSE',
        'Schulung',
        row.aktenzeichen || null,
        row.vorname || null,
        row.nachname || null,
        row.auskunft_vorname || null,
        row.auskunft_nachname || null,
        null, null, null,
        row.auskunft_titel || null,
        row.geschlecht || null,
        parseInt(tag) || null,
        parseInt(monat) || null,
        parseInt(jahr) || null,
        row.land || null,
        null,
        null,
        null,
        row.plz || null,
        row.ort || null,
        row.strasse || null,
        row.hausnummer || null,
        null, null, null,
        null, null, null, null, null, null,
        row.auskunft_sterbedatum ? 1 : 0,
        parseInt(tod_tag) || null,
        parseInt(tod_monat) || null,
        parseInt(tod_jahr) || null,
        row.auskunft_sterbeort || null,
        row.ergebnisstatus || null,
        row.zusatzinformation || null,
        row.adressstatus || null,
        datum_ergebnis,
        row.ortsname_meldebehörde || null,
        row.ags || null,
        null
      ]);
    })
    .on('end', () => {
      const sql = `
        INSERT INTO v4_an_ths (
          requestid, timestamp_creation, function, studycentre, aktenzeichen,
          participants_first_names, participants_familyname, participants_previous_first_name, participants_previous_familyname,
          participants_prevname_date_day, participants_prevname_date_month, participants_prevname_date_year,
          participants_title, participants_sex,
          participants_birth_day, participants_birth_month, participants_birth_year,
          participants_nationality, participants_second_nationality,
          primary_address_state, deceased_state_dbev, primaryaddress_zip, primaryaddress_habitation,
          primaryaddress_street, primaryaddress_no,
          primaryaddress_moveindate_day, primaryaddress_moveindate_month, primaryaddress_moveindate_year,
          previousaddress_zip, previousaddress_habitation, previousaddress_street, previousaddress_no,
          previousaddress_no_add, previousaddress_addition,
          deceased, deceased_dayofdeath, deceased_monthofdeath, deceased_yearofdeath,
          deceased_placeofdeath, result_state, additional_info, address_state,
          date_of_result, registration_office, ags, commentary
        ) VALUES ?
      `;

      db.query(sql, [results], (err) => {
        fs.unlinkSync(filePath);
        if (err) {
          console.error('❌ Fehler beim CSV-Import:', err);
          return res.status(500).send('Fehler beim Import der CSV-Daten');
        }
        res.send('✅ CSV erfolgreich importiert!');
      });
    });
});

app.post("/api/add-deathcase", async (req, res) => {
  try {
    const { nachname, vorname, sterbedatum, sterbeort, kommentar } = req.body;

    // Sterbedatum in Jahr, Monat, Tag zerlegen
    let tag = null, monat = null, jahr = null;

    if (sterbedatum) {
      const dateObj = new Date(sterbedatum);
      tag = dateObj.getDate();
      monat = dateObj.getMonth() + 1; // Monate sind 0-basiert
      jahr = dateObj.getFullYear();
    }

    const sql = `
      INSERT INTO v4_an_ths (
        participants_familyname,
        participants_first_names,
        deceased_dayofdeath,
        deceased_monthofdeath,
        deceased_yearofdeath,
        deceased_placeofdeath,
        commentary
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      nachname,
      vorname,
      tag,
      monat,
      jahr,
      sterbeort,
      kommentar
    ]);

    res.status(200).json({ message: "✅ Datensatz erfolgreich gespeichert!" });
  } catch (error) {
    console.error("❌ Fehler beim Speichern:", error);
    res.status(500).json({ error: "Fehler beim Speichern" });
  }
});


// ✅ XML-Import-Endpunkt
app.post('/api/import-xml', upload.single('xmlfile'), (req, res) => {
  const filePath = req.file.path;

  fs.readFile(filePath, 'utf8', (err, xmlData) => {
  console.log('📥 XML-Inhalt:', xmlData.slice(0, 500));
    if (err) {
      console.error('❌ Fehler beim Lesen der Datei:', err);
      return res.status(500).send('Fehler beim Lesen der Datei');
    }

    try {
      const xmlParser = new XMLParser();
      const json = xmlParser.parse(xmlData);

      const participants = json.MOFU.participants.participant;
      const list = Array.isArray(participants) ? participants : [participants];

      const werte = list.map(p => [
        p.name,
        p.firstname,
        p.birth?.day,
        p.birth?.month,
        p.birth?.year,
        p.sex === '2' ? 'Female' : 'Male',
        p.birth?.birthplace,
        p.nationality,
        p.secondnationality || '',
        p.addresses?.primaryaddress?.habitation,
        p.addresses?.primaryaddress?.zip,
        p.addresses?.primaryaddress?.street,
        p.addresses?.primaryaddress?.no,
        p.studycentre,
        p.requestid || ''
      ]);

      const sql = `
        INSERT INTO s_personendaten (
          Familienname, Rufname, Geburtstag, Geburtsmonat, Geburtsjahr,
          Geschlecht, Geburtsort, Staatsangehörigkeit_ISO_2,
          Frühere_Staatsangehörigkeit_1_ISO_2, Wohnort_aktuell,
          Wohnort_aktuell_PLZ, Wohnort_aktuell_Straße, Wohnort_aktuell_Hausnummer,
          Studienzentrum, Vorgang
        ) VALUES ?
      `;

      db.query(sql, [werte], (err) => {
        fs.unlinkSync(filePath); // temporäre Datei löschen

        if (err) {
          console.error('❌ Fehler beim Einfügen in DB:', err);
          return res.status(500).send('Fehler beim Einfügen in die Datenbank');
        }

        res.send('✅ Daten erfolgreich importiert!');
      });
    } catch (parseErr) {
      console.error('❌ Fehler beim Parsen der XML:', parseErr);
      res.status(500).send('Fehler beim Parsen der XML-Datei');
    }
  });
});

// 🧹 Tabellen löschen
app.delete('/api/clear-database', (req, res) => {
  const deletePersonendaten = 'DELETE FROM s_personendaten';
  const deleteV4 = 'DELETE FROM v4_an_ths';

  db.query(deletePersonendaten, (err1) => {
    if (err1) {
      console.error('Fehler beim Löschen von s_personendaten:', err1);
      return res.status(500).send('Fehler bei s_personendaten');
    }

    db.query(deleteV4, (err2) => {
      if (err2) {
        console.error('Fehler beim Löschen von v4_an_ths:', err2);
        return res.status(500).send('Fehler bei v4_an_ths');
      }

      res.status(200).send('Tabellen erfolgreich geleert.');
    });
  });
});

// 🔍 Beispiel-GET (Testanzeige)
app.get('/api/eintraege', (req, res) => {
  db.query('SELECT * FROM s_personendaten', (err, results) => {
    if (err) {
      console.error('Fehler bei der Abfrage:', err);
      return res.status(500).send('Fehler bei der Abfrage');
    }
    res.json(results);
  });
});


// 🚀 Server starten
app.listen(3001, () => {
  console.log('🎉 Backend läuft auf http://localhost:3001');

  const debugRoutes = [];
  app._router && app._router.stack.forEach(r => {
    if (r.route && r.route.path) {
      const method = Object.keys(r.route.methods)[0].toUpperCase();
      debugRoutes.push(`${method} ${r.route.path}`);
    }
  });
  console.log('⚙️ Registrierte Routen:\n' + debugRoutes.join('\n'));
});


