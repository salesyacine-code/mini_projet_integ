"""
wrappers/s1_wrapper.py
Adaptateur Source S1 — MySQL / PostgreSQL

Schéma S1 :
  AUTEUR · LIVRE(categorie) · EXEMPLAIRE · ADHERENT · ENSEIGNANT
  EMPRUNT · SUGGESTION

Mappings nouveaux :
  - LIVRE.categorie → APPARTIENT_THEME (1 thème par livre dans S1)
  - LIVRE n'a plus theme_id dans le modèle global
  - ADHERENT/ENSEIGNANT → ISA via PERSONNE
"""

from database import mysql_execute


# ──────────────────────────────────────────────────────────────
# AUTEUR
# ──────────────────────────────────────────────────────────────

def get_auteurs() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(auteur_id AS CHAR)      AS auteur_id,
            nom, prenom, nationalite,
            CAST(date_naissance AS CHAR) AS date_naissance
        FROM AUTEUR
    """)
    for r in rows:
        r["source"] = "S1"
    return rows


# ──────────────────────────────────────────────────────────────
# THEME  (extrait de LIVRE.categorie)
# ──────────────────────────────────────────────────────────────

def get_themes() -> list[dict]:
    rows = mysql_execute("""
        SELECT DISTINCT LOWER(TRIM(categorie)) AS nom_theme
        FROM LIVRE
        WHERE categorie IS NOT NULL AND TRIM(categorie) != ''
    """)
    return [
        {"theme_id": None, "nom_theme": r["nom_theme"], "source": "S1"}
        for r in rows
    ]


# ──────────────────────────────────────────────────────────────
# APPARTIENT_THEME  (LIVRE → THEME via categorie — 1 thème max par livre S1)
# ──────────────────────────────────────────────────────────────

def get_appartient_theme() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(livre_id AS CHAR)       AS livre_ref,
            LOWER(TRIM(categorie))       AS nom_theme
        FROM LIVRE
        WHERE categorie IS NOT NULL AND TRIM(categorie) != ''
    """)
    return [
        {
            "livre_ref": r["livre_ref"],
            "theme_ref": r["nom_theme"],   # clé sémantique (pas d'id dans S1)
            "nom_theme": r["nom_theme"],
            "source":    "S1",
        }
        for r in rows
    ]


# ──────────────────────────────────────────────────────────────
# LIVRE  (sans categorie, sans theme_id)
# ──────────────────────────────────────────────────────────────

def get_livres() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(livre_id AS CHAR)    AS livre_id,
            isbn, titre,
            annee_publication,
            NULL                      AS nb_pages,
            NULL                      AS editeur,
            CAST(auteur_id AS CHAR)   AS auteur_id,
            LOWER(TRIM(categorie))    AS _categorie
        FROM LIVRE
    """)
    for r in rows:
        r["themes"] = [r.pop("_categorie")] if r.get("_categorie") else []
        r["source"] = "S1"
    return rows


def get_livre_by_isbn(isbn: str) -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(livre_id AS CHAR)  AS livre_id,
            isbn, titre,
            annee_publication,
            NULL                    AS nb_pages,
            NULL                    AS editeur,
            CAST(auteur_id AS CHAR) AS auteur_id,
            LOWER(TRIM(categorie))  AS _categorie
        FROM LIVRE WHERE isbn = :isbn
    """, {"isbn": isbn})
    for r in rows:
        r["themes"] = [r.pop("_categorie")] if r.get("_categorie") else []
        r["source"] = "S1"
    return rows


# ──────────────────────────────────────────────────────────────
# EXEMPLAIRE
# ──────────────────────────────────────────────────────────────

