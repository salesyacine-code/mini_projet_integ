"""
wrappers/s3_wrapper.py
Adaptateur Source S3 — Neo4j

Nœuds   : Book, Writer, Copy, Member, Professor, Theme
Relations: WROTE, HAS_COPY, BORROWED{date,return_date},
           RECOMMENDS{date,reason}, BELONGS_TO

Mappings nouveaux :
  - BELONGS_TO → APPARTIENT_THEME (S3 est la seule source avec
    des theme_id réels et supporte potentiellement N thèmes par livre)
  - LIVRE.themes = liste des noms de thèmes liés
  - full_name → (prenom, nom)
"""

from database import neo4j_execute


def _split_fullname(full_name: str | None) -> tuple[str | None, str | None]:
    """Premier mot = prénom, reste = nom."""
    if not full_name:
        return None, None
    parts = full_name.strip().split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else parts[0]


# ──────────────────────────────────────────────────────────────
# AUTEUR
# ──────────────────────────────────────────────────────────────

def get_auteurs() -> list[dict]:
    records = neo4j_execute("""
        MATCH (w:Writer)
        RETURN toString(w.writer_id) AS auteur_id,
               w.full_name AS full_name,
               w.country   AS nationalite
    """)
    result = []
    for r in records:
        prenom, nom = _split_fullname(r.get("full_name"))
        result.append({
            "auteur_id": r.get("auteur_id"), "nom": nom, "prenom": prenom,
            "nationalite": r.get("nationalite"), "date_naissance": None,
            "source": "S3",
        })
    return result


# ──────────────────────────────────────────────────────────────
# THEME  (nœud Theme — identifiants réels, S3 est la source de référence)
# ──────────────────────────────────────────────────────────────

def get_themes() -> list[dict]:
    records = neo4j_execute("""
        MATCH (t:Theme)
        RETURN toString(t.theme_id) AS theme_id,
               toLower(t.name)      AS nom_theme
    """)
    return [
        {"theme_id": r.get("theme_id"), "nom_theme": r.get("nom_theme"), "source": "S3"}
        for r in records
    ]


# ──────────────────────────────────────────────────────────────
# APPARTIENT_THEME  (relation BELONGS_TO — S3 supporte N thèmes par livre)
# ──────────────────────────────────────────────────────────────

def get_appartient_theme() -> list[dict]:
    records = neo4j_execute("""
        MATCH (b:Book)-[:BELONGS_TO]->(t:Theme)
        RETURN b.isbn                AS livre_ref,
               toString(t.theme_id) AS theme_ref,
               toLower(t.name)      AS nom_theme
    """)
    return [
        {
            "livre_ref": r.get("livre_ref"),
            "theme_ref": r.get("theme_ref"),
            "nom_theme": r.get("nom_theme"),
            "source":    "S3",
        }
        for r in records
    ]


# ──────────────────────────────────────────────────────────────
# LIVRE  (themes = liste de tous les thèmes liés via BELONGS_TO)
# ──────────────────────────────────────────────────────────────

def get_livres() -> list[dict]:
    records = neo4j_execute("""
        MATCH (b:Book)
        OPTIONAL MATCH (w:Writer)-[:WROTE]->(b)
        OPTIONAL MATCH (b)-[:BELONGS_TO]->(t:Theme)
        WITH b, w, collect(toLower(t.name)) AS themes
        RETURN
            toString(b.book_id)   AS livre_id,
            b.isbn                AS isbn,
            b.title               AS titre,
            toInteger(b.year)     AS annee_publication,
            toString(w.writer_id) AS auteur_id,
            themes
    """)
    result = []
    for r in records:
        result.append({
            "livre_id":          r.get("livre_id"),
            "isbn":              r.get("isbn"),
            "titre":             r.get("titre"),
            "annee_publication": r.get("annee_publication"),
            "nb_pages":          None,
            "editeur":           None,
            "auteur_id":         r.get("auteur_id"),
            "themes":            [t for t in (r.get("themes") or []) if t],
            "source":            "S3",
        })
    return result


