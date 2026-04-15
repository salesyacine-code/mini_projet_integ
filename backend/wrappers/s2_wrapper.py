"""
wrappers/s2_wrapper.py
Adaptateur Source S2 — MongoDB

Collections :
  ouvrages  { isbn_ref, titre_long, editeur, sujet, nbPage,
               contributeurs[], stocks[] }
  adherant  { identite{nom,prenom,email}, type,
               cursus{niveau,annee}?, departement?,
               suggestions[] }

Mappings nouveaux :
  - ouvrages.sujet          → THEME + APPARTIENT_THEME
  - ouvrages.editeur        → LIVRE.editeur  (maintenant dans le schéma global)
  - ouvrages.nbPage         → LIVRE.nb_pages (cast String→INT)
  - pas de theme_id direct dans LIVRE
"""

import re
from database import get_mongo_db


def _cast_pages(val) -> int | None:
    if val is None:
        return None
    cleaned = re.sub(r"[^0-9]", "", str(val))
    return int(cleaned) if cleaned else None


def _str_id(val) -> str | None:
    return str(val) if val is not None else None


def _normalize_theme(val) -> str | None:
    return str(val).lower().strip() if val else None


# ──────────────────────────────────────────────────────────────
# AUTEUR  (contributeurs[] avec role contenant 'auteur')
# ──────────────────────────────────────────────────────────────

def get_auteurs() -> list[dict]:
    db = get_mongo_db()
    result, seen = [], set()
    for doc in db.ouvrages.find({}, {"contributeurs": 1}):
        for c in doc.get("contributeurs", []):
            if "auteur" not in str(c.get("role", "")).lower():
                continue
            key = (c.get("nom", ""), c.get("prenom", ""))
            if key in seen:
                continue
            seen.add(key)
            result.append({
                "auteur_id": None, "nom": c.get("nom"),
                "prenom": c.get("prenom"), "nationalite": None,
                "date_naissance": None, "source": "S2",
            })
    return result


# ──────────────────────────────────────────────────────────────
# THEME  (distinct sur sujet)
# ──────────────────────────────────────────────────────────────

def get_themes() -> list[dict]:
    db = get_mongo_db()
    return [
        {"theme_id": None, "nom_theme": _normalize_theme(s), "source": "S2"}
        for s in db.ouvrages.distinct("sujet")
        if s
    ]


# ──────────────────────────────────────────────────────────────
# APPARTIENT_THEME  (ouvrage → sujet, 1 thème par document S2)
# ──────────────────────────────────────────────────────────────

def get_appartient_theme() -> list[dict]:
    db = get_mongo_db()
    result = []
    for doc in db.ouvrages.find({"sujet": {"$exists": True, "$ne": ""}},
                                 {"isbn_ref": 1, "sujet": 1}):
        nom = _normalize_theme(doc.get("sujet"))
        if nom:
            result.append({
                "livre_ref": doc.get("isbn_ref"),
                "theme_ref": nom,
                "nom_theme": nom,
                "source":    "S2",
            })
    return result


# ──────────────────────────────────────────────────────────────
# LIVRE  (nb_pages et editeur maintenant dans le schéma global)
# ──────────────────────────────────────────────────────────────

def get_livres() -> list[dict]:
    db = get_mongo_db()
    result = []
    for doc in db.ouvrages.find({}):
        nom_theme = _normalize_theme(doc.get("sujet"))
        result.append({
            "livre_id":          None,
            "isbn":              doc.get("isbn_ref"),
            "titre":             doc.get("titre_long"),
            "annee_publication": None,
            "nb_pages":          _cast_pages(doc.get("nbPage")),
            "editeur":           doc.get("editeur"),
            "auteur_id":         None,
            "themes":            [nom_theme] if nom_theme else [],
            "source":            "S2",
        })
    return result


def get_livre_by_isbn(isbn: str) -> list[dict]:
    db = get_mongo_db()
    doc = db.ouvrages.find_one({"isbn_ref": isbn})
    if not doc:
        return []
    nom_theme = _normalize_theme(doc.get("sujet"))
    return [{
        "livre_id":          None,
        "isbn":              doc.get("isbn_ref"),
        "titre":             doc.get("titre_long"),
        "annee_publication": None,
        "nb_pages":          _cast_pages(doc.get("nbPage")),
        "editeur":           doc.get("editeur"),
        "auteur_id":         None,
        "themes":            [nom_theme] if nom_theme else [],
        "source":            "S2",
    }]


