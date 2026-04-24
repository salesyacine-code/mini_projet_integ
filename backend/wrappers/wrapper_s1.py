"""
wrappers/wrapper_s1.py
Wrapper pour S1 — MySQL/PostgreSQL
Traduit chaque opération CRUD globale en SQL pour la base relationnelle.
"""

from database import get_s1_pool
from typing import Optional


class WrapperS1:
    """
    Toutes les méthodes retournent des dicts normalisés (modèle pivot).
    Les clés correspondent au schéma global intégré.
    """

    # ════════════════════════════════════════════════════════
    #  Helpers internes
    # ════════════════════════════════════════════════════════
    async def _fetch_all(self, sql: str, params: tuple = ()) -> list[dict]:
        pool = await get_s1_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql, params)
                rows = await cur.fetchall()
                return [dict(r) for r in rows]

    async def _fetch_one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        pool = await get_s1_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql, params)
                row = await cur.fetchone()
                return dict(row) if row else None

    async def _execute(self, sql: str, params: tuple = ()) -> int:
        """Retourne le lastrowid pour les INSERT, ou rowcount pour UPDATE/DELETE."""
        pool = await get_s1_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(sql, params)
                return cur.lastrowid or cur.rowcount

    # ════════════════════════════════════════════════════════
    #  Generic Local CRUD
    # ════════════════════════════════════════════════════════
    async def local_read(self, table: str) -> list[dict]:
        return await self._fetch_all(f"SELECT * FROM {table}")

    async def local_insert(self, table: str, data: dict) -> dict:
        keys = list(data.keys())
        values = tuple(data[k] for k in keys)
        placeholders = ",".join(["%s"] * len(keys))
        cols = ",".join(keys)
        sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
        lid = await self._execute(sql, values)
        return {**data, "inserted_id": lid}

    async def local_update(self, table: str, id_col: str, id_val: any, data: dict) -> dict:
        keys = list(data.keys())
        if not keys: return {}
        values = tuple(data[k] for k in keys) + (id_val,)
        set_clause = ", ".join(f"{k}=%s" for k in keys)
        sql = f"UPDATE {table} SET {set_clause} WHERE {id_col}=%s"
        await self._execute(sql, values)
        return data

    async def local_delete(self, table: str, id_col: str, id_val: any) -> bool:
        sql = f"DELETE FROM {table} WHERE {id_col}=%s"
        n = await self._execute(sql, (id_val,))
        return n > 0

    # ════════════════════════════════════════════════════════
    #  AUTEUR
    # ════════════════════════════════════════════════════════
    async def get_auteurs(self) -> list[dict]:
        rows = await self._fetch_all("SELECT * FROM AUTEUR")
        return [{**r, "_source": "S1"} for r in rows]

    async def get_auteur(self, auteur_id: int) -> Optional[dict]:
        row = await self._fetch_one("SELECT * FROM AUTEUR WHERE auteur_id=%s", (auteur_id,))
        return {**row, "_source": "S1"} if row else None

    async def create_auteur(self, data: dict) -> dict:
        lid = await self._execute(
            "INSERT INTO AUTEUR (nom, prenom, nationalite, date_naissance) VALUES (%s,%s,%s,%s)",
            (data["nom"], data["prenom"], data.get("nationalite"), data.get("date_naissance"))
        )
        return {**data, "auteur_id": lid, "_source": "S1"}

    async def update_auteur(self, auteur_id: int, data: dict) -> dict:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return {}
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        await self._execute(
            f"UPDATE AUTEUR SET {set_clause} WHERE auteur_id=%s",
            (*fields.values(), auteur_id)
        )
        return await self.get_auteur(auteur_id)

    async def delete_auteur(self, auteur_id: int) -> bool:
        n = await self._execute("DELETE FROM AUTEUR WHERE auteur_id=%s", (auteur_id,))
        return n > 0

    # ════════════════════════════════════════════════════════
    #  THEME
    # ════════════════════════════════════════════════════════
    async def get_themes(self) -> list[dict]:
        # Dans S1, le thème est un attribut categorie dans LIVRE
        rows = await self._fetch_all(
            "SELECT DISTINCT categorie AS nom_theme FROM LIVRE WHERE categorie IS NOT NULL"
        )
        return [{**r, "theme_id": None, "_source": "S1"} for r in rows]

    async def get_appartient_theme(self) -> list[dict]:
        rows = await self._fetch_all(
            "SELECT CAST(livre_id AS CHAR) AS livre_ref, LOWER(TRIM(categorie)) AS nom_theme FROM LIVRE WHERE categorie IS NOT NULL AND TRIM(categorie) != ''"
        )
        return [{"livre_ref": r["livre_ref"], "theme_ref": r["nom_theme"], "nom_theme": r["nom_theme"], "_source": "S1"} for r in rows]

    async def create_theme(self, data: dict) -> dict:
        # S1 n'a pas de table THEME autonome → on l'applique comme categorie
        # Ici on retourne simplement la donnée, la vraie création se fait via LIVRE
        return {"nom_theme": data["nom_theme"], "theme_id": None, "_source": "S1",
                "_note": "Dans S1, le thème est l'attribut categorie de LIVRE."}

    # ════════════════════════════════════════════════════════
    #  LIVRE
    # ════════════════════════════════════════════════════════
    async def get_livres(self) -> list[dict]:
        rows = await self._fetch_all("""
            SELECT l.*, a.nom AS auteur_nom, a.prenom AS auteur_prenom,
                   l.categorie AS theme
            FROM LIVRE l
            LEFT JOIN AUTEUR a ON l.auteur_id = a.auteur_id
        """)
        return [{**r, "_source": "S1"} for r in rows]

    async def get_livre(self, livre_id: int) -> Optional[dict]:
        row = await self._fetch_one("""
            SELECT l.*, a.nom AS auteur_nom, a.prenom AS auteur_prenom,
                   l.categorie AS theme
            FROM LIVRE l
            LEFT JOIN AUTEUR a ON l.auteur_id = a.auteur_id
            WHERE l.livre_id=%s
        """, (livre_id,))
        return {**row, "_source": "S1"} if row else None

    async def create_livre(self, data: dict) -> dict:
        lid = await self._execute(
            """INSERT INTO LIVRE (isbn, titre, annee_publication, auteur_id, categorie)
               VALUES (%s,%s,%s,%s,%s)""",
            (data["isbn"], data["titre"], data.get("annee_publication"),
             data.get("auteur_id"), data.get("theme"))
        )
        return {**data, "livre_id": lid, "_source": "S1"}

    async def update_livre(self, livre_id: int, data: dict) -> dict:
        mapping = {
            "titre": "titre", "annee_publication": "annee_publication",
            "auteur_id": "auteur_id", "theme": "categorie",
        }
        fields = {mapping[k]: v for k, v in data.items() if v is not None and k in mapping}
        if not fields:
            return {}
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        await self._execute(
            f"UPDATE LIVRE SET {set_clause} WHERE livre_id=%s",
            (*fields.values(), livre_id)
        )
        return await self.get_livre(livre_id)

    async def delete_livre(self, livre_id: int) -> bool:
        n = await self._execute("DELETE FROM LIVRE WHERE livre_id=%s", (livre_id,))
        return n > 0

    # ════════════════════════════════════════════════════════
    #  EXEMPLAIRE
    # ════════════════════════════════════════════════════════
    async def get_exemplaires(self) -> list[dict]:
        rows = await self._fetch_all("SELECT * FROM EXEMPLAIRE")
        return [{**r, "_source": "S1"} for r in rows]

    async def get_exemplaire(self, exemplaire_id: int) -> Optional[dict]:
        row = await self._fetch_one("SELECT * FROM EXEMPLAIRE WHERE exemplaire_id=%s", (exemplaire_id,))
        return {**row, "_source": "S1"} if row else None

    async def create_exemplaire(self, data: dict) -> dict:
        lid = await self._execute(
            "INSERT INTO EXEMPLAIRE (livre_id, code_barre, etat, disponibilite) VALUES (%s,%s,%s,%s)",
            (data["livre_id"], data["code_barre"], data.get("etat", "bon"), data.get("disponibilite", True))
        )
        return {**data, "exemplaire_id": lid, "_source": "S1"}

    async def update_exemplaire(self, exemplaire_id: int, data: dict) -> dict:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return {}
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        await self._execute(
            f"UPDATE EXEMPLAIRE SET {set_clause} WHERE exemplaire_id=%s",
            (*fields.values(), exemplaire_id)
        )
        return await self.get_exemplaire(exemplaire_id)

    async def delete_exemplaire(self, exemplaire_id: int) -> bool:
        n = await self._execute("DELETE FROM EXEMPLAIRE WHERE exemplaire_id=%s", (exemplaire_id,))
        return n > 0

    async def get_personnes(self) -> list[dict]:
        adherents = await self.get_adherents()
        enseignants = await self.get_enseignants()
        return adherents + enseignants

    # ════════════════════════════════════════════════════════
    #  ADHERENT
    # ════════════════════════════════════════════════════════
    async def get_adherents(self) -> list[dict]:
        rows = await self._fetch_all("SELECT * FROM ADHERENT")
        return [{**r, "type": "Adherent", "_source": "S1"} for r in rows]

    async def get_adherent(self, adherent_id: int) -> Optional[dict]:
        row = await self._fetch_one("SELECT * FROM ADHERENT WHERE adherent_id=%s", (adherent_id,))
        return {**row, "type": "Adherent", "_source": "S1"} if row else None

    async def create_adherent(self, data: dict) -> dict:
        lid = await self._execute(
            """INSERT INTO ADHERENT (nom, prenom, email, telephone, date_inscription)
               VALUES (%s,%s,%s,%s,%s)""",
            (data["nom"], data["prenom"], data.get("email"),
             data.get("telephone"), data.get("date_inscription"))
        )
        return {**data, "adherent_id": lid, "type": "Adherent", "_source": "S1"}

    async def update_adherent(self, adherent_id: int, data: dict) -> dict:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return {}
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        await self._execute(
            f"UPDATE ADHERENT SET {set_clause} WHERE adherent_id=%s",
            (*fields.values(), adherent_id)
        )
        return await self.get_adherent(adherent_id)

    async def delete_adherent(self, adherent_id: int) -> bool:
        n = await self._execute("DELETE FROM ADHERENT WHERE adherent_id=%s", (adherent_id,))
        return n > 0

    # ════════════════════════════════════════════════════════
    #  ENSEIGNANT
    # ════════════════════════════════════════════════════════
    async def get_enseignants(self) -> list[dict]:
        rows = await self._fetch_all("SELECT * FROM ENSEIGNANT")
        return [{**r, "type": "Enseignant", "_source": "S1"} for r in rows]

    async def get_enseignant(self, enseignant_id: int) -> Optional[dict]:
        row = await self._fetch_one("SELECT * FROM ENSEIGNANT WHERE enseignant_id=%s", (enseignant_id,))
        return {**row, "type": "Enseignant", "_source": "S1"} if row else None

    async def create_enseignant(self, data: dict) -> dict:
        lid = await self._execute(
            "INSERT INTO ENSEIGNANT (nom, prenom, email, departement) VALUES (%s,%s,%s,%s)",
            (data["nom"], data["prenom"], data.get("email"), data.get("departement"))
        )
        return {**data, "enseignant_id": lid, "type": "Enseignant", "_source": "S1"}

    async def update_enseignant(self, enseignant_id: int, data: dict) -> dict:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return {}
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        await self._execute(
            f"UPDATE ENSEIGNANT SET {set_clause} WHERE enseignant_id=%s",
            (*fields.values(), enseignant_id)
        )
        return await self.get_enseignant(enseignant_id)

    async def delete_enseignant(self, enseignant_id: int) -> bool:
        n = await self._execute("DELETE FROM ENSEIGNANT WHERE enseignant_id=%s", (enseignant_id,))
        return n > 0

    # ════════════════════════════════════════════════════════
    #  EMPRUNT
    # ════════════════════════════════════════════════════════
    async def get_emprunts(self) -> list[dict]:
        rows = await self._fetch_all("""
            SELECT e.*, a.nom, a.prenom, ex.code_barre
            FROM EMPRUNT e
            JOIN ADHERENT a ON e.adherent_id = a.adherent_id
            JOIN EXEMPLAIRE ex ON e.exemplaire_id = ex.exemplaire_id
        """)
        return [{**r, "_source": "S1"} for r in rows]

    async def get_emprunt(self, emprunt_id: int) -> Optional[dict]:
        row = await self._fetch_one("SELECT * FROM EMPRUNT WHERE emprunt_id=%s", (emprunt_id,))
        return {**row, "_source": "S1"} if row else None

    async def create_emprunt(self, data: dict) -> dict:
        lid = await self._execute(
            """INSERT INTO EMPRUNT
               (exemplaire_id, adherent_id, date_emprunt, date_retour_prevue, statut)
               VALUES (%s,%s,%s,%s,%s)""",
            (data["exemplaire_id"], data["adherent_id"], data["date_emprunt"],
             data.get("date_retour_prevue"), data.get("statut", "en cours"))
        )
        return {**data, "emprunt_id": lid, "_source": "S1"}

    async def update_emprunt(self, emprunt_id: int, data: dict) -> dict:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return {}
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        await self._execute(
            f"UPDATE EMPRUNT SET {set_clause} WHERE emprunt_id=%s",
            (*fields.values(), emprunt_id)
        )
        return await self.get_emprunt(emprunt_id)

    async def delete_emprunt(self, emprunt_id: int) -> bool:
        n = await self._execute("DELETE FROM EMPRUNT WHERE emprunt_id=%s", (emprunt_id,))
        return n > 0

    # ════════════════════════════════════════════════════════
    #  SUGGESTION
    # ════════════════════════════════════════════════════════
    async def get_suggestions(self) -> list[dict]:
        rows = await self._fetch_all("""
            SELECT s.*, e.nom, e.prenom, l.titre AS livre_titre
            FROM SUGGESTION s
            JOIN ENSEIGNANT e ON s.enseignant_id = e.enseignant_id
            LEFT JOIN LIVRE l ON s.livre_id = l.livre_id
        """)
        return [{**r, "_source": "S1"} for r in rows]

    async def get_suggestion(self, suggestion_id: int) -> Optional[dict]:
        row = await self._fetch_one("SELECT * FROM SUGGESTION WHERE suggestion_id=%s", (suggestion_id,))
        return {**row, "_source": "S1"} if row else None

    async def create_suggestion(self, data: dict) -> dict:
        lid = await self._execute(
            """INSERT INTO SUGGESTION (enseignant_id, livre_id, date_suggestion, raison)
               VALUES (%s,%s,%s,%s)""",
            (data["enseignant_id"], data.get("livre_id"),
             data.get("date_suggestion"), data.get("raison"))
        )
        return {**data, "suggestion_id": lid, "_source": "S1"}

    async def update_suggestion(self, suggestion_id: int, data: dict) -> dict:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return {}
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        await self._execute(
            f"UPDATE SUGGESTION SET {set_clause} WHERE suggestion_id=%s",
            (*fields.values(), suggestion_id)
        )
        return await self.get_suggestion(suggestion_id)

    async def delete_suggestion(self, suggestion_id: int) -> bool:
        n = await self._execute("DELETE FROM SUGGESTION WHERE suggestion_id=%s", (suggestion_id,))
        return n > 0


import aiomysql  # import en bas pour éviter la circularité
