# Bibliothèque — API de médiation FastAPI

Système de médiation de données hétérogènes sur 3 sources :
- **S1** — MySQL / PostgreSQL (base relationnelle)
- **S2** — MongoDB (documents NoSQL)
- **S3** — Neo4j (graphe de propriétés)

---

## Structure du projet

```
bibliotheque/
├── main.py                    # Endpoints FastAPI (CRUD × 8 entités)
├── models.py                  # Schémas Pydantic
├── database.py                # Connexions S1 / S2 / S3
├── requirements.txt
├── .env                       # Variables d'environnement (à créer)
├── services/
│   └── mediator.py            # Orchestration lecture + écriture
└── wrappers/
    ├── wrapper_s1.py          # Traducteur MySQL
    ├── wrapper_s2.py          # Traducteur MongoDB
    └── wrapper_s3.py          # Traducteur Neo4j (Cypher)
```

---

## Installation

```bash
pip install -r requirements.txt
```

---

## Variables d'environnement (.env)

```env
# S1 — MySQL
S1_HOST=localhost
S1_PORT=3306
S1_USER=root
S1_PASSWORD=motdepasse
S1_DB=bibliotheque

# S2 — MongoDB
S2_URI=mongodb://localhost:27017
S2_DB=bibliotheque

# S3 — Neo4j
S3_URI=bolt://localhost:7687
S3_USER=neo4j
S3_PASS=motdepasse
```

---

## Démarrage

```bash
uvicorn main:app --reload --port 8000
```

Swagger UI disponible sur : http://localhost:8000/docs

---

## Logique CRUD

### Lectures (GET)
Les GET fusionnent **automatiquement les 3 sources** en parallèle.
Les doublons sont éliminés par clé naturelle (isbn, email, code_barre…).

```
GET /livres          → S1 + S2 + S3 fusionnés
GET /adherents       → S1 + S2 + S3 fusionnés
GET /emprunts        → S1 + S3 fusionnés (absent de S2)
```

### Écritures (POST / PUT / DELETE)
Les écritures ciblent **une source spécifique** via le paramètre `?source=`.
Le frontend choisit dans quelle source physique insérer.

```
POST /livres?source=S1        → insère dans MySQL
POST /livres?source=S2        → insère dans MongoDB
POST /livres?source=S3        → crée un nœud Book dans Neo4j

PUT  /livres/{isbn}?source=S2 → met à jour dans MongoDB
DELETE /livres/{isbn}?source=S3 → supprime le nœud Neo4j
```

---

## Exemples d'appels

### Créer un livre dans S1 (MySQL)
```bash
curl -X POST "http://localhost:8000/livres?source=S1" \
  -H "Content-Type: application/json" \
  -d '{"isbn":"978-1234","titre":"Bases de données","annee_publication":2024,"theme":"Informatique"}'
```

### Créer un adhérent dans S2 (MongoDB)
```bash
curl -X POST "http://localhost:8000/adherents?source=S2" \
  -H "Content-Type: application/json" \
  -d '{"nom":"Benali","prenom":"Amina","email":"a.benali@univ.dz","niveau":"L3","annee":"2024"}'
```

### Créer un emprunt dans S3 (Neo4j)
```bash
curl -X POST "http://localhost:8000/emprunts?source=S3" \
  -H "Content-Type: application/json" \
  -d '{"adherent_id":"M-BENAME","exemplaire_id":"C-BARCODE01","date_emprunt":"2025-04-15"}'
```

### Créer une suggestion dans S2 (embarquée dans adherant)
```bash
curl -X POST "http://localhost:8000/suggestions?source=S2" \
  -H "Content-Type: application/json" \
  -d '{"enseignant_id":"<ObjectId_MongoDB>","titre_suggere":"Graph Algorithms","raison":"Cours M2 graphes"}'
```

---

## Particularités par source

| Entité       | S1 (MySQL)      | S2 (MongoDB)                     | S3 (Neo4j)                      |
|--------------|-----------------|----------------------------------|---------------------------------|
| AUTEUR       | Table AUTEUR    | contributeurs[role='auteur']     | Nœud Writer, décompose full_name|
| THEME        | Attribut categorie | Attribut sujet                | Nœud Theme (IDs propres)        |
| EXEMPLAIRE   | Table EXEMPLAIRE| stocks[] imbriqué dans ouvrages  | Nœud Copy lié via HAS_COPY      |
| ADHERENT     | Table ADHERENT  | type=Etudiant dans adherant      | Nœud Member                     |
| ENSEIGNANT   | Table ENSEIGNANT| type=Professeur dans adherant    | Nœud Professor                  |
| EMPRUNT      | Table EMPRUNT   | **absent**                       | Relation [:BORROWED]            |
| SUGGESTION   | Table SUGGESTION| suggestions[] imbriqué (Professeur)| Relation [:RECOMMENDS]        |

---

## Réponse d'écriture (CRUDResponse)

```json
{
  "success": true,
  "source": "S1",
  "message": "Livre créé",
  "data": {
    "livre_id": 42,
    "isbn": "978-1234",
    "titre": "Bases de données",
    "_source": "S1"
  }
}
```
