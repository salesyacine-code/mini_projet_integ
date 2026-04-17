"""
main.py
API FastAPI — Médiateur Bibliothèque v2

Schéma global : 10 entités
  AUTEUR · THEME · APPARTIENT_THEME · LIVRE · EXEMPLAIRE
  PERSONNE · ADHERENT · ENSEIGNANT · EMPRUNT · SUGGESTION
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional

from database import close_all_connections
from services.mediator import (
    view_auteurs, view_themes, view_appartient_theme,
    view_livres, view_livre_by_isbn,
    view_exemplaires, view_exemplaires_by_livre,
    view_personnes, view_adherents, view_enseignants,
    view_emprunts, view_suggestions,
    check_health, _count_by_source,
)
from schemas.global_models import (
    Auteur, Theme, AppartientTheme, Livre, Exemplaire,
    Personne, Adherent, Enseignant, Emprunt, Suggestion,
    ListResponse, HealthStatus,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    close_all_connections()


app = FastAPI(
    title="Médiateur Bibliothèque",
    description=(
        "API GAV — Schéma global intégré (10 entités)\n\n"
        "**Sources** : S1 MySQL · S2 MongoDB · S3 Neo4j\n\n"
        "**Entités** : AUTEUR · THEME · APPARTIENT_THEME · LIVRE · EXEMPLAIRE · "
        "PERSONNE · ADHERENT · ENSEIGNANT · EMPRUNT · SUGGESTION"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["GET"], allow_headers=["*"])


# ══════════════════════════════════════════════════════════════
# SYSTÈME
# ══════════════════════════════════════════════════════════════

@app.get("/health", response_model=HealthStatus, tags=["Système"],
         summary="Connectivité des 3 sources")
def health():
    return check_health()


@app.get("/stats", tags=["Système"], summary="Compteurs globaux par vue")
def stats():
    def _c(fn, **kw):
        try:
            items = fn(**kw)
            return {"total": len(items), "par_source": _count_by_source(items)}
        except Exception as e:
            return {"total": 0, "erreur": str(e)}
    return {
        "auteurs":              _c(view_auteurs),
        "themes":               _c(view_themes),
        "appartient_theme":     _c(view_appartient_theme),
        "livres":               _c(view_livres),
        "exemplaires":          _c(view_exemplaires),
        "exemplaires_dispo":    _c(view_exemplaires, disponible_only=True),
        "personnes":            _c(view_personnes),
        "adherents":            _c(view_adherents),
        "enseignants":          _c(view_enseignants),
        "emprunts":             _c(view_emprunts),
        "emprunts_en_cours":    _c(view_emprunts, en_cours_only=True),
        "suggestions":          _c(view_suggestions),
    }


# ══════════════════════════════════════════════════════════════
# AUTEUR
# ══════════════════════════════════════════════════════════════

@app.get("/auteurs", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue AUTEUR — S1 AUTEUR + S2 contributeurs[role=auteur] + S3 Writer")
def get_auteurs(source: Optional[str] = Query(None, description="S1 | S2 | S3")):
    items = view_auteurs(source_filter=source)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Auteur(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# THEME
# ══════════════════════════════════════════════════════════════

@app.get("/themes", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue THEME — S1.categorie + S2.sujet + S3 nœud Theme")
def get_themes(source: Optional[str] = Query(None)):
    """
    Déduplication par nom_theme normalisé (lowercase).
    S3 est prioritaire car les nœuds Theme ont de vrais identifiants.
    """
    items = view_themes(source_filter=source)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Theme(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# APPARTIENT_THEME  (table de liaison N-M)
# ══════════════════════════════════════════════════════════════

@app.get("/appartient-theme", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue APPARTIENT_THEME — liaison LIVRE↔THEME (N-M)")
def get_appartient_theme(source: Optional[str] = Query(None)):
    """
    S1 : 1 catégorie par livre → 1 ligne par livre.
    S2 : 1 sujet par ouvrage  → 1 ligne par ouvrage.
    S3 : N thèmes possibles par livre via relation BELONGS_TO.
    """
    items = view_appartient_theme(source_filter=source)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[AppartientTheme(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# LIVRE
# ══════════════════════════════════════════════════════════════

@app.get("/livres", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue LIVRE — dédupliqués par ISBN, thèmes fusionnés")
def get_livres(
    source: Optional[str] = Query(None),
    theme:  Optional[str] = Query(None, description="Filtre thème (sous-chaîne)"),
    titre:  Optional[str] = Query(None, description="Recherche dans le titre"),
):
    """
    Déduplication par ISBN (priorité S1).
    `nb_pages` et `editeur` enrichis depuis S2 si absents de S1.
    `themes[]` = liste fusionnée de tous les thèmes trouvés toutes sources.
    """
    items = view_livres(source_filter=source, theme=theme, titre=titre)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Livre(**r).model_dump() for r in items])


@app.get("/livres/{isbn}", response_model=Livre, tags=["Vues GAV"],
         summary="Livre par ISBN")
def get_livre(isbn: str):
    items = view_livre_by_isbn(isbn)
    if not items:
        raise HTTPException(404, f"Livre ISBN={isbn} introuvable")
    return Livre(**items[0])


@app.get("/livres/{isbn}/exemplaires", response_model=ListResponse, tags=["Vues GAV"],
         summary="Exemplaires d'un livre par ISBN")
def get_exemplaires_by_livre(isbn: str):
    items = view_exemplaires_by_livre(isbn)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Exemplaire(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# EXEMPLAIRE
# ══════════════════════════════════════════════════════════════

@app.get("/exemplaires", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue EXEMPLAIRE — S1 + S2.stocks[] + S3 Copy")
def get_exemplaires(
    source:     Optional[str]  = Query(None),
    disponible: Optional[bool] = Query(None, description="true = disponibles seulement"),
):
    items = view_exemplaires(source_filter=source, disponible_only=(disponible is True))
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Exemplaire(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# PERSONNE  (super-entité ISA)
# ══════════════════════════════════════════════════════════════

@app.get("/personnes", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue PERSONNE — super-entité ISA (Adherent | Enseignant)")
def get_personnes(
    source: Optional[str] = Query(None),
    type:   Optional[str] = Query(None, description="Adherent | Enseignant"),
):
    items = view_personnes(source_filter=source, type_filter=type)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Personne(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# ADHERENT  (sous-type ISA)
# ══════════════════════════════════════════════════════════════

@app.get("/adherents", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue ADHERENT — sous-type ISA de PERSONNE")
def get_adherents(source: Optional[str] = Query(None)):
    items = view_adherents(source_filter=source)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Adherent(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# ENSEIGNANT  (sous-type ISA)
# ══════════════════════════════════════════════════════════════

@app.get("/enseignants", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue ENSEIGNANT — sous-type ISA de PERSONNE")
def get_enseignants(source: Optional[str] = Query(None)):
    items = view_enseignants(source_filter=source)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Enseignant(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# EMPRUNT  (S1 + S3 — absent de S2)
# personne_id → ADHERENT
# ══════════════════════════════════════════════════════════════

@app.get("/emprunts", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue EMPRUNT — S1 + S3 (absent de S2), personne_id→ADHERENT")
def get_emprunts(
    source:   Optional[str]  = Query(None, description="S1 | S3"),
    en_cours: Optional[bool] = Query(None),
):
    items = view_emprunts(source_filter=source, en_cours_only=(en_cours is True))
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Emprunt(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# SUGGESTION  (personne_id → ENSEIGNANT)
# ══════════════════════════════════════════════════════════════

@app.get("/suggestions", response_model=ListResponse, tags=["Vues GAV"],
         summary="Vue SUGGESTION — personne_id→ENSEIGNANT, livre_ref NULL pour S2")
def get_suggestions(source: Optional[str] = Query(None)):
    """
    Note S2 : `livre_ref` est NULL car les suggestions sont embarquées
    dans adherant sans référence directe au livre (seulement le titre libre).
    """
    items = view_suggestions(source_filter=source)
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Suggestion(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# Démarrage
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


# ══════════════════════════════════════════════════════════════
# CRUD — S1 MySQL (écriture directe sur la source relationnelle)
# ══════════════════════════════════════════════════════════════

from fastapi import Body
from database import mysql_execute
from sqlalchemy import text
from database import _mysql_engine

# ── AUTEUR ────────────────────────────────────────────────────

@app.post("/auteurs", tags=["CRUD S1"], summary="Créer un auteur (S1)")
def create_auteur(data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO AUTEUR (nom, prenom, nationalite, date_naissance)
            VALUES (:nom, :prenom, :nationalite, :date_naissance)
        """), {
            "nom": data.get("nom"), "prenom": data.get("prenom"),
            "nationalite": data.get("nationalite"),
            "date_naissance": data.get("date_naissance") or None,
        })
        conn.commit()
    return {"message": "Auteur créé"}