def get_livre_by_isbn(isbn: str) -> list[dict]:
    records = neo4j_execute("""
        MATCH (b:Book {isbn: $isbn})
        OPTIONAL MATCH (w:Writer)-[:WROTE]->(b)
        OPTIONAL MATCH (b)-[:BELONGS_TO]->(t:Theme)
        WITH b, w, collect(toLower(t.name)) AS themes
        RETURN
            toString(b.book_id)   AS livre_id,
            b.isbn                AS isbn,
            b.title               AS titre,
            toInteger(b.year)     AS annee_publication,
            toString(w.writer_id) AS auteur_id,
            themes
    """, {"isbn": isbn})
    result = []
    for r in records:
        result.append({
            "livre_id":          r.get("livre_id"),
            "isbn":              r.get("isbn"),
            "titre":             r.get("titre"),
            "annee_publication": r.get("annee_publication"),
            "nb_pages":          None,
            "editeur":           None,
            "auteur_id":         r.get("auteur_id"),
            "themes":            [t for t in (r.get("themes") or []) if t],
            "source":            "S3",
        })
    return result


# ──────────────────────────────────────────────────────────────
# EXEMPLAIRE
# ──────────────────────────────────────────────────────────────

def get_exemplaires() -> list[dict]:
    records = neo4j_execute("""
        MATCH (b:Book)-[:HAS_COPY]->(c:Copy)
        RETURN toString(c.copy_id) AS exemplaire_id,
               b.isbn              AS livre_ref,
               c.barcode           AS code_barre,
               c.condition         AS etat,
               c.status            AS status_raw
    """)
    return [
        {
            "exemplaire_id":  r.get("exemplaire_id"),
            "livre_ref":      r.get("livre_ref"),
            "code_barre":     r.get("code_barre"),
            "etat":           r.get("etat"),
            "disponibilite":  str(r.get("status_raw","")).lower() == "available",
            "source":         "S3",
        }
        for r in records
    ]


def get_exemplaires_disponibles() -> list[dict]:
    records = neo4j_execute("""
        MATCH (b:Book)-[:HAS_COPY]->(c:Copy {status:'available'})
        RETURN toString(c.copy_id) AS exemplaire_id,
               b.isbn              AS livre_ref,
               c.barcode           AS code_barre,
               c.condition         AS etat
    """)
    return [
        {
            "exemplaire_id": r.get("exemplaire_id"),
            "livre_ref":     r.get("livre_ref"),
            "code_barre":    r.get("code_barre"),
            "etat":          r.get("etat"),
            "disponibilite": True,
            "source":        "S3",
        }
        for r in records
    ]


# ──────────────────────────────────────────────────────────────
# PERSONNE  (Member + Professor)
# ──────────────────────────────────────────────────────────────

def get_personnes() -> list[dict]:
    members = neo4j_execute("""
        MATCH (m:Member)
        RETURN toString(m.member_id) AS personne_id,
               m.full_name AS full_name, m.email AS email
    """)
    profs = neo4j_execute("""
        MATCH (p:Professor)
        RETURN toString(p.prof_id) AS personne_id,
               p.full_name AS full_name, p.email AS email
    """)
    result = []
    for r in members:
        prenom, nom = _split_fullname(r.get("full_name"))
        result.append({"personne_id": r["personne_id"], "nom": nom, "prenom": prenom,
                        "email": r.get("email"), "type": "Adherent", "source": "S3"})
    for r in profs:
        prenom, nom = _split_fullname(r.get("full_name"))
        result.append({"personne_id": r["personne_id"], "nom": nom, "prenom": prenom,
                        "email": r.get("email"), "type": "Enseignant", "source": "S3"})
    return result


