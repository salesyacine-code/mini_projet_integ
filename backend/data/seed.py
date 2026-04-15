"""
data/seed.py — Peuplement des 3 sources (schéma global v2)

S1 MySQL  : AUTEUR, LIVRE(categorie), EXEMPLAIRE, ADHERENT,
            ENSEIGNANT, EMPRUNT, SUGGESTION
S2 MongoDB: ouvrages (isbn_ref, titre_long, editeur, sujet, nbPage,
                       contributeurs[], stocks[])
            adherant  (identite, type, cursus?, departement?, suggestions[])
S3 Neo4j  : Writer, Book, Copy, Theme, Member, Professor
            WROTE, HAS_COPY, BELONGS_TO, BORROWED, RECOMMENDS
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import mysql_execute, get_mongo_db, neo4j_execute
from sqlalchemy import text
from database import _mysql_engine


# ══════════════════════════════════════════════════════════════
# S1 — MySQL  (schéma original conservé tel quel)
# ══════════════════════════════════════════════════════════════

DDL = [
    "DROP TABLE IF EXISTS SUGGESTION",
    "DROP TABLE IF EXISTS EMPRUNT",
    "DROP TABLE IF EXISTS EXEMPLAIRE",
    "DROP TABLE IF EXISTS LIVRE",
    "DROP TABLE IF EXISTS AUTEUR",
    "DROP TABLE IF EXISTS ADHERENT",
    "DROP TABLE IF EXISTS ENSEIGNANT",
    """CREATE TABLE AUTEUR (
        auteur_id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(100) NOT NULL, prenom VARCHAR(100),
        nationalite VARCHAR(80), date_naissance DATE)""",
    """CREATE TABLE LIVRE (
    livre_id INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(255) NOT NULL, 
    annee_publication INT, -- Changé de YEAR à INT
    isbn VARCHAR(20) UNIQUE, 
    auteur_id INT, 
    categorie VARCHAR(100),
    FOREIGN KEY (auteur_id) REFERENCES AUTEUR(auteur_id)
)""",
    """CREATE TABLE EXEMPLAIRE (
        exemplaire_id INT AUTO_INCREMENT PRIMARY KEY,
        livre_id INT NOT NULL, code_barre VARCHAR(50) UNIQUE,
        etat ENUM('neuf','bon','use','abime') DEFAULT 'bon',
        disponibilite BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (livre_id) REFERENCES LIVRE(livre_id))""",
    """CREATE TABLE ADHERENT (
        adherent_id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(100) NOT NULL, prenom VARCHAR(100),
        email VARCHAR(150) UNIQUE, telephone VARCHAR(20),
        date_inscription DATE)""",
    """CREATE TABLE ENSEIGNANT (
        enseignant_id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(100) NOT NULL, prenom VARCHAR(100),
        departement VARCHAR(100), email VARCHAR(150) UNIQUE)""",
    """CREATE TABLE EMPRUNT (
        emprunt_id INT AUTO_INCREMENT PRIMARY KEY,
        exemplaire_id INT NOT NULL, adherent_id INT NOT NULL,
        date_emprunt DATE NOT NULL, date_retour_prevue DATE,
        statut ENUM('en cours','rendu','retard') DEFAULT 'en cours',
        FOREIGN KEY (exemplaire_id) REFERENCES EXEMPLAIRE(exemplaire_id),
        FOREIGN KEY (adherent_id) REFERENCES ADHERENT(adherent_id))""",
    """CREATE TABLE SUGGESTION (
        suggestion_id INT AUTO_INCREMENT PRIMARY KEY,
        enseignant_id INT NOT NULL, livre_id INT NOT NULL,
        date_suggestion DATE, raison TEXT,
        FOREIGN KEY (enseignant_id) REFERENCES ENSEIGNANT(enseignant_id),
        FOREIGN KEY (livre_id) REFERENCES LIVRE(livre_id))""",
]

DATA = [
    "INSERT INTO AUTEUR VALUES (1,'Camus','Albert','Française','1913-11-07')",
    "INSERT INTO AUTEUR VALUES (2,'Hugo','Victor','Française','1802-02-26')",
    "INSERT INTO AUTEUR VALUES (3,'Knuth','Donald','Américaine','1938-01-10')",
    "INSERT INTO AUTEUR VALUES (4,'Zola','Emile','Française','1840-04-02')",
    "INSERT INTO AUTEUR VALUES (5,'Proust','Marcel','Française','1871-07-10')",
    # LIVRE — categorie sera extrait vers THEME via APPARTIENT_THEME
    "INSERT INTO LIVRE VALUES (1,'L\\'Etranger',1942,'978-2-07-036024-5',1,'Littérature')",
    "INSERT INTO LIVRE VALUES (2,'Les Misérables',1862,'978-2-07-040850-4',2,'Littérature')",
    "INSERT INTO LIVRE VALUES (3,'The Art of Computer Programming',1968,'978-0-201-89683-1',3,'Informatique')",
    "INSERT INTO LIVRE VALUES (4,'Germinal',1885,'978-2-07-040026-3',4,'Littérature')",
    "INSERT INTO LIVRE VALUES (5,'Du côté de chez Swann',1913,'978-2-07-036024-6',5,'Littérature')",
    "INSERT INTO LIVRE VALUES (6,'Algorithms',2011,'978-0-13-276256-4',3,'Informatique')",
    # EXEMPLAIRE
    "INSERT INTO EXEMPLAIRE VALUES (1,1,'BC001','bon',TRUE)",
    "INSERT INTO EXEMPLAIRE VALUES (2,1,'BC002','use',FALSE)",
    "INSERT INTO EXEMPLAIRE VALUES (3,2,'BC003','neuf',TRUE)",
    "INSERT INTO EXEMPLAIRE VALUES (4,3,'BC004','bon',TRUE)",
    "INSERT INTO EXEMPLAIRE VALUES (5,4,'BC005','bon',FALSE)",
    "INSERT INTO EXEMPLAIRE VALUES (6,6,'BC006','neuf',TRUE)",
    # ADHERENT
    "INSERT INTO ADHERENT VALUES (1,'Benali','Sara','sara.benali@email.dz','0550001122','2022-09-01')",
    "INSERT INTO ADHERENT VALUES (2,'Meziane','Karim','karim.mez@email.dz','0660002233','2021-03-15')",
    "INSERT INTO ADHERENT VALUES (3,'Hamdi','Lina','lina.hamdi@email.dz','0770003344','2023-01-10')",
    # ENSEIGNANT
    "INSERT INTO ENSEIGNANT VALUES (1,'Bensalem','Nadia','Informatique','n.bensalem@univ.dz')",
    "INSERT INTO ENSEIGNANT VALUES (2,'Aouad','Rachid','Lettres','r.aouad@univ.dz')",
    # EMPRUNT  — adherent_id → ADHERENT (personne_id dans le schéma global)
    "INSERT INTO EMPRUNT VALUES (1,1,1,'2024-01-10','2024-02-10','rendu')",
    "INSERT INTO EMPRUNT VALUES (2,3,2,'2024-03-05','2024-04-05','en cours')",
    "INSERT INTO EMPRUNT VALUES (3,4,3,'2024-04-01','2024-05-01','en cours')",
    "INSERT INTO EMPRUNT VALUES (4,5,1,'2024-02-01','2024-03-01','retard')",
    # SUGGESTION  — enseignant_id → ENSEIGNANT (personne_id dans le schéma global)
    "INSERT INTO SUGGESTION VALUES (1,1,3,'2024-01-15','Excellent pour le cours d\\'algorithmique')",
    "INSERT INTO SUGGESTION VALUES (2,2,2,'2024-02-20','Référence incontournable en littérature française')",
]


def seed_s1():
    print("── S1 (MySQL) ────────────────────────────────────")
    with _mysql_engine.connect() as conn:
        for s in DDL:
            conn.execute(text(s))
        conn.commit()
        for s in DATA:
            conn.execute(text(s))
        conn.commit()
    print("  ✓ Tables créées et données insérées.")


# ══════════════════════════════════════════════════════════════
# S2 — MongoDB
# ══════════════════════════════════════════════════════════════

def seed_s2():
    print("── S2 (MongoDB) ──────────────────────────────────")
    db = get_mongo_db()
    db.ouvrages.drop()
    db.adherant.drop()

    db.ouvrages.insert_many([
        {
            "isbn_ref": "978-2-07-036024-5", "titre_long": "L'Étranger",
            "editeur": "Gallimard", "sujet": "Littérature", "nbPage": "123 pages",
            "contributeurs": [{"nom": "Camus", "prenom": "Albert", "role": "auteur"}],
            "stocks": [
                {"code_barre": "BC001", "etat": "bon",  "disponible": "oui", "localisation": "A1"},
                {"code_barre": "BC002", "etat": "usé",  "disponible": "non", "localisation": "A1"},
            ],
        },
        {
            "isbn_ref": "978-0-13-276256-4", "titre_long": "Algorithms — 4th edition",
            "editeur": "Addison-Wesley", "sujet": "Informatique", "nbPage": "976 pages",
            "contributeurs": [
                {"nom": "Sedgewick", "prenom": "Robert", "role": "auteur"},
                {"nom": "Wayne",     "prenom": "Kevin",  "role": "auteur"},
            ],
            "stocks": [
                {"code_barre": "BC006", "etat": "neuf", "disponible": "oui", "localisation": "B3"},
            ],
        },
        {
            "isbn_ref": "978-2-07-054839-1", "titre_long": "Le Petit Prince",
            "editeur": "Gallimard", "sujet": "Jeunesse", "nbPage": "96 pages",
            "contributeurs": [{"nom": "de Saint-Exupéry", "prenom": "Antoine", "role": "auteur"}],
            "stocks": [
                {"code_barre": "BC010", "etat": "bon", "disponible": "oui", "localisation": "C2"},
                {"code_barre": "BC011", "etat": "bon", "disponible": "oui", "localisation": "C2"},
            ],
        },
        {
            "isbn_ref": "978-0-13-110362-7", "titre_long": "The C Programming Language",
            "editeur": "Prentice Hall", "sujet": "Informatique", "nbPage": "274 pages",
            "contributeurs": [
                {"nom": "Kernighan", "prenom": "Brian",  "role": "auteur"},
                {"nom": "Ritchie",   "prenom": "Dennis", "role": "auteur"},
            ],
            "stocks": [
                {"code_barre": "BC012", "etat": "usé", "disponible": "non", "localisation": "B1"},
                {"code_barre": "BC013", "etat": "bon", "disponible": "oui", "localisation": "B1"},
            ],
        },
    ])

    db.adherant.insert_many([
        {
            "identite": {"nom": "Benali", "prenom": "Sara", "email": "sara.benali@email.dz"},
            "type": "Etudiant",
            "cursus": {"niveau": "Master 2", "annee": 2024},
            "suggestions": [],
        },
        {
            "identite": {"nom": "Meziane", "prenom": "Karim", "email": "karim.mez@email.dz"},
            "type": "Etudiant",
            "cursus": {"niveau": "Licence 3", "annee": 2024},
            "suggestions": [],
        },
        {
            "identite": {"nom": "Bensalem", "prenom": "Nadia", "email": "n.bensalem@univ.dz"},
            "type": "Professeur", "departement": "Informatique",
            "suggestions": [
                {"titre": "Algorithms", "raison": "Indispensable pour les cours de structures de données", "date_sugg": "2024-02-10"},
                {"titre": "The C Programming Language", "raison": "Référence historique du C", "date_sugg": "2024-03-05"},
            ],
        },
        {
            "identite": {"nom": "Aouad", "prenom": "Rachid", "email": "r.aouad@univ.dz"},
            "type": "Professeur", "departement": "Lettres Françaises",
            "suggestions": [
                {"titre": "Le Petit Prince", "raison": "Lecture obligatoire en 1ère année", "date_sugg": "2024-01-20"},
            ],
        },
    ])
    print("  ✓ Collections insérées.")


# ══════════════════════════════════════════════════════════════
# S3 — Neo4j
# ══════════════════════════════════════════════════════════════

def seed_s3():
    print("── S3 (Neo4j) ────────────────────────────────────")
    neo4j_execute("MATCH (n) DETACH DELETE n")

    # Thèmes (nœuds avec IDs réels)
    neo4j_execute("""
        CREATE (:Theme {theme_id:1, name:'Littérature'}),
               (:Theme {theme_id:2, name:'Informatique'}),
               (:Theme {theme_id:3, name:'Jeunesse'})
    """)
    # Writers
    neo4j_execute("""
        CREATE (:Writer {writer_id:'W1', full_name:'Albert Camus',          country:'France'}),
               (:Writer {writer_id:'W2', full_name:'Victor Hugo',           country:'France'}),
               (:Writer {writer_id:'W3', full_name:'Donald Knuth',          country:'USA'}),
               (:Writer {writer_id:'W4', full_name:'Robert Sedgewick',      country:'USA'}),
               (:Writer {writer_id:'W5', full_name:'Antoine Saint-Exupery', country:'France'})
    """)
    # Books
    neo4j_execute("""
        CREATE (:Book {book_id:'B1', isbn:'978-2-07-036024-5', title:"L'Etranger",               year:1942}),
               (:Book {book_id:'B2', isbn:'978-2-07-040850-4', title:'Les Miserables',            year:1862}),
               (:Book {book_id:'B3', isbn:'978-0-201-89683-1', title:'The Art of Computer Prog',  year:1968}),
               (:Book {book_id:'B4', isbn:'978-0-13-276256-4', title:'Algorithms',                year:2011}),
               (:Book {book_id:'B5', isbn:'978-2-07-054839-1', title:'Le Petit Prince',           year:1943}),
               (:Book {book_id:'B6', isbn:'978-0-13-110362-7', title:'The C Programming Language',year:1978})
    """)
    # Copies
    neo4j_execute("""
        CREATE (:Copy {copy_id:'C1', barcode:'BC001', condition:'bon',  status:'borrowed'}),
               (:Copy {copy_id:'C2', barcode:'BC002', condition:'use',  status:'borrowed'}),
               (:Copy {copy_id:'C3', barcode:'BC003', condition:'neuf', status:'available'}),
               (:Copy {copy_id:'C4', barcode:'BC004', condition:'bon',  status:'available'}),
               (:Copy {copy_id:'C5', barcode:'BC005', condition:'bon',  status:'borrowed'}),
               (:Copy {copy_id:'C6', barcode:'BC010', condition:'bon',  status:'available'}),
               (:Copy {copy_id:'C7', barcode:'BC012', condition:'use',  status:'borrowed'}),
               (:Copy {copy_id:'C8', barcode:'BC013', condition:'bon',  status:'available'})
    """)
    # Members & Professors
    neo4j_execute("""
        CREATE (:Member    {member_id:'M1', full_name:'Sara Benali',    email:'sara.benali@email.dz'}),
               (:Member    {member_id:'M2', full_name:'Karim Meziane',  email:'karim.mez@email.dz'}),
               (:Member    {member_id:'M3', full_name:'Lina Hamdi',     email:'lina.hamdi@email.dz'}),
               (:Professor {prof_id:'P1',   full_name:'Nadia Bensalem', email:'n.bensalem@univ.dz', department:'Informatique'}),
               (:Professor {prof_id:'P2',   full_name:'Rachid Aouad',   email:'r.aouad@univ.dz',   department:'Lettres'})
    """)
    # WROTE
    for w, b in [('W1','B1'),('W2','B2'),('W3','B3'),('W4','B4'),('W5','B5')]:
        neo4j_execute(f"MATCH (w:Writer {{writer_id:'{w}'}}),(b:Book {{book_id:'{b}'}}) CREATE (w)-[:WROTE]->(b)")
    # HAS_COPY
    for b, c in [('B1','C1'),('B1','C2'),('B2','C3'),('B3','C4'),('B4','C5'),('B5','C6'),('B6','C7'),('B6','C8')]:
        neo4j_execute(f"MATCH (b:Book {{book_id:'{b}'}}),(c:Copy {{copy_id:'{c}'}}) CREATE (b)-[:HAS_COPY]->(c)")
    # BELONGS_TO — S3 permet plusieurs thèmes par livre (B3 et B6 = Informatique + Sciences)
    for b, t in [('B1',1),('B2',1),('B3',2),('B4',2),('B5',3),('B6',2)]:
        neo4j_execute(f"MATCH (b:Book {{book_id:'{b}'}}),(t:Theme {{theme_id:{t}}}) CREATE (b)-[:BELONGS_TO]->(t)")
    # BORROWED
    for m, c, d, r in [('M1','C1','2024-01-10','2024-02-10'),
                        ('M2','C2','2024-03-05', None),
                        ('M3','C5','2024-04-01', None),
                        ('M1','C7','2024-02-15', None)]:
        rd = f"'{r}'" if r else "null"
        neo4j_execute(f"MATCH (m:Member {{member_id:'{m}'}}),(c:Copy {{copy_id:'{c}'}}) "
                      f"CREATE (m)-[:BORROWED {{date:'{d}', return_date:{rd}}}]->(c)")
    # RECOMMENDS
    for p, b, d, reason in [
        ('P1','B3','2024-01-15',"Excellent pour l'algorithmique"),
        ('P2','B2','2024-02-20','Référence en littérature'),
        ('P1','B4','2024-03-01','Structures de données modernes'),
    ]:
        neo4j_execute(f"MATCH (p:Professor {{prof_id:'{p}'}}),(b:Book {{book_id:'{b}'}}) "
                      f"CREATE (p)-[:RECOMMENDS {{date:'{d}', reason:\"{reason}\"}}]->(b)")
    print("  ✓ Nœuds et relations créés.")


if __name__ == "__main__":
    print("=== Peuplement des 3 sources (schéma v2) ===\n")
    for name, fn in [("S1",seed_s1), ("S2",seed_s2), ("S3",seed_s3)]:
        try:
            fn()
        except Exception as e:
            print(f"  ✗ {name} : {e}")
    print("\n=== Terminé ===")