@app.put("/auteurs/{auteur_id}", tags=["CRUD S1"], summary="Modifier un auteur (S1)")
def update_auteur(auteur_id: int, data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            UPDATE AUTEUR SET nom=:nom, prenom=:prenom,
            nationalite=:nationalite, date_naissance=:date_naissance
            WHERE auteur_id=:id
        """), {**data, "id": auteur_id})
        conn.commit()
    return {"message": "Auteur modifié"}

@app.delete("/auteurs/{auteur_id}", tags=["CRUD S1"], summary="Supprimer un auteur (S1)")
def delete_auteur(auteur_id: int):
    with _mysql_engine.connect() as conn:
        conn.execute(text("DELETE FROM AUTEUR WHERE auteur_id=:id"), {"id": auteur_id})
        conn.commit()
    return {"message": "Auteur supprimé"}

# ── LIVRE ─────────────────────────────────────────────────────

@app.post("/livres", tags=["CRUD S1"], summary="Créer un livre (S1)")
def create_livre(data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO LIVRE (titre, annee_publication, isbn, auteur_id, categorie)
            VALUES (:titre, :annee_publication, :isbn, :auteur_id, :categorie)
        """), {
            "titre": data.get("titre"), "annee_publication": data.get("annee_publication"),
            "isbn": data.get("isbn"), "auteur_id": data.get("auteur_id"),
            "categorie": data.get("categorie"),
        })
        conn.commit()
    return {"message": "Livre créé"}

