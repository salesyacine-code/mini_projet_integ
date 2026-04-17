"""
services/mediator.py

Le médiateur a deux rôles (GAV) :

1. LECTURE (GET) :
   - Envoie la requête aux sources concernées en parallèle (asyncio.gather)
   - Fusionne + déduplique les résultats par clé naturelle (isbn, email, code_barre…)
   -> Ceci applique l'étape 4 (Fusion et Restructuration) du processus d'intégration.

2. ÉCRITURE (POST / PUT / DELETE) :
   - Reçoit la source cible choisie par le frontend (S1, S2, S3)
   - Délègue l'opération au wrapper correspondant
   - Retourne une CRUDResponse standardisée
   -> Les wrappers appliquent l'étape 3 (Mise en conformité) en sens inverse.

Rappel du Processus d'Intégration implémenté :
 1. Pré-intégration
 2. Comparaison des schémas
 3. Mise en conformité des schémas
 4. Fusion et Restructuration
"""

import asyncio
from typing import Literal
from wrappers.wrapper_s1 import WrapperS1
from wrappers.wrapper_s2 import WrapperS2
from wrappers.wrapper_s3 import WrapperS3


Source = Literal["S1", "S2", "S3"]

# Quelles sources participent à la lecture de chaque entité
ENTITY_SOURCES: dict[str, list[Source]] = {
    "AUTEUR":      ["S1", "S2", "S3"],
    "THEME":       ["S1", "S2", "S3"],
    "APPARTIENT_THEME": ["S1", "S2", "S3"],
    "LIVRE":       ["S1", "S2", "S3"],
    "EXEMPLAIRE":  ["S1", "S2", "S3"],
    "ADHERENT":    ["S1", "S2", "S3"],
    "ENSEIGNANT":  ["S1", "S2", "S3"],
    "EMPRUNT":     ["S1", "S3"],       # absent de S2
    "SUGGESTION":  ["S1", "S2", "S3"],
}

# Clé de déduplication par entité
DEDUP_KEY: dict[str, str] = {
    "AUTEUR":      "nom",
    "THEME":       "nom_theme",
    "LIVRE":       "isbn",
    "EXEMPLAIRE":  "code_barre",
    "ADHERENT":    "email",
    "ENSEIGNANT":  "email",
    "EMPRUNT":     "emprunt_id",
    "SUGGESTION":  "suggestion_id",
}


