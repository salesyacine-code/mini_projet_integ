"""
wrappers/wrapper_s3.py
Wrapper pour S3 — Neo4j (graphe de propriétés)
Traduit chaque opération CRUD globale en requêtes Cypher.

Nœuds : Book, Writer, Member, Professor, Copy, Theme
Relations : [:WROTE], [:HAS_COPY], [:BORROWED], [:RECOMMENDS], [:BELONGS_TO]

Particularités de S3 :
  - full_name est un champ unique → décomposé en nom + prenom
  - EMPRUNT et SUGGESTION sont des relations avec propriétés
  - Theme est un nœud normalisé (seule source avec des IDs de thème)
"""

from database import run_s3_query, run_s3_write
from typing import Optional


def _split_name(full_name: str) -> tuple[str, str]:
    """Décompose 'Prénom Nom' → (prenom, nom)."""
    parts = full_name.strip().split(" ", 1)
    return (parts[0], parts[1]) if len(parts) == 2 else (parts[0], "")


def _join_name(prenom: str, nom: str) -> str:
    return f"{prenom} {nom}".strip()


class WrapperS3:

    # ════════════════════════════════════════════════════════
    #  AUTEUR  (nœuds Writer)
    # ════════════════════════════════════════════════════════
    async def get_auteurs(self) -> list[dict]:
        rows = await run_s3_query("MATCH (w:Writer) RETURN w")
        result = []
        for r in rows:
            w = r["w"]
            prenom, nom = _split_name(w.get("full_name", ""))
            result.append({
                "auteur_id": w.get("writer_id"),
                "nom": nom,
                "prenom": prenom,
                "nationalite": w.get("country"),
                "_source": "S3"
            })
        return result

    async def get_auteur(self, writer_id: str) -> Optional[dict]:
        rows = await run_s3_query(
            "MATCH (w:Writer {writer_id: $wid}) RETURN w", {"wid": writer_id}
        )
        if not rows:
            return None
        w = rows[0]["w"]
        prenom, nom = _split_name(w.get("full_name", ""))
        return {"auteur_id": w.get("writer_id"), "nom": nom, "prenom": prenom,
                "nationalite": w.get("country"), "_source": "S3"}

    async def create_auteur(self, data: dict) -> dict:
        full_name = _join_name(data["prenom"], data["nom"])
        writer_id = f"W-{data['nom'].upper()[:3]}-{data['prenom'].upper()[:3]}"
        await run_s3_write(
            """CREATE (w:Writer {
                writer_id: $wid,
                full_name: $fn,
                country: $country
            })""",
            {"wid": writer_id, "fn": full_name, "country": data.get("nationalite", "")}
        )
        return {**data, "auteur_id": writer_id, "_source": "S3"}

    async def update_auteur(self, writer_id: str, data: dict) -> dict:
        set_parts = []
        params = {"wid": writer_id}
        if data.get("nom") or data.get("prenom"):
            existing = await self.get_auteur(writer_id)
            nom    = data.get("nom",    existing.get("nom", ""))
            prenom = data.get("prenom", existing.get("prenom", ""))
            set_parts.append("w.full_name = $fn")
            params["fn"] = _join_name(prenom, nom)
        if data.get("nationalite"):
            set_parts.append("w.country = $country")
            params["country"] = data["nationalite"]
        if set_parts:
            await run_s3_write(
                f"MATCH (w:Writer {{writer_id: $wid}}) SET {', '.join(set_parts)}",
                params
            )
        return await self.get_auteur(writer_id)

    async def delete_auteur(self, writer_id: str) -> bool:
        counters = await run_s3_write(
            "MATCH (w:Writer {writer_id: $wid}) DETACH DELETE w",
            {"wid": writer_id}
        )
        return counters.get("nodes_deleted", 0) > 0

    # ════════════════════════════════════════════════════════
    #  THEME  (nœuds Theme — seule source avec IDs propres)
    # ════════════════════════════════════════════════════════
    async def get_themes(self) -> list[dict]:
        rows = await run_s3_query("MATCH (t:Theme) RETURN t")
        return [{
            "theme_id": r["t"].get("theme_id"),
            "nom_theme": r["t"].get("name"),
            "_source": "S3"
        } for r in rows]

    async def get_theme(self, theme_id: str) -> Optional[dict]:
        rows = await run_s3_query(
            "MATCH (t:Theme {theme_id: $tid}) RETURN t", {"tid": theme_id}
        )
        if not rows:
            return None
        return {"theme_id": rows[0]["t"].get("theme_id"),
                "nom_theme": rows[0]["t"].get("name"), "_source": "S3"}

    async def get_appartient_theme(self) -> list[dict]:
        rows = await run_s3_query("""
            MATCH (b:Book)-[:BELONGS_TO]->(t:Theme)
            RETURN b.isbn AS livre_ref, t.name AS nom_theme
        """)
        return [{
            "livre_ref": r.get("livre_ref"),
            "theme_ref": r.get("nom_theme"),
            "nom_theme": r.get("nom_theme"),
            "_source": "S3"
        } for r in rows]

    async def create_theme(self, data: dict) -> dict:
        theme_id = f"TH-{data['nom_theme'].upper().replace(' ', '_')[:8]}"
        await run_s3_write(
            "CREATE (t:Theme {theme_id: $tid, name: $name})",
            {"tid": theme_id, "name": data["nom_theme"]}
        )
        return {"theme_id": theme_id, "nom_theme": data["nom_theme"], "_source": "S3"}

    async def update_theme(self, theme_id: str, data: dict) -> dict:
        await run_s3_write(
            "MATCH (t:Theme {theme_id: $tid}) SET t.name = $name",
            {"tid": theme_id, "name": data["nom_theme"]}
        )
        return await self.get_theme(theme_id)

    async def delete_theme(self, theme_id: str) -> bool:
        counters = await run_s3_write(
            "MATCH (t:Theme {theme_id: $tid}) DETACH DELETE t",
            {"tid": theme_id}
        )
        return counters.get("nodes_deleted", 0) > 0

    # ════════════════════════════════════════════════════════
    #  LIVRE  (nœuds Book)
    # ════════════════════════════════════════════════════════
    async def get_livres(self) -> list[dict]:
        rows = await run_s3_query("""
            MATCH (b:Book)
            OPTIONAL MATCH (w:Writer)-[:WROTE]->(b)
            OPTIONAL MATCH (b)-[:BELONGS_TO]->(t:Theme)
            RETURN b, w, t
        """)
        result = []
        for r in rows:
            b = r["b"]
            w = r.get("w") or {}
            t = r.get("t") or {}
            prenom, nom = _split_name(w.get("full_name", "")) if w.get("full_name") else ("", "")
            result.append({
                "livre_id": b.get("book_id"),
                "isbn": b.get("isbn"),
                "titre": b.get("title"),
                "annee_publication": b.get("year"),
                "theme": t.get("name"),
                "auteur_nom": nom,
                "auteur_prenom": prenom,
                "_source": "S3"
            })
        return result

    async def get_livre(self, isbn: str) -> Optional[dict]:
        rows = await run_s3_query("""
            MATCH (b:Book {isbn: $isbn})
            OPTIONAL MATCH (w:Writer)-[:WROTE]->(b)
            OPTIONAL MATCH (b)-[:BELONGS_TO]->(t:Theme)
            RETURN b, w, t
        """, {"isbn": isbn})
        if not rows:
            return None
        r = rows[0]
        b = r["b"]
        w = r.get("w") or {}
        t = r.get("t") or {}
        prenom, nom = _split_name(w.get("full_name", "")) if w.get("full_name") else ("", "")
        return {
            "livre_id": b.get("book_id"),
            "isbn": b.get("isbn"),
            "titre": b.get("title"),
            "annee_publication": b.get("year"),
            "theme": t.get("name"),
            "auteur_nom": nom,
            "auteur_prenom": prenom,
            "_source": "S3"
        }

    async def create_livre(self, data: dict) -> dict:
        book_id = f"B-{data['isbn'].replace('-', '')[:10]}"
        await run_s3_write(
            """CREATE (b:Book {
                book_id: $bid, isbn: $isbn,
                title: $title, year: $year
            })""",
            {"bid": book_id, "isbn": data["isbn"],
             "title": data["titre"], "year": data.get("annee_publication")}
        )
        # Lier au thème si fourni
        if data.get("theme"):
            await run_s3_write("""
                MATCH (b:Book {isbn: $isbn})
                MERGE (t:Theme {name: $theme})
                ON CREATE SET t.theme_id = 'TH-' + $theme
                MERGE (b)-[:BELONGS_TO]->(t)
            """, {"isbn": data["isbn"], "theme": data["theme"]})
        # Lier à l'auteur si fourni
        if data.get("auteur_id"):
            await run_s3_write("""
                MATCH (b:Book {isbn: $isbn})
                MATCH (w:Writer {writer_id: $wid})
                MERGE (w)-[:WROTE]->(b)
            """, {"isbn": data["isbn"], "wid": data["auteur_id"]})
        return {**data, "livre_id": book_id, "_source": "S3"}

    async def update_livre(self, isbn: str, data: dict) -> dict:
        set_parts = []
        params = {"isbn": isbn}
        if data.get("titre"):
            set_parts.append("b.title = $title")
            params["title"] = data["titre"]
        if data.get("annee_publication"):
            set_parts.append("b.year = $year")
            params["year"] = data["annee_publication"]
        if set_parts:
            await run_s3_write(
                f"MATCH (b:Book {{isbn: $isbn}}) SET {', '.join(set_parts)}", params
            )
        if data.get("theme"):
            await run_s3_write("""
                MATCH (b:Book {isbn: $isbn})
                OPTIONAL MATCH (b)-[r:BELONGS_TO]->(:Theme) DELETE r
                MERGE (t:Theme {name: $theme})
                MERGE (b)-[:BELONGS_TO]->(t)
            """, {"isbn": isbn, "theme": data["theme"]})
        return await self.get_livre(isbn)

    async def delete_livre(self, isbn: str) -> bool:
        counters = await run_s3_write(
            "MATCH (b:Book {isbn: $isbn}) DETACH DELETE b", {"isbn": isbn}
        )
        return counters.get("nodes_deleted", 0) > 0

    # ════════════════════════════════════════════════════════
    #  EXEMPLAIRE  (nœuds Copy liés à Book via HAS_COPY)
    # ════════════════════════════════════════════════════════
    async def get_exemplaires(self) -> list[dict]:
        rows = await run_s3_query("""
            MATCH (b:Book)-[:HAS_COPY]->(c:Copy)
            RETURN c, b.isbn AS isbn
        """)
        return [{
            "exemplaire_id": r["c"].get("copy_id"),
            "livre_ref": r.get("isbn"),
            "code_barre": r["c"].get("barcode"),
            "etat": r["c"].get("condition"),
            "disponibilite": r["c"].get("status") == "available",
            "_source": "S3"
        } for r in rows]

    async def get_exemplaire(self, copy_id: str) -> Optional[dict]:
        rows = await run_s3_query(
            "MATCH (b:Book)-[:HAS_COPY]->(c:Copy {copy_id: $cid}) RETURN c, b.isbn AS isbn",
            {"cid": copy_id}
        )
        if not rows:
            return None
        r = rows[0]
        return {
            "exemplaire_id": r["c"].get("copy_id"),
            "livre_ref": r.get("isbn"),
            "code_barre": r["c"].get("barcode"),
            "etat": r["c"].get("condition"),
            "disponibilite": r["c"].get("status") == "available",
            "_source": "S3"
        }

    async def create_exemplaire(self, isbn: str, data: dict) -> dict:
        copy_id = f"C-{data['code_barre']}"
        await run_s3_write("""
            MATCH (b:Book {isbn: $isbn})
            CREATE (c:Copy {
                copy_id: $cid,
                barcode: $barcode,
                condition: $condition,
                status: $status
            })
            CREATE (b)-[:HAS_COPY]->(c)
        """, {
            "isbn": isbn,
            "cid": copy_id,
            "barcode": data["code_barre"],
            "condition": data.get("etat", "bon"),
            "status": "available" if data.get("disponibilite", True) else "unavailable"
        })
        return {**data, "exemplaire_id": copy_id, "livre_ref": isbn, "_source": "S3"}

    async def update_exemplaire(self, copy_id: str, data: dict) -> dict:
        set_parts = []
        params = {"cid": copy_id}
        if data.get("etat"):
            set_parts.append("c.condition = $cond")
            params["cond"] = data["etat"]
        if data.get("disponibilite") is not None:
            set_parts.append("c.status = $status")
            params["status"] = "available" if data["disponibilite"] else "unavailable"
        if set_parts:
            await run_s3_write(
                f"MATCH (c:Copy {{copy_id: $cid}}) SET {', '.join(set_parts)}", params
            )
        return await self.get_exemplaire(copy_id)

    async def delete_exemplaire(self, copy_id: str) -> bool:
        counters = await run_s3_write(
            "MATCH (c:Copy {copy_id: $cid}) DETACH DELETE c", {"cid": copy_id}
        )
        return counters.get("nodes_deleted", 0) > 0

    async def get_personnes(self) -> list[dict]:
        adherents = await self.get_adherents()
        enseignants = await self.get_enseignants()
        return adherents + enseignants

    # ════════════════════════════════════════════════════════
    #  ADHERENT  (nœuds Member)
    # ════════════════════════════════════════════════════════
    async def get_adherents(self) -> list[dict]:
        rows = await run_s3_query("MATCH (m:Member) RETURN m")
        result = []
        for r in rows:
            m = r["m"]
            prenom, nom = _split_name(m.get("full_name", ""))
            result.append({
                "adherent_id": m.get("member_id"),
                "nom": nom, "prenom": prenom,
                "email": m.get("email"),
                "type": "Adherent",
                "_source": "S3"
            })
        return result

    async def get_adherent(self, member_id: str) -> Optional[dict]:
        rows = await run_s3_query(
            "MATCH (m:Member {member_id: $mid}) RETURN m", {"mid": member_id}
        )
        if not rows:
            return None
        m = rows[0]["m"]
        prenom, nom = _split_name(m.get("full_name", ""))
        return {"adherent_id": m.get("member_id"), "nom": nom, "prenom": prenom,
                "email": m.get("email"), "type": "Adherent", "_source": "S3"}

    async def create_adherent(self, data: dict) -> dict:
        member_id = f"M-{data['nom'].upper()[:3]}{data['prenom'].upper()[:3]}"
        full_name = _join_name(data["prenom"], data["nom"])
        await run_s3_write(
            "CREATE (m:Member {member_id: $mid, full_name: $fn, email: $email})",
            {"mid": member_id, "fn": full_name, "email": data.get("email", "")}
        )
        return {**data, "adherent_id": member_id, "type": "Adherent", "_source": "S3"}

    async def update_adherent(self, member_id: str, data: dict) -> dict:
        set_parts = []
        params = {"mid": member_id}
        if data.get("nom") or data.get("prenom"):
            existing = await self.get_adherent(member_id)
            nom    = data.get("nom",    existing.get("nom", ""))
            prenom = data.get("prenom", existing.get("prenom", ""))
            set_parts.append("m.full_name = $fn")
            params["fn"] = _join_name(prenom, nom)
        if data.get("email"):
            set_parts.append("m.email = $email")
            params["email"] = data["email"]
        if set_parts:
            await run_s3_write(
                f"MATCH (m:Member {{member_id: $mid}}) SET {', '.join(set_parts)}", params
            )
        return await self.get_adherent(member_id)

    async def delete_adherent(self, member_id: str) -> bool:
        counters = await run_s3_write(
            "MATCH (m:Member {member_id: $mid}) DETACH DELETE m", {"mid": member_id}
        )
        return counters.get("nodes_deleted", 0) > 0

    # ════════════════════════════════════════════════════════
    #  ENSEIGNANT  (nœuds Professor)
    # ════════════════════════════════════════════════════════
    async def get_enseignants(self) -> list[dict]:
        rows = await run_s3_query("MATCH (p:Professor) RETURN p")
        result = []
        for r in rows:
            p = r["p"]
            prenom, nom = _split_name(p.get("full_name", ""))
            result.append({
                "enseignant_id": p.get("prof_id"),
                "nom": nom, "prenom": prenom,
                "departement": p.get("department"),
                "type": "Enseignant",
                "_source": "S3"
            })
        return result

    async def get_enseignant(self, prof_id: str) -> Optional[dict]:
        rows = await run_s3_query(
            "MATCH (p:Professor {prof_id: $pid}) RETURN p", {"pid": prof_id}
        )
        if not rows:
            return None
        p = rows[0]["p"]
        prenom, nom = _split_name(p.get("full_name", ""))
        return {"enseignant_id": p.get("prof_id"), "nom": nom, "prenom": prenom,
                "departement": p.get("department"), "type": "Enseignant", "_source": "S3"}

    async def create_enseignant(self, data: dict) -> dict:
        prof_id = f"P-{data['nom'].upper()[:3]}{data['prenom'].upper()[:3]}"
        full_name = _join_name(data["prenom"], data["nom"])
        await run_s3_write(
            "CREATE (p:Professor {prof_id: $pid, full_name: $fn, department: $dept})",
            {"pid": prof_id, "fn": full_name, "dept": data.get("departement", "")}
        )
        return {**data, "enseignant_id": prof_id, "type": "Enseignant", "_source": "S3"}

    async def update_enseignant(self, prof_id: str, data: dict) -> dict:
        set_parts = []
        params = {"pid": prof_id}
        if data.get("nom") or data.get("prenom"):
            existing = await self.get_enseignant(prof_id)
            nom    = data.get("nom",    existing.get("nom", ""))
            prenom = data.get("prenom", existing.get("prenom", ""))
            set_parts.append("p.full_name = $fn")
            params["fn"] = _join_name(prenom, nom)
        if data.get("departement"):
            set_parts.append("p.department = $dept")
            params["dept"] = data["departement"]
        if set_parts:
            await run_s3_write(
                f"MATCH (p:Professor {{prof_id: $pid}}) SET {', '.join(set_parts)}", params
            )
        return await self.get_enseignant(prof_id)

    async def delete_enseignant(self, prof_id: str) -> bool:
        counters = await run_s3_write(
            "MATCH (p:Professor {prof_id: $pid}) DETACH DELETE p", {"pid": prof_id}
        )
        return counters.get("nodes_deleted", 0) > 0

    # ════════════════════════════════════════════════════════
    #  EMPRUNT  (relation [:BORROWED] entre Member et Copy)
    # ════════════════════════════════════════════════════════
    async def get_emprunts(self) -> list[dict]:
        rows = await run_s3_query("""
            MATCH (m:Member)-[b:BORROWED]->(c:Copy)
            RETURN m.member_id AS adherent_id, c.copy_id AS copy_id,
                   b.date AS date_emprunt, b.return_date AS date_retour,
                   m.full_name AS nom_complet
        """)
        return [{
            "emprunt_id": None,
            "adherent_id": r.get("adherent_id"),
            "exemplaire_id": r.get("copy_id"),
            "date_emprunt": r.get("date_emprunt"),
            "date_retour_prevue": r.get("date_retour"),
            "statut": "rendu" if r.get("date_retour") else "en cours",
            "nom_adherent": r.get("nom_complet"),
            "_source": "S3"
        } for r in rows]

    async def create_emprunt(self, data: dict) -> dict:
        await run_s3_write("""
            MATCH (m:Member {member_id: $mid})
            MATCH (c:Copy {copy_id: $cid})
            CREATE (m)-[:BORROWED {
                date: $date_emprunt,
                return_date: $date_retour
            }]->(c)
            SET c.status = 'unavailable'
        """, {
            "mid": data["adherent_id"],
            "cid": data["exemplaire_id"],
            "date_emprunt": str(data["date_emprunt"]),
            "date_retour": str(data.get("date_retour_prevue", ""))
        })
        return {**data, "_source": "S3"}

    async def update_emprunt(self, member_id: str, copy_id: str, data: dict) -> dict:
        """Met à jour la relation BORROWED (retour par exemple)."""
        set_parts = []
        params = {"mid": member_id, "cid": copy_id}
        if data.get("date_retour_prevue"):
            set_parts.append("b.return_date = $ret")
            params["ret"] = str(data["date_retour_prevue"])
        if data.get("statut") == "rendu":
            # Marquer la copie comme disponible
            await run_s3_write(
                "MATCH (c:Copy {copy_id: $cid}) SET c.status = 'available'",
                {"cid": copy_id}
            )
        if set_parts:
            await run_s3_write(
                f"MATCH (m:Member {{member_id: $mid}})-[b:BORROWED]->(c:Copy {{copy_id: $cid}}) SET {', '.join(set_parts)}",
                params
            )
        return {**data, "_source": "S3"}

    async def delete_emprunt(self, member_id: str, copy_id: str) -> bool:
        counters = await run_s3_write("""
            MATCH (m:Member {member_id: $mid})-[b:BORROWED]->(c:Copy {copy_id: $cid})
            DELETE b
            SET c.status = 'available'
        """, {"mid": member_id, "cid": copy_id})
        return counters.get("relationships_deleted", 0) > 0

    # ════════════════════════════════════════════════════════
    #  SUGGESTION  (relation [:RECOMMENDS] entre Professor et Book)
    # ════════════════════════════════════════════════════════
    async def get_suggestions(self) -> list[dict]:
        rows = await run_s3_query("""
            MATCH (p:Professor)-[r:RECOMMENDS]->(b:Book)
            RETURN p.prof_id AS prof_id, p.full_name AS nom,
                   b.isbn AS isbn, b.title AS titre,
                   r.date AS date_suggestion, r.reason AS raison
        """)
        return [{
            "suggestion_id": None,
            "enseignant_id": r.get("prof_id"),
            "nom_enseignant": r.get("nom"),
            "livre_id": r.get("isbn"),
            "livre_titre": r.get("titre"),
            "date_suggestion": r.get("date_suggestion"),
            "raison": r.get("raison"),
            "_source": "S3"
        } for r in rows]

    async def create_suggestion(self, data: dict) -> dict:
        await run_s3_write("""
            MATCH (p:Professor {prof_id: $pid})
            MATCH (b:Book {isbn: $isbn})
            CREATE (p)-[:RECOMMENDS {
                date: $date,
                reason: $raison
            }]->(b)
        """, {
            "pid": data["enseignant_id"],
            "isbn": data.get("livre_id"),
            "date": str(data.get("date_suggestion", "")),
            "raison": data.get("raison", "")
        })
        return {**data, "_source": "S3"}

    async def delete_suggestion(self, prof_id: str, isbn: str) -> bool:
        counters = await run_s3_write("""
            MATCH (p:Professor {prof_id: $pid})-[r:RECOMMENDS]->(b:Book {isbn: $isbn})
            DELETE r
        """, {"pid": prof_id, "isbn": isbn})
        return counters.get("relationships_deleted", 0) > 0