@app.put("/livres/{livre_id}", tags=["CRUD S1"], summary="Modifier un livre (S1)")
def update_livre(livre_id: int, data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            UPDATE LIVRE SET titre=:titre, annee_publication=:annee_publication,
            isbn=:isbn, auteur_id=:auteur_id, categorie=:categorie
            WHERE livre_id=:id
        """), {**data, "id": livre_id})
        conn.commit()
    return {"message": "Livre modifié"}

@app.delete("/livres/{livre_id}", tags=["CRUD S1"], summary="Supprimer un livre (S1)")
def delete_livre(livre_id: int):
    with _mysql_engine.connect() as conn:
        conn.execute(text("DELETE FROM EXEMPLAIRE WHERE livre_id=:id"), {"id": livre_id})
        conn.execute(text("DELETE FROM SUGGESTION WHERE livre_id=:id"), {"id": livre_id})
        conn.execute(text("DELETE FROM LIVRE WHERE livre_id=:id"), {"id": livre_id})
        conn.commit()
    return {"message": "Livre supprimé"}

# ── ADHERENT ──────────────────────────────────────────────────

@app.post("/adherents", tags=["CRUD S1"], summary="Créer un adhérent (S1)")
def create_adherent(data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO ADHERENT (nom, prenom, email, telephone, date_inscription)
            VALUES (:nom, :prenom, :email, :telephone, :date_inscription)
        """), {
            "nom": data.get("nom"), "prenom": data.get("prenom"),
            "email": data.get("email"), "telephone": data.get("telephone"),
            "date_inscription": data.get("date_inscription") or None,
        })
        conn.commit()
    return {"message": "Adhérent créé"}