# ──────────────────────────────────────────────────────────────
# ADHERENT  (nœud Member)
# ──────────────────────────────────────────────────────────────

def get_adherents() -> list[dict]:
    records = neo4j_execute("""
        MATCH (m:Member)
        RETURN toString(m.member_id) AS personne_id,
               m.full_name AS full_name, m.email AS email
    """)
    result = []
    for r in records:
        prenom, nom = _split_fullname(r.get("full_name"))
        result.append({
            "personne_id": r["personne_id"], "nom": nom, "prenom": prenom,
            "email": r.get("email"), "telephone": None,
            "date_inscription": None, "cursus": None, "annee": None,
            "source": "S3",
        })
    return result


# ──────────────────────────────────────────────────────────────
# ENSEIGNANT  (nœud Professor)
# ──────────────────────────────────────────────────────────────

def get_enseignants() -> list[dict]:
    records = neo4j_execute("""
        MATCH (p:Professor)
        RETURN toString(p.prof_id) AS personne_id,
               p.full_name AS full_name, p.email AS email,
               p.department AS departement
    """)
    result = []
    for r in records:
        prenom, nom = _split_fullname(r.get("full_name"))
        result.append({
            "personne_id": r["personne_id"], "nom": nom, "prenom": prenom,
            "email": r.get("email"), "departement": r.get("departement"),
            "source": "S3",
        })
    return result


# ──────────────────────────────────────────────────────────────
# EMPRUNT  (relation BORROWED — personne_id = member_id → ADHERENT)
# ──────────────────────────────────────────────────────────────

def get_emprunts() -> list[dict]:
    records = neo4j_execute("""
        MATCH (m:Member)-[b:BORROWED]->(c:Copy)
        RETURN toString(c.copy_id)     AS exemplaire_id,
               toString(m.member_id)  AS personne_id,
               toString(b.date)       AS date_emprunt,
               toString(b.return_date) AS date_retour_prevue
    """)
    result = []
    for r in records:
        retour = r.get("date_retour_prevue")
        retour = None if retour in (None, "None", "null") else retour
        result.append({
            "emprunt_id":         None,
            "exemplaire_id":      r.get("exemplaire_id"),
            "personne_id":        r.get("personne_id"),
            "date_emprunt":       r.get("date_emprunt"),
            "date_retour_prevue": retour,
            "statut":             "rendu" if retour else "en cours",
            "source":             "S3",
        })
    return result


def get_emprunts_en_cours() -> list[dict]:
    records = neo4j_execute("""
        MATCH (m:Member)-[b:BORROWED]->(c:Copy)
        WHERE b.return_date IS NULL
        RETURN toString(c.copy_id)    AS exemplaire_id,
               toString(m.member_id) AS personne_id,
               toString(b.date)      AS date_emprunt
    """)
    return [
        {
            "emprunt_id": None, "exemplaire_id": r["exemplaire_id"],
            "personne_id": r["personne_id"], "date_emprunt": r["date_emprunt"],
            "date_retour_prevue": None, "statut": "en cours", "source": "S3",
        }
        for r in records
    ]


# ──────────────────────────────────────────────────────────────
# SUGGESTION  (relation RECOMMENDS — personne_id = prof_id → ENSEIGNANT)
# ──────────────────────────────────────────────────────────────

def get_suggestions() -> list[dict]:
    records = neo4j_execute("""
        MATCH (p:Professor)-[r:RECOMMENDS]->(b:Book)
        RETURN toString(p.prof_id) AS personne_id,
               b.isbn              AS livre_ref,
               toString(r.date)    AS date_suggestion,
               r.reason            AS raison
    """)
    return [
        {
            "suggestion_id":   None,
            "personne_id":     r.get("personne_id"),
            "livre_ref":       r.get("livre_ref"),
            "date_suggestion": r.get("date_suggestion"),
            "raison":          r.get("raison"),
            "source":          "S3",
        }
        for r in records
    ]