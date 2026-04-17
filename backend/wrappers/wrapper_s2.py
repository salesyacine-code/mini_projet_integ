"""
wrappers/wrapper_s2.py
Wrapper pour S2 — MongoDB (collections : ouvrages, adherant)
Traduit chaque opération CRUD globale en opérations MongoDB.

Particularités de S2 :
  - Les exemplaires (stocks[]) sont imbriqués dans ouvrages
  - Les suggestions sont imbriquées dans adherant[]
  - nb_pages est stocké en String → cast en int à la lecture
  - disponibilite est 'oui'/'non' → normalisé en bool
  - Le type (Etudiant/Professeur) est un champ discriminant
"""

import re
from bson import ObjectId
from database import get_s2_db
from typing import Optional


def _oid(id_str: str):
    """Convertit une string en ObjectId MongoDB."""
    try:
        return ObjectId(id_str)
    except Exception:
        return id_str


def _safe_int(val) -> Optional[int]:
    """Cast String → int pour nb_pages."""
    try:
        return int(re.sub(r"[^0-9]", "", str(val)))
    except Exception:
        return None


def _norm_bool(val) -> bool:
    """Normalise 'oui'/'non'/True/False → bool."""
    if isinstance(val, bool):
        return val
    return str(val).lower() in ("oui", "true", "1", "yes")


def _serialize(doc: dict) -> dict:
    """Convertit ObjectId → str pour la sérialisation JSON."""
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, list):
            out[k] = [_serialize(i) if isinstance(i, dict) else i for i in v]
        elif isinstance(v, dict):
            out[k] = _serialize(v)
        else:
            out[k] = v
    return out