@app.put("/adherents/{pid}", tags=["CRUD S1"], summary="Modifier un adhérent (S1)")
def update_adherent(pid: int, data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            UPDATE ADHERENT SET nom=:nom, prenom=:prenom, email=:email,
            telephone=:telephone WHERE adherent_id=:id
        """), {**data, "id": pid})
        conn.commit()
    return {"message": "Adhérent modifié"}

@app.delete("/adherents/{pid}", tags=["CRUD S1"], summary="Supprimer un adhérent (S1)")
def delete_adherent(pid: int):
    with _mysql_engine.connect() as conn:
        conn.execute(text("DELETE FROM EMPRUNT WHERE adherent_id=:id"), {"id": pid})
        conn.execute(text("DELETE FROM ADHERENT WHERE adherent_id=:id"), {"id": pid})
        conn.commit()
    return {"message": "Adhérent supprimé"}

# ── ENSEIGNANT ────────────────────────────────────────────────

@app.post("/enseignants", tags=["CRUD S1"], summary="Créer un enseignant (S1)")
def create_enseignant(data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO ENSEIGNANT (nom, prenom, departement, email)
            VALUES (:nom, :prenom, :departement, :email)
        """), {
            "nom": data.get("nom"), "prenom": data.get("prenom"),
            "departement": data.get("departement"), "email": data.get("email"),
        })
        conn.commit()
    return {"message": "Enseignant créé"}

@app.put("/enseignants/{pid}", tags=["CRUD S1"], summary="Modifier un enseignant (S1)")
def update_enseignant(pid: int, data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            UPDATE ENSEIGNANT SET nom=:nom, prenom=:prenom,
            departement=:departement, email=:email WHERE enseignant_id=:id
        """), {**data, "id": pid})
        conn.commit()
    return {"message": "Enseignant modifié"}

@app.delete("/enseignants/{pid}", tags=["CRUD S1"], summary="Supprimer un enseignant (S1)")
def delete_enseignant(pid: int):
    with _mysql_engine.connect() as conn:
        conn.execute(text("DELETE FROM SUGGESTION WHERE enseignant_id=:id"), {"id": pid})
        conn.execute(text("DELETE FROM ENSEIGNANT WHERE enseignant_id=:id"), {"id": pid})
        conn.commit()
    return {"message": "Enseignant supprimé"}

# ── EXEMPLAIRE ────────────────────────────────────────────────

@app.post("/exemplaires", tags=["CRUD S1"], summary="Créer un exemplaire (S1)")
def create_exemplaire(data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO EXEMPLAIRE (livre_id, code_barre, etat, disponibilite)
            VALUES (:livre_id, :code_barre, :etat, :disponibilite)
        """), {
            "livre_id": data.get("livre_id"), "code_barre": data.get("code_barre"),
            "etat": data.get("etat", "bon"),
            "disponibilite": data.get("disponibilite", True),
        })
        conn.commit()
    return {"message": "Exemplaire créé"}

@app.delete("/exemplaires/{eid}", tags=["CRUD S1"], summary="Supprimer un exemplaire (S1)")
def delete_exemplaire(eid: int):
    with _mysql_engine.connect() as conn:
        conn.execute(text("DELETE FROM EMPRUNT WHERE exemplaire_id=:id"), {"id": eid})
        conn.execute(text("DELETE FROM EXEMPLAIRE WHERE exemplaire_id=:id"), {"id": eid})
        conn.commit()
    return {"message": "Exemplaire supprimé"}

