import xml.etree.ElementTree as ET
import mysql.connector

# XML laden
tree = ET.parse('V1.xml')
root = tree.getroot()

# Verbindung zur Datenbank
conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='',  # ggf. dein Passwort hier
    database='person',
    charset='utf8mb4',
    collation='utf8mb4_general_ci'
)
cursor = conn.cursor()

for idx, participant in enumerate(root.find('participants').findall('participant'), start=1):
    familienname = participant.find('name').text
    rufname = participant.find('firstname').text
    geburtstag = participant.find('birth/day').text
    geburtsmonat = participant.find('birth/month').text
    geburtsjahr = participant.find('birth/year').text
    geschlecht = participant.find('sex').text
    geburtsort = participant.find('birth/birthplace').text
    staatsangehoerigkeit = participant.find('nationality').text
    zweite_staatsang = participant.find('secondnationality').text if participant.find('secondnationality') is not None else ""
    wohnort = participant.find('addresses/primaryaddress/habitation').text
    plz = participant.find('addresses/primaryaddress/zip').text
    strasse = participant.find('addresses/primaryaddress/street').text
    hausnummer = participant.find('addresses/primaryaddress/no').text
    studienzentrum = participant.find('studycentre').text
    vorgang = participant.find('idv').text

    sql = """
        INSERT INTO S_Personendaten (
            ID, Familienname, Rufname, Geburtstag, Geburtsmonat, Geburtsjahr,
            Geschlecht, Geburtsort, Staatsangehörigkeit_ISO_2, Frühere_Staatsangehörigkeit_1_ISO_2,
            Wohnort_aktuell, Wohnort_aktuell_PLZ, Wohnort_aktuell_Straße,
            Wohnort_aktuell_Hausnummer, Studienzentrum, Vorgang
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    werte = (
        idx, familienname, rufname, geburtstag, geburtsmonat, geburtsjahr,
        geschlecht, geburtsort, staatsangehoerigkeit, zweite_staatsang,
        wohnort, plz, strasse, hausnummer, studienzentrum, vorgang
    )

    cursor.execute(sql, werte)

conn.commit()
print("✅ Import abgeschlossen!")
cursor.close()
conn.close()