class WrapperS2:

    # ════════════════════════════════════════════════════════
    #  AUTEUR  (contributeurs[] avec role='auteur')
    # ════════════════════════════════════════════════════════
    async def get_auteurs(self) -> list[dict]:
        db = get_s2_db()
        pipeline = [
            {"$unwind": "$contributeurs"},
            {"$match": {"contributeurs.role": "auteur"}},
            {"$project": {
                "isbn_ref": 1,
                "nom": "$contributeurs.nom",
                "prenom": "$contributeurs.prenom",
            }}
        ]
        docs = await db.ouvrages.aggregate(pipeline).to_list(None)
        return [{
            "auteur_id": str(d["_id"]),
            "nom": d.get("nom"),
            "prenom": d.get("prenom"),
            "_source": "S2"
        } for d in docs]

    async def add_auteur_to_ouvrage(self, isbn: str, data: dict) -> dict:
        """Ajoute un contributeur auteur dans l'ouvrage correspondant."""
        db = get_s2_db()
        contrib = {"nom": data["nom"], "prenom": data["prenom"], "role": "auteur"}
        await db.ouvrages.update_one(
            {"isbn_ref": isbn},
            {"$push": {"contributeurs": contrib}}
        )
        return {**contrib, "_source": "S2"}

    async def update_auteur_in_ouvrage(self, isbn: str, old_nom: str, data: dict) -> dict:
        db = get_s2_db()
        await db.ouvrages.update_one(
            {"isbn_ref": isbn, "contributeurs.nom": old_nom},
            {"$set": {
                "contributeurs.$.nom": data.get("nom", old_nom),
                "contributeurs.$.prenom": data.get("prenom"),
            }}
        )
        return {**data, "_source": "S2"}

    async def delete_auteur_from_ouvrage(self, isbn: str, nom: str) -> bool:
        db = get_s2_db()
        result = await db.ouvrages.update_one(
            {"isbn_ref": isbn},
            {"$pull": {"contributeurs": {"nom": nom, "role": "auteur"}}}
        )
        return result.modified_count > 0

    # ════════════════════════════════════════════════════════
    #  THEME  (attribut sujet dans ouvrages)
    # ════════════════════════════════════════════════════════
    async def get_themes(self) -> list[dict]:
        db = get_s2_db()
        pipeline = [
            {"$match": {"sujet": {"$ne": None}}},
            {"$group": {"_id": "$sujet"}},
            {"$project": {"nom_theme": "$_id", "_id": 0}}
        ]
        docs = await db.ouvrages.aggregate(pipeline).to_list(None)
        return [{**d, "theme_id": None, "_source": "S2"} for d in docs]

    async def get_appartient_theme(self) -> list[dict]:
        db = get_s2_db()
        pipeline = [
            {"$match": {"sujet": {"$ne": None, "$ne": ""}}},
            {"$project": {"livre_ref": "$isbn_ref", "nom_theme": {"$toLower": {"$trim": {"input": "$sujet"}}}, "_id": 0}}
        ]
        docs = await db.ouvrages.aggregate(pipeline).to_list(None)
        return [{"livre_ref": d["livre_ref"], "theme_ref": d["nom_theme"], "nom_theme": d["nom_theme"], "_source": "S2"} for d in docs]

    async def update_theme_in_ouvrages(self, old_theme: str, new_theme: str) -> dict:
        """Renomme le sujet dans tous les ouvrages qui l'utilisent."""
        db = get_s2_db()
        result = await db.ouvrages.update_many(
            {"sujet": old_theme},
            {"$set": {"sujet": new_theme}}
        )
        return {"modified": result.modified_count, "_source": "S2"}

    async def get_personnes(self) -> list[dict]:
        adherents = await self.get_adherents()
        enseignants = await self.get_enseignants()
        return adherents + enseignants

    # ════════════════════════════════════════════════════════
    #  LIVRE  (collection ouvrages)
    # ════════════════════════════════════════════════════════
    async def get_livres(self) -> list[dict]:
        db = get_s2_db()
        docs = await db.ouvrages.find({}).to_list(None)
        result = []
        for d in docs:
            auteur = next((c for c in d.get("contributeurs", []) if c.get("role") == "auteur"), {})
            result.append({
                "isbn": d.get("isbn_ref"),
                "titre": d.get("titre_long"),
                "nb_pages": _safe_int(d.get("nbPage")),
                "editeur": d.get("editeur"),
                "theme": d.get("sujet"),
                "auteur_nom": auteur.get("nom"),
                "auteur_prenom": auteur.get("prenom"),
                "_id": str(d["_id"]),
                "_source": "S2"
            })
        return result

    async def get_livre(self, isbn: str) -> Optional[dict]:
        db = get_s2_db()
        d = await db.ouvrages.find_one({"isbn_ref": isbn})
        if not d:
            return None
        auteur = next((c for c in d.get("contributeurs", []) if c.get("role") == "auteur"), {})
        return {
            "isbn": d.get("isbn_ref"),
            "titre": d.get("titre_long"),
            "nb_pages": _safe_int(d.get("nbPage")),
            "editeur": d.get("editeur"),
            "theme": d.get("sujet"),
            "auteur_nom": auteur.get("nom"),
            "auteur_prenom": auteur.get("prenom"),
            "_id": str(d["_id"]),
            "_source": "S2"
        }

    async def create_livre(self, data: dict) -> dict:
        db = get_s2_db()
        doc = {
            "isbn_ref": data["isbn"],
            "titre_long": data["titre"],
            "nbPage": str(data.get("nb_pages", "")),
            "editeur": data.get("editeur"),
            "sujet": data.get("theme"),
            "contributeurs": [],
            "stocks": []
        }
        result = await db.ouvrages.insert_one(doc)
        return {**data, "_id": str(result.inserted_id), "_source": "S2"}

    async def update_livre(self, isbn: str, data: dict) -> dict:
        db = get_s2_db()
        mapping = {
            "titre": "titre_long",
            "nb_pages": "nbPage",
            "editeur": "editeur",
            "theme": "sujet",
        }
        set_fields = {}
        for k, v in data.items():
            if v is not None and k in mapping:
                mongo_key = mapping[k]
                set_fields[mongo_key] = str(v) if k == "nb_pages" else v

        if set_fields:
            await db.ouvrages.update_one({"isbn_ref": isbn}, {"$set": set_fields})
        return await self.get_livre(isbn)

    async def delete_livre(self, isbn: str) -> bool:
        db = get_s2_db()
        result = await db.ouvrages.delete_one({"isbn_ref": isbn})
        return result.deleted_count > 0

    # ════════════════════════════════════════════════════════
    #  EXEMPLAIRE  (stocks[] imbriqué dans ouvrages)
    # ════════════════════════════════════════════════════════
    async def get_exemplaires(self) -> list[dict]:
        db = get_s2_db()
        pipeline = [
            {"$unwind": "$stocks"},
            {"$project": {
                "isbn_ref": 1,
                "code_barre": "$stocks.code_barre",
                "etat": "$stocks.etat",
                "disponibilite": "$stocks.disponible",
            }}
        ]
        docs = await db.ouvrages.aggregate(pipeline).to_list(None)
        return [{
            "exemplaire_id": None,
            "livre_ref": d.get("isbn_ref"),
            "code_barre": d.get("code_barre"),
            "etat": d.get("etat"),
            "disponibilite": _norm_bool(d.get("disponibilite")),
            "_source": "S2"
        } for d in docs]

    async def create_exemplaire(self, isbn: str, data: dict) -> dict:
        """Ajoute un stock dans l'ouvrage correspondant."""
        db = get_s2_db()
        stock = {
            "code_barre": data["code_barre"],
            "etat": data.get("etat", "bon"),
            "disponible": "oui" if data.get("disponibilite", True) else "non",
            "localisation": data.get("localisation", "")
        }
        await db.ouvrages.update_one(
            {"isbn_ref": isbn},
            {"$push": {"stocks": stock}}
        )
        return {**stock, "livre_ref": isbn, "_source": "S2"}

    async def update_exemplaire(self, isbn: str, code_barre: str, data: dict) -> dict:
        db = get_s2_db()
        update = {}
        if "etat" in data and data["etat"] is not None:
            update["stocks.$.etat"] = data["etat"]
        if "disponibilite" in data and data["disponibilite"] is not None:
            update["stocks.$.disponible"] = "oui" if data["disponibilite"] else "non"
        if update:
            await db.ouvrages.update_one(
                {"isbn_ref": isbn, "stocks.code_barre": code_barre},
                {"$set": update}
            )
        return {"code_barre": code_barre, **data, "_source": "S2"}

    async def delete_exemplaire(self, isbn: str, code_barre: str) -> bool:
        db = get_s2_db()
        result = await db.ouvrages.update_one(
            {"isbn_ref": isbn},
            {"$pull": {"stocks": {"code_barre": code_barre}}}
        )
        return result.modified_count > 0

    # ════════════════════════════════════════════════════════
    #  ADHERENT  (collection adherant, type=Etudiant)
    # ════════════════════════════════════════════════════════
    async def get_adherents(self) -> list[dict]:
        db = get_s2_db()
        docs = await db.adherant.find({"type": "Etudiant"}).to_list(None)
        return [{
            "adherent_id": str(d["_id"]),
            "nom": d.get("identite", {}).get("nom"),
            "prenom": d.get("identite", {}).get("prenom"),
            "email": d.get("identite", {}).get("email"),
            "cursus": d.get("cursus", {}).get("niveau"),
            "niveau": d.get("cursus", {}).get("niveau"),
            "annee": d.get("cursus", {}).get("annee"),
            "type": "Adherent",
            "_source": "S2"
        } for d in docs]

    async def get_adherent(self, id_str: str) -> Optional[dict]:
        db = get_s2_db()
        d = await db.adherant.find_one({"_id": _oid(id_str), "type": "Etudiant"})
        if not d:
            return None
        return {
            "adherent_id": str(d["_id"]),
            "nom": d.get("identite", {}).get("nom"),
            "prenom": d.get("identite", {}).get("prenom"),
            "email": d.get("identite", {}).get("email"),
            "cursus": d.get("cursus", {}).get("niveau"),
            "annee": d.get("cursus", {}).get("annee"),
            "type": "Adherent",
            "_source": "S2"
        }

    async def create_adherent(self, data: dict) -> dict:
        db = get_s2_db()
        doc = {
            "type": "Etudiant",
            "identite": {"nom": data["nom"], "prenom": data["prenom"], "email": data.get("email")},
            "cursus": {"niveau": data.get("niveau"), "annee": data.get("annee")},
            "suggestions": []
        }
        result = await db.adherant.insert_one(doc)
        return {**data, "adherent_id": str(result.inserted_id), "type": "Adherent", "_source": "S2"}

    async def update_adherent(self, id_str: str, data: dict) -> dict:
        db = get_s2_db()
        update = {}
        if data.get("nom"):     update["identite.nom"]    = data["nom"]
        if data.get("prenom"):  update["identite.prenom"] = data["prenom"]
        if data.get("email"):   update["identite.email"]  = data["email"]
        if data.get("niveau"):  update["cursus.niveau"]   = data["niveau"]
        if data.get("annee"):   update["cursus.annee"]    = data["annee"]
        if update:
            await db.adherant.update_one({"_id": _oid(id_str)}, {"$set": update})
        return await self.get_adherent(id_str)

    async def delete_adherent(self, id_str: str) -> bool:
        db = get_s2_db()
        result = await db.adherant.delete_one({"_id": _oid(id_str)})
        return result.deleted_count > 0

    # ════════════════════════════════════════════════════════
    #  ENSEIGNANT  (collection adherant, type=Professeur)
    # ════════════════════════════════════════════════════════
    async def get_enseignants(self) -> list[dict]:
        db = get_s2_db()
        docs = await db.adherant.find({"type": "Professeur"}).to_list(None)
        return [{
            "enseignant_id": str(d["_id"]),
            "nom": d.get("identite", {}).get("nom"),
            "prenom": d.get("identite", {}).get("prenom"),
            "email": d.get("identite", {}).get("email"),
            "departement": d.get("departement"),
            "type": "Enseignant",
            "_source": "S2"
        } for d in docs]

    async def get_enseignant(self, id_str: str) -> Optional[dict]:
        db = get_s2_db()
        d = await db.adherant.find_one({"_id": _oid(id_str), "type": "Professeur"})
        if not d:
            return None
        return {
            "enseignant_id": str(d["_id"]),
            "nom": d.get("identite", {}).get("nom"),
            "prenom": d.get("identite", {}).get("prenom"),
            "email": d.get("identite", {}).get("email"),
            "departement": d.get("departement"),
            "type": "Enseignant",
            "_source": "S2"
        }

    async def create_enseignant(self, data: dict) -> dict:
        db = get_s2_db()
        doc = {
            "type": "Professeur",
            "identite": {"nom": data["nom"], "prenom": data["prenom"], "email": data.get("email")},
            "departement": data.get("departement"),
            "suggestions": []
        }
        result = await db.adherant.insert_one(doc)
        return {**data, "enseignant_id": str(result.inserted_id), "type": "Enseignant", "_source": "S2"}

    async def update_enseignant(self, id_str: str, data: dict) -> dict:
        db = get_s2_db()
        update = {}
        if data.get("nom"):         update["identite.nom"]    = data["nom"]
        if data.get("prenom"):      update["identite.prenom"] = data["prenom"]
        if data.get("email"):       update["identite.email"]  = data["email"]
        if data.get("departement"): update["departement"]     = data["departement"]
        if update:
            await db.adherant.update_one({"_id": _oid(id_str)}, {"$set": update})
        return await self.get_enseignant(id_str)

    async def delete_enseignant(self, id_str: str) -> bool:
        db = get_s2_db()
        result = await db.adherant.delete_one({"_id": _oid(id_str)})
        return result.deleted_count > 0

    # ════════════════════════════════════════════════════════
    #  SUGGESTION  (suggestions[] imbriqué dans adherant Professeur)
    # EMPRUNT absent de S2
    # ════════════════════════════════════════════════════════

    async def get_emprunts(self) -> list[dict]:
        """S2 ne stocke pas les emprunts — retourne une liste vide."""
        return []

    async def get_suggestions(self) -> list[dict]:
        db = get_s2_db()
        pipeline = [
            {"$match": {"type": "Professeur"}},
            {"$unwind": "$suggestions"},
            {"$project": {
                "enseignant_id": {"$toString": "$_id"},
                "nom": "$identite.nom",
                "titre_suggere": "$suggestions.titre",
                "raison": "$suggestions.raison",
                "date_suggestion": "$suggestions.date_sugg",
            }}
        ]
        docs = await db.adherant.aggregate(pipeline).to_list(None)
        return [{
            "suggestion_id": None,
            "enseignant_id": d.get("enseignant_id"),
            "nom_enseignant": d.get("nom"),
            "livre_id": None,          # S2 n'a pas de référence directe au livre
            "titre_suggere": d.get("titre_suggere"),
            "raison": d.get("raison"),
            "date_suggestion": d.get("date_suggestion"),
            "_source": "S2"
        } for d in docs]

    async def create_suggestion(self, enseignant_id: str, data: dict) -> dict:
        """Ajoute une suggestion dans le tableau suggestions[] du professeur."""
        db = get_s2_db()
        suggestion = {
            "titre": data.get("titre_suggere", ""),
            "raison": data.get("raison"),
            "date_sugg": data.get("date_suggestion")
        }
        await db.adherant.update_one(
            {"_id": _oid(enseignant_id), "type": "Professeur"},
            {"$push": {"suggestions": suggestion}}
        )
        return {**suggestion, "enseignant_id": enseignant_id, "_source": "S2"}

    async def delete_suggestion(self, enseignant_id: str, titre: str) -> bool:
        db = get_s2_db()
        result = await db.adherant.update_one(
            {"_id": _oid(enseignant_id)},
            {"$pull": {"suggestions": {"titre": titre}}}
        )
        return result.modified_count > 0