def get_exemplaires() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(exemplaire_id AS CHAR) AS exemplaire_id,
            CAST(livre_id AS CHAR)      AS livre_ref,
            code_barre, etat, disponibilite
        FROM EXEMPLAIRE
    """)
    for r in rows:
        r["disponibilite"] = bool(r["disponibilite"])
        r["source"] = "S1"
    return rows


def get_exemplaires_disponibles() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(exemplaire_id AS CHAR) AS exemplaire_id,
            CAST(livre_id AS CHAR)      AS livre_ref,
            code_barre, etat, disponibilite
        FROM EXEMPLAIRE WHERE disponibilite = TRUE
    """)
    for r in rows:
        r["disponibilite"] = True
        r["source"] = "S1"
    return rows


# ──────────────────────────────────────────────────────────────
# PERSONNE  (ADHERENT + ENSEIGNANT)
# ──────────────────────────────────────────────────────────────

def get_personnes() -> list[dict]:
    adh = mysql_execute("""
        SELECT CAST(adherent_id AS CHAR) AS personne_id,
               nom, prenom, email, 'Adherent' AS type
        FROM ADHERENT
    """)
    ens = mysql_execute("""
        SELECT CAST(enseignant_id AS CHAR) AS personne_id,
               nom, prenom, email, 'Enseignant' AS type
        FROM ENSEIGNANT
    """)
    for r in adh + ens:
        r["source"] = "S1"
    return adh + ens


# ──────────────────────────────────────────────────────────────
# ADHERENT  (sous-type ISA — personne_id = adherent_id)
# ──────────────────────────────────────────────────────────────

def get_adherents() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(adherent_id AS CHAR)      AS personne_id,
            nom, prenom, email,
            telephone,
            CAST(date_inscription AS CHAR) AS date_inscription,
            NULL AS cursus,
            NULL AS annee
        FROM ADHERENT
    """)
    for r in rows:
        r["source"] = "S1"
    return rows


# ──────────────────────────────────────────────────────────────
# ENSEIGNANT  (sous-type ISA — personne_id = enseignant_id)
# ──────────────────────────────────────────────────────────────

def get_enseignants() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(enseignant_id AS CHAR) AS personne_id,
            nom, prenom, email,
            departement
        FROM ENSEIGNANT
    """)
    for r in rows:
        r["source"] = "S1"
    return rows


# ──────────────────────────────────────────────────────────────
# EMPRUNT  (personne_id = adherent_id → ADHERENT)
# ──────────────────────────────────────────────────────────────

def get_emprunts() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(emprunt_id AS CHAR)         AS emprunt_id,
            CAST(exemplaire_id AS CHAR)      AS exemplaire_id,
            CAST(adherent_id AS CHAR)        AS personne_id,
            CAST(date_emprunt AS CHAR)       AS date_emprunt,
            CAST(date_retour_prevue AS CHAR) AS date_retour_prevue,
            statut
        FROM EMPRUNT
    """)
    for r in rows:
        r["source"] = "S1"
    return rows


def get_emprunts_en_cours() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(emprunt_id AS CHAR)         AS emprunt_id,
            CAST(exemplaire_id AS CHAR)      AS exemplaire_id,
            CAST(adherent_id AS CHAR)        AS personne_id,
            CAST(date_emprunt AS CHAR)       AS date_emprunt,
            CAST(date_retour_prevue AS CHAR) AS date_retour_prevue,
            statut
        FROM EMPRUNT WHERE statut = 'en cours'
    """)
    for r in rows:
        r["source"] = "S1"
    return rows


# ──────────────────────────────────────────────────────────────
# SUGGESTION  (personne_id = enseignant_id → ENSEIGNANT)
# ──────────────────────────────────────────────────────────────

def get_suggestions() -> list[dict]:
    rows = mysql_execute("""
        SELECT
            CAST(suggestion_id AS CHAR)     AS suggestion_id,
            CAST(enseignant_id AS CHAR)     AS personne_id,
            CAST(livre_id AS CHAR)          AS livre_ref,
            CAST(date_suggestion AS CHAR)   AS date_suggestion,
            raison
        FROM SUGGESTION
    """)
    for r in rows:
        r["source"] = "S1"
    return rows