# ── EMPRUNT ───────────────────────────────────────────────────

@app.post("/emprunts", tags=["CRUD S1"], summary="Créer un emprunt (S1)")
def create_emprunt(data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO EMPRUNT (exemplaire_id, adherent_id, date_emprunt,
            date_retour_prevue, statut)
            VALUES (:exemplaire_id, :adherent_id, :date_emprunt,
            :date_retour_prevue, :statut)
        """), {
            "exemplaire_id": data.get("exemplaire_id"),
            "adherent_id":   data.get("adherent_id"),
            "date_emprunt":  data.get("date_emprunt"),
            "date_retour_prevue": data.get("date_retour_prevue") or None,
            "statut": data.get("statut", "en cours"),
        })
        conn.commit()
    return {"message": "Emprunt créé"}

@app.put("/emprunts/{eid}", tags=["CRUD S1"], summary="Modifier statut emprunt (S1)")
def update_emprunt(eid: int, data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            UPDATE EMPRUNT SET statut=:statut,
            date_retour_prevue=:date_retour_prevue WHERE emprunt_id=:id
        """), {**data, "id": eid})
        conn.commit()
    return {"message": "Emprunt modifié"}

# ── SUGGESTION ────────────────────────────────────────────────

@app.post("/suggestions", tags=["CRUD S1"], summary="Créer une suggestion (S1)")
def create_suggestion(data: dict = Body(...)):
    with _mysql_engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO SUGGESTION (enseignant_id, livre_id, date_suggestion, raison)
            VALUES (:enseignant_id, :livre_id, :date_suggestion, :raison)
        """), {
            "enseignant_id":   data.get("enseignant_id"),
            "livre_id":        data.get("livre_id"),
            "date_suggestion": data.get("date_suggestion") or None,
            "raison":          data.get("raison"),
        })
        conn.commit()
    return {"message": "Suggestion créée"}

@app.delete("/suggestions/{sid}", tags=["CRUD S1"], summary="Supprimer une suggestion (S1)")
def delete_suggestion(sid: int):
    with _mysql_engine.connect() as conn:
        conn.execute(text("DELETE FROM SUGGESTION WHERE suggestion_id=:id"), {"id": sid})
        conn.commit()
    return {"message": "Suggestion supprimée"}

# ══════════════════════════════════════════════════════════════
# SQL Query endpoint  (SELECT uniquement sur S1)
# ══════════════════════════════════════════════════════════════

@app.post("/query/sql", tags=["Requêtes"], summary="Exécuter une requête SELECT sur S1 (MySQL)")
def run_sql_query(data: dict = Body(...)):
    sql = str(data.get("sql", "")).strip()
    if not sql.lower().startswith("select"):
        raise HTTPException(400, "Seules les requêtes SELECT sont autorisées")
    try:
        rows = mysql_execute(sql)
        return {"total": len(rows), "columns": list(rows[0].keys()) if rows else [], "rows": rows}
    except Exception as e:
        raise HTTPException(400, str(e))


# ══════════════════════════════════════════════════════════════
# APPROCHE LAV — Local As View
# ══════════════════════════════════════════════════════════════

from services.lav_rewriter import lav_query, lav_schema_info, LAVQuery
from services.lav_definitions import build_registry, get_views_for

# Initialisation du registre LAV au démarrage
try:
    build_registry()
except Exception:
    pass   # sera re-tenté au premier appel


@app.get(
    "/lav/schema",
    tags=["LAV — Local As View"],
    summary="Description complète du schéma LAV (mappings sources → entités globales)",
)
def get_lav_schema():
    """
    Retourne pour chaque entité globale : quelles sources la couvrent,
    quels attributs sont disponibles dans chaque source, et les conditions
    implicites de chaque vue locale.
    """
    return lav_schema_info()


@app.get(
    "/lav/sources/{source_name}",
    tags=["LAV — Local As View"],
    summary="Vues LAV définies pour une source spécifique",
)
def get_lav_source_views(source_name: str):
    """
    Retourne la description LAV d'une source donnée (S1, S2 ou S3) :
    quelles entités globales elle couvre et avec quels attributs.
    """
    from services.lav_definitions import get_views_for_source
    views = get_views_for_source(source_name.upper())
    if not views:
        raise HTTPException(404, f"Source {source_name} introuvable dans le registre LAV")
    return {
        "source": source_name.upper(),
        "entities_covered": len(views),
        "views": [
            {
                "entity":       v.entity,
                "description":  v.description,
                "completeness": v.completeness,
                "conditions":   v.conditions,
                "attributes_available": [a.global_attr for a in v.attributes if a.available],
                "attributes_missing":   [a.global_attr for a in v.attributes if not a.available],
            }
            for v in views
        ],
    }


@app.post(
    "/lav/query",
    tags=["LAV — Local As View"],
    summary="Exécuter une requête LAV sur le schéma global",
)
def run_lav_query(body: dict = Body(...)):
    """
    Exécute une requête LAV avec réécriture automatique.

    Corps attendu :
    ```json
    {
      "entity":      "LIVRE",
      "attributes":  ["isbn", "titre", "editeur", "nb_pages"],
      "filters":     {"disponibilite": true},
      "sources":     null,
      "require_all": false
    }
    ```

    Le moteur sélectionne automatiquement les sources pertinentes,
    réécrit la requête pour chacune, puis fusionne les résultats.
    """
    entity = body.get("entity", "").upper()
    if not entity:
        raise HTTPException(400, "Le champ 'entity' est requis")

    valid_entities = {
        "AUTEUR","THEME","LIVRE","EXEMPLAIRE",
        "PERSONNE","ADHERENT","ENSEIGNANT",
        "EMPRUNT","SUGGESTION",
    }
    if entity not in valid_entities:
        raise HTTPException(400, f"Entité inconnue : {entity}. Valides : {sorted(valid_entities)}")

    try:
        result = lav_query(
            entity=entity,
            attributes=body.get("attributes"),
            filters=body.get("filters") or {},
            sources=body.get("sources"),
            require_all=body.get("require_all", False),
        )
        return {
            "entity":          result.entity,
            "total":           result.total,
            "sources_used":    result.sources_used,
            "sources_skipped": result.sources_skipped,
            "source_counts":   result.source_counts,
            "coverage_map":    result.coverage_map,
            "rewriting_plan":  result.plan,
            "data":            result.rows,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get(
    "/lav/{entity}",
    tags=["LAV — Local As View"],
    summary="Requête LAV simplifiée via GET",
)
def get_lav_entity(
    entity: str,
    source:      Optional[str] = Query(None, description="Forcer une source : S1, S2 ou S3"),
    attributes:  Optional[str] = Query(None, description="Attributs séparés par virgule"),
    require_all: Optional[bool]= Query(False, description="Exclure tuples incomplets"),
):
    """
    Raccourci GET pour interroger une entité via LAV.
    Le moteur sélectionne automatiquement les meilleures sources.
    """
    entity_upper = entity.upper()
    attrs_list = [a.strip() for a in attributes.split(",")] if attributes else None
    sources_list = [source.upper()] if source else None

    try:
        result = lav_query(
            entity=entity_upper,
            attributes=attrs_list,
            sources=sources_list,
            require_all=require_all or False,
        )
        return {
            "entity":          result.entity,
            "total":           result.total,
            "sources_used":    result.sources_used,
            "sources_skipped": result.sources_skipped,
            "source_counts":   result.source_counts,
            "rewriting_plan":  result.plan,
            "data":            result.rows,
        }
    except Exception as e:
        raise HTTPException(500, str(e))