# ──────────────────────────────────────────────────────────────
# EXEMPLAIRE  (dénormalisation stocks[])
# ──────────────────────────────────────────────────────────────

def get_exemplaires() -> list[dict]:
    db = get_mongo_db()
    result = []
    for doc in db.ouvrages.find({}, {"isbn_ref": 1, "stocks": 1}):
        for s in doc.get("stocks", []):
            dispo = str(s.get("disponible", "non")).lower() in ("oui","true","1","yes")
            result.append({
                "exemplaire_id": None,
                "livre_ref":     doc.get("isbn_ref"),
                "code_barre":    s.get("code_barre"),
                "etat":          s.get("etat"),
                "disponibilite": dispo,
                "source":        "S2",
            })
    return result


def get_exemplaires_disponibles() -> list[dict]:
    db = get_mongo_db()
    result = []
    for doc in db.ouvrages.find({}, {"isbn_ref": 1, "stocks": 1}):
        for s in doc.get("stocks", []):
            if str(s.get("disponible", "non")).lower() in ("oui","true","1","yes"):
                result.append({
                    "exemplaire_id": None,
                    "livre_ref":     doc.get("isbn_ref"),
                    "code_barre":    s.get("code_barre"),
                    "etat":          s.get("etat"),
                    "disponibilite": True,
                    "source":        "S2",
                })
    return result


# ──────────────────────────────────────────────────────────────
# PERSONNE
# ──────────────────────────────────────────────────────────────

def get_personnes() -> list[dict]:
    db = get_mongo_db()
    result = []
    for doc in db.adherant.find({}):
        identite = doc.get("identite", {})
        tp = "Enseignant" if str(doc.get("type","")).lower() in ("professeur","enseignant") else "Adherent"
        result.append({
            "personne_id": _str_id(doc.get("_id")),
            "nom":         identite.get("nom"),
            "prenom":      identite.get("prenom"),
            "email":       identite.get("email"),
            "type":        tp,
            "source":      "S2",
        })
    return result


# ──────────────────────────────────────────────────────────────
# ADHERENT  (type = Etudiant)
# ──────────────────────────────────────────────────────────────

def get_adherents() -> list[dict]:
    db = get_mongo_db()
    result = []
    for doc in db.adherant.find({"type": {"$in": ["Etudiant","etudiant","Adherent"]}}):
        identite = doc.get("identite", {})
        cursus   = doc.get("cursus") or {}
        result.append({
            "personne_id":      _str_id(doc.get("_id")),
            "nom":              identite.get("nom"),
            "prenom":           identite.get("prenom"),
            "email":            identite.get("email"),
            "telephone":        None,
            "date_inscription": None,
            "cursus":           cursus.get("niveau"),
            "annee":            str(cursus["annee"]) if cursus.get("annee") else None,
            "source":           "S2",
        })
    return result


# ──────────────────────────────────────────────────────────────
# ENSEIGNANT  (type = Professeur)
# ──────────────────────────────────────────────────────────────

def get_enseignants() -> list[dict]:
    db = get_mongo_db()
    result = []
    for doc in db.adherant.find({"type": {"$in": ["Professeur","professeur","Enseignant"]}}):
        identite = doc.get("identite", {})
        result.append({
            "personne_id": _str_id(doc.get("_id")),
            "nom":         identite.get("nom"),
            "prenom":      identite.get("prenom"),
            "email":       identite.get("email"),
            "departement": doc.get("departement"),
            "source":      "S2",
        })
    return result


# ──────────────────────────────────────────────────────────────
# EMPRUNT  — absent de S2
# ──────────────────────────────────────────────────────────────

def get_emprunts() -> list[dict]:
    return []


def get_emprunts_en_cours() -> list[dict]:
    return []


# ──────────────────────────────────────────────────────────────
# SUGGESTION  (suggestions[] dans adherant Professeur)
# livre_ref = NULL (pas de FK directe dans S2)
# ──────────────────────────────────────────────────────────────

def get_suggestions() -> list[dict]:
    db = get_mongo_db()
    result = []
    for doc in db.adherant.find(
        {"type": {"$in": ["Professeur","professeur","Enseignant"]}},
        {"_id": 1, "suggestions": 1}
    ):
        for s in doc.get("suggestions", []):
            result.append({
                "suggestion_id":   None,
                "personne_id":     _str_id(doc.get("_id")),
                "livre_ref":       None,
                "date_suggestion": str(s["date_sugg"]) if s.get("date_sugg") else None,
                "raison":          s.get("raison"),
                "source":          "S2",
            })
    return result