class Mediator:

    def __init__(self):
        self.s1 = WrapperS1()
        self.s2 = WrapperS2()
        self.s3 = WrapperS3()
        self._wrappers: dict[Source, object] = {"S1": self.s1, "S2": self.s2, "S3": self.s3}

    # ════════════════════════════════════════════════════════
    #  HELPERS PRIVÉS
    # ════════════════════════════════════════════════════════
    def _wrapper(self, source: Source):
        return self._wrappers[source]

    def _merge(self, entity: str, batches: list) -> list[dict]:
        """
        Fusionne les résultats de plusieurs sources.
        Déduplique par la clé naturelle de l'entité.
        Les sources indisponibles (Exception) sont ignorées silencieusement.
        """
        key = DEDUP_KEY.get(entity)
        seen = set()
        merged = []
        for batch in batches:
            if isinstance(batch, Exception):
                continue  # source indisponible → on skip
            for item in (batch or []):
                val = item.get(key) if key else None
                if val is not None and val in seen:
                    continue
                if val is not None:
                    seen.add(val)
                merged.append(item)
        return merged

    def _ok(self, source: str, data: dict, msg: str = "OK") -> dict:
        return {"success": True, "source": source, "message": msg, "data": data}

    def _err(self, source: str, msg: str) -> dict:
        return {"success": False, "source": source, "message": msg, "data": None}

    # ════════════════════════════════════════════════════════
    #  AUTEUR
    # ════════════════════════════════════════════════════════
    async def get_auteurs(self) -> list[dict]:
        tasks = [self.s1.get_auteurs(), self.s2.get_auteurs(), self.s3.get_auteurs()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._merge("AUTEUR", results)

    async def create_auteur(self, source: Source, data: dict) -> dict:
        try:
            result = await self._wrapper(source).create_auteur(data)
            return self._ok(source, result, "Auteur créé")
        except Exception as e:
            return self._err(source, str(e))

    async def update_auteur(self, source: Source, entity_id: str, data: dict) -> dict:
        try:
            result = await self._wrapper(source).update_auteur(entity_id, data)
            return self._ok(source, result, "Auteur mis à jour")
        except Exception as e:
            return self._err(source, str(e))

    async def delete_auteur(self, source: Source, entity_id: str) -> dict:
        try:
            ok = await self._wrapper(source).delete_auteur(entity_id)
            return self._ok(source, {}, "Auteur supprimé") if ok else self._err(source, "Non trouvé")
        except Exception as e:
            return self._err(source, str(e))

    # ════════════════════════════════════════════════════════
    #  THEME
    # ════════════════════════════════════════════════════════
    async def get_themes(self) -> list[dict]:
        tasks = [self.s1.get_themes(), self.s2.get_themes(), self.s3.get_themes()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._merge("THEME", results)

    async def create_theme(self, source: Source, data: dict) -> dict:
        try:
            result = await self._wrapper(source).create_theme(data)
            return self._ok(source, result, "Thème créé")
        except Exception as e:
            return self._err(source, str(e))

    async def update_theme(self, source: Source, entity_id: str, data: dict) -> dict:
        try:
            result = await self._wrapper(source).update_theme(entity_id, data)
            return self._ok(source, result, "Thème mis à jour")
        except Exception as e:
            return self._err(source, str(e))

    async def delete_theme(self, source: Source, entity_id: str) -> dict:
        try:
            ok = await self._wrapper(source).delete_theme(entity_id)
            return self._ok(source, {}, "Thème supprimé") if ok else self._err(source, "Non trouvé")
        except Exception as e:
            return self._err(source, str(e))

    # ════════════════════════════════════════════════════════
    #  APPARTIENT_THEME
    # ════════════════════════════════════════════════════════
    async def get_appartient_theme(self) -> list[dict]:
        tasks = [self.s1.get_appartient_theme(), self.s2.get_appartient_theme(), self.s3.get_appartient_theme()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        # Deduplication manuelle par tuple (livre_ref, theme_ref) car _merge ne gère qu'une clé
        seen = set()
        merged = []
        for batch in results:
            if isinstance(batch, Exception):
                continue
            for item in (batch or []):
                key = (item.get("livre_ref"), item.get("theme_ref"))
                if key not in seen:
                    seen.add(key)
                    merged.append(item)
        return merged

    # ════════════════════════════════════════════════════════
    #  LIVRE
    # ════════════════════════════════════════════════════════
    async def get_livres(self) -> list[dict]:
        tasks = [self.s1.get_livres(), self.s2.get_livres(), self.s3.get_livres()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._merge("LIVRE", results)

    async def create_livre(self, source: Source, data: dict) -> dict:
        try:
            result = await self._wrapper(source).create_livre(data)
            return self._ok(source, result, "Livre créé")
        except Exception as e:
            return self._err(source, str(e))

    async def update_livre(self, source: Source, entity_id: str, data: dict) -> dict:
        try:
            result = await self._wrapper(source).update_livre(entity_id, data)
            return self._ok(source, result, "Livre mis à jour")
        except Exception as e:
            return self._err(source, str(e))

    async def delete_livre(self, source: Source, entity_id: str) -> dict:
        try:
            ok = await self._wrapper(source).delete_livre(entity_id)
            return self._ok(source, {}, "Livre supprimé") if ok else self._err(source, "Non trouvé")
        except Exception as e:
            return self._err(source, str(e))

    # ════════════════════════════════════════════════════════
    #  EXEMPLAIRE
    # ════════════════════════════════════════════════════════
    async def get_exemplaires(self) -> list[dict]:
        tasks = [self.s1.get_exemplaires(), self.s2.get_exemplaires(), self.s3.get_exemplaires()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._merge("EXEMPLAIRE", results)

    async def create_exemplaire(self, source: Source, data: dict) -> dict:
        try:
            # S2 et S3 nécessitent l'ISBN comme clé parente
            if source == "S2":
                result = await self.s2.create_exemplaire(data["isbn"], data)
            elif source == "S3":
                result = await self.s3.create_exemplaire(data["isbn"], data)
            else:
                result = await self.s1.create_exemplaire(data)
            return self._ok(source, result, "Exemplaire créé")
        except Exception as e:
            return self._err(source, str(e))

    async def update_exemplaire(self, source: Source, entity_id: str, data: dict) -> dict:
        try:
            result = await self._wrapper(source).update_exemplaire(entity_id, data)
            return self._ok(source, result, "Exemplaire mis à jour")
        except Exception as e:
            return self._err(source, str(e))

    async def delete_exemplaire(self, source: Source, entity_id: str, isbn: str = None) -> dict:
        try:
            if source == "S2":
                ok = await self.s2.delete_exemplaire(isbn, entity_id)  # (isbn, code_barre)
            elif source == "S3":
                ok = await self.s3.delete_exemplaire(entity_id)        # copy_id
            else:
                ok = await self.s1.delete_exemplaire(int(entity_id))
            return self._ok(source, {}, "Exemplaire supprimé") if ok else self._err(source, "Non trouvé")
        except Exception as e:
            return self._err(source, str(e))

    # ════════════════════════════════════════════════════════
    #  PERSONNES (union adhérents + enseignants)
    # ════════════════════════════════════════════════════════
    async def get_personnes(self) -> list[dict]:
        """Vue unifiée PERSONNE = ADHERENT ∪ ENSEIGNANT des 3 sources."""
        adh_tasks = [self.s1.get_adherents(), self.s2.get_adherents(), self.s3.get_adherents()]
        ens_tasks = [self.s1.get_enseignants(), self.s2.get_enseignants(), self.s3.get_enseignants()]
        all_results = await asyncio.gather(
            *adh_tasks, *ens_tasks, return_exceptions=True
        )
        adh_results = list(all_results[:3])
        ens_results = list(all_results[3:])
        adherents   = self._merge("ADHERENT",   adh_results)
        enseignants = self._merge("ENSEIGNANT", ens_results)
        # Marque le type et fusionne par email
        for p in adherents:
            p.setdefault("type", "adherent")
        for p in enseignants:
            p.setdefault("type", "enseignant")
        seen, merged = set(), []
        for p in adherents + enseignants:
            key = p.get("email") or p.get("personne_id")
            if key and key in seen:
                continue
            if key:
                seen.add(key)
            merged.append(p)
        return merged

    # ════════════════════════════════════════════════════════
    #  ADHERENT
    # ════════════════════════════════════════════════════════
    async def get_adherents(self) -> list[dict]:
        tasks = [self.s1.get_adherents(), self.s2.get_adherents(), self.s3.get_adherents()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._merge("ADHERENT", results)

    async def create_adherent(self, source: Source, data: dict) -> dict:
        try:
            result = await self._wrapper(source).create_adherent(data)
            return self._ok(source, result, "Adhérent créé")
        except Exception as e:
            return self._err(source, str(e))

    async def update_adherent(self, source: Source, entity_id: str, data: dict) -> dict:
        try:
            result = await self._wrapper(source).update_adherent(entity_id, data)
            return self._ok(source, result, "Adhérent mis à jour")
        except Exception as e:
            return self._err(source, str(e))

    async def delete_adherent(self, source: Source, entity_id: str) -> dict:
        try:
            ok = await self._wrapper(source).delete_adherent(entity_id)
            return self._ok(source, {}, "Adhérent supprimé") if ok else self._err(source, "Non trouvé")
        except Exception as e:
            return self._err(source, str(e))

    # ════════════════════════════════════════════════════════
    #  ENSEIGNANT
    # ════════════════════════════════════════════════════════
    async def get_enseignants(self) -> list[dict]:
        tasks = [self.s1.get_enseignants(), self.s2.get_enseignants(), self.s3.get_enseignants()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._merge("ENSEIGNANT", results)

    async def create_enseignant(self, source: Source, data: dict) -> dict:
        try:
            result = await self._wrapper(source).create_enseignant(data)
            return self._ok(source, result, "Enseignant créé")
        except Exception as e:
            return self._err(source, str(e))

    async def update_enseignant(self, source: Source, entity_id: str, data: dict) -> dict:
        try:
            result = await self._wrapper(source).update_enseignant(entity_id, data)
            return self._ok(source, result, "Enseignant mis à jour")
        except Exception as e:
            return self._err(source, str(e))

    async def delete_enseignant(self, source: Source, entity_id: str) -> dict:
        try:
            ok = await self._wrapper(source).delete_enseignant(entity_id)
            return self._ok(source, {}, "Enseignant supprimé") if ok else self._err(source, "Non trouvé")
        except Exception as e:
            return self._err(source, str(e))

    # ════════════════════════════════════════════════════════
    #  EMPRUNT  (S1 + S3 uniquement)
    # ════════════════════════════════════════════════════════
    async def get_emprunts(self) -> list[dict]:
        tasks = [self.s1.get_emprunts(), self.s3.get_emprunts()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._merge("EMPRUNT", results)

    async def create_emprunt(self, source: Source, data: dict) -> dict:
        if source == "S2":
            return self._err("S2", "Les emprunts ne sont pas gérés par S2")
        try:
            result = await self._wrapper(source).create_emprunt(data)
            return self._ok(source, result, "Emprunt créé")
        except Exception as e:
            return self._err(source, str(e))

    async def update_emprunt(self, source: Source, entity_id: str, data: dict) -> dict:
        if source == "S2":
            return self._err("S2", "Les emprunts ne sont pas gérés par S2")
        try:
            if source == "S3":
                result = await self.s3.update_emprunt(
                    data.get("adherent_id"), data.get("exemplaire_id"), data
                )
            else:
                result = await self.s1.update_emprunt(int(entity_id), data)
            return self._ok(source, result, "Emprunt mis à jour")
        except Exception as e:
            return self._err(source, str(e))

    async def delete_emprunt(self, source: Source, entity_id: str, data: dict = None) -> dict:
        if source == "S2":
            return self._err("S2", "Les emprunts ne sont pas gérés par S2")
        try:
            if source == "S3":
                ok = await self.s3.delete_emprunt(
                    (data or {}).get("adherent_id"), (data or {}).get("exemplaire_id")
                )
            else:
                ok = await self.s1.delete_emprunt(int(entity_id))
            return self._ok(source, {}, "Emprunt supprimé") if ok else self._err(source, "Non trouvé")
        except Exception as e:
            return self._err(source, str(e))

    # ════════════════════════════════════════════════════════
    #  SUGGESTION
    # ════════════════════════════════════════════════════════
    async def get_suggestions(self) -> list[dict]:
        tasks = [self.s1.get_suggestions(), self.s2.get_suggestions(), self.s3.get_suggestions()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._merge("SUGGESTION", results)

    async def create_suggestion(self, source: Source, data: dict) -> dict:
        try:
            if source == "S2":
                result = await self.s2.create_suggestion(data["enseignant_id"], data)
            else:
                result = await self._wrapper(source).create_suggestion(data)
            return self._ok(source, result, "Suggestion créée")
        except Exception as e:
            return self._err(source, str(e))

    async def update_suggestion(self, source: Source, entity_id: str, data: dict) -> dict:
        if source in ("S2", "S3"):
            return self._err(source, "Mise à jour non supportée pour cette source — utilisez delete + create")
        try:
            result = await self.s1.update_suggestion(int(entity_id), data)
            return self._ok(source, result, "Suggestion mise à jour")
        except Exception as e:
            return self._err(source, str(e))

    async def delete_suggestion(self, source: Source, entity_id: str, data: dict = None) -> dict:
        try:
            if source == "S2":
                ok = await self.s2.delete_suggestion(
                    (data or {}).get("enseignant_id"), (data or {}).get("titre")
                )
            elif source == "S3":
                ok = await self.s3.delete_suggestion(
                    (data or {}).get("enseignant_id"), (data or {}).get("livre_id")
                )
            else:
                ok = await self.s1.delete_suggestion(int(entity_id))
            return self._ok(source, {}, "Suggestion supprimée") if ok else self._err(source, "Non trouvé")
        except Exception as e:
            return self._err(source, str(e))
