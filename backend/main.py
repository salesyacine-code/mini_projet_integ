"""
main.py
API FastAPI — Médiateur Bibliothèque v2 (100% Asynchrone)

Schéma global : 10 entités
  AUTEUR · THEME · APPARTIENT_THEME · LIVRE · EXEMPLAIRE
  PERSONNE · ADHERENT · ENSEIGNANT · EMPRUNT · SUGGESTION
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional
import asyncio

from database import close_s1, close_s2, close_s3
from schemas.global_models import (
    Auteur, Theme, AppartientTheme, Livre, Exemplaire,
    Personne, Adherent, Enseignant, Emprunt, Suggestion,
    ListResponse, HealthStatus,
)

from services.mediator import Mediator, Source
from wrappers.wrapper_s1 import WrapperS1
from wrappers.wrapper_s2 import WrapperS2
from wrappers.wrapper_s3 import WrapperS3
from services.lav_rewriter import lav_query, lav_schema_info
from services.lav_definitions import build_registry

mediator = Mediator()
s1_crud = WrapperS1()
s2_crud = WrapperS2()
s3_crud = WrapperS3()

def get_wrapper(source: str):
    s = source.upper()
    if s == "S1": return s1_crud
    if s == "S2": return s2_crud
    if s == "S3": return s3_crud
    raise HTTPException(400, "Source invalide. Utilisez S1, S2 ou S3.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init
    try:
        build_registry()
    except Exception as e:
        print(f"Error building LAV registry: {e}")
    yield
    # Cleanup
    await close_s1()
    close_s2()
    close_s3()


app = FastAPI(
    title="Médiateur Bibliothèque",
    description=(
        "API GAV & LAV — Schéma global intégré (10 entités)\n\n"
        "**Sources** : S1 MySQL · S2 MongoDB · S3 Neo4j\n\n"
    ),
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


def _count_by_source(items: list[dict]) -> dict:
    counts = {}
    for item in items:
        src = item.get("_source", "Inconnu")
        counts[src] = counts.get(src, 0) + 1
    return counts


# ══════════════════════════════════════════════════════════════
# HEALTH & STATS
# ══════════════════════════════════════════════════════════════

@app.get("/health", tags=["Utilitaires"])
async def health_check():
    """Vérifie la connectivité des 3 sources."""
    from database import get_s1_pool, get_s2_db, get_s3_driver
    results = {}

    # S1 MySQL
    try:
        pool = await get_s1_pool()   # async function — must be awaited
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
        results["S1"] = {"status": "ok", "tech": "MySQL"}
    except Exception as e:
        results["S1"] = {"status": "error", "detail": str(e), "tech": "MySQL"}

    # S2 MongoDB
    try:
        db = get_s2_db()
        await db.command("ping")
        results["S2"] = {"status": "ok", "tech": "MongoDB"}
    except Exception as e:
        results["S2"] = {"status": "error", "detail": str(e), "tech": "MongoDB"}

    # S3 Neo4j
    try:
        driver = get_s3_driver()
        if driver:
            results["S3"] = {"status": "ok", "tech": "Neo4j"}
        else:
            results["S3"] = {"status": "unavailable", "tech": "Neo4j"}
    except Exception as e:
        results["S3"] = {"status": "error", "detail": str(e), "tech": "Neo4j"}

    overall = "ok" if all(v["status"] == "ok" for v in results.values()) else "degraded"
    return {"status": overall, "sources": results}


@app.get("/stats", tags=["Utilitaires"])
async def get_stats():
    """Statistiques globales agrégées des 3 sources."""
    try:
        livres, exemplaires, adherents, emprunts = await asyncio.gather(
            mediator.get_livres(),
            mediator.get_exemplaires(),
            mediator.get_adherents(),
            mediator.get_emprunts(),
            return_exceptions=True,
        )
        livres      = livres      if isinstance(livres, list)      else []
        exemplaires = exemplaires if isinstance(exemplaires, list) else []
        adherents   = adherents   if isinstance(adherents, list)   else []
        emprunts    = emprunts    if isinstance(emprunts, list)     else []

        dispo  = [e for e in exemplaires if e.get("disponibilite") in (True, "oui", "Disponible", 1)]
        encours = [em for em in emprunts if (em.get("statut") or "").lower() in ("en cours", "borrowed")]

        return {
            "total_livres":          {"total": len(livres),      **_count_by_source(livres)},
            "total_exemplaires":     {"total": len(exemplaires), **_count_by_source(exemplaires)},
            "total_adherents":       {"total": len(adherents),   **_count_by_source(adherents)},
            "exemplaires_dispo":     {"total": len(dispo)},
            "emprunts_en_cours":     {"total": len(encours)},
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════
# VUES GAV (Global As View) — Médiateur Asynchrone
# ══════════════════════════════════════════════════════════════

@app.get("/auteurs", response_model=ListResponse, tags=["Vues GAV"])
async def get_auteurs():
    items = await mediator.get_auteurs()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Auteur(**r).model_dump() for r in items])


@app.get("/themes", response_model=ListResponse, tags=["Vues GAV"])
async def get_themes():
    items = await mediator.get_themes()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Theme(**r).model_dump() for r in items])


@app.get("/appartient-theme", response_model=ListResponse, tags=["Vues GAV"])
async def get_appartient_theme():
    items = await mediator.get_appartient_theme()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[AppartientTheme(**r).model_dump() for r in items])


@app.get("/livres", response_model=ListResponse, tags=["Vues GAV"])
async def get_livres():
    items = await mediator.get_livres()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Livre(**r).model_dump() for r in items])


@app.get("/livres/{isbn}", response_model=Livre, tags=["Vues GAV"])
async def get_livre(isbn: str):
    items = await mediator.get_livres()
    livre = next((r for r in items if r.get("isbn") == isbn), None)
    if not livre:
        raise HTTPException(404, f"Livre ISBN={isbn} introuvable")
    return Livre(**livre)


@app.get("/exemplaires", response_model=ListResponse, tags=["Vues GAV"])
async def get_exemplaires():
    items = await mediator.get_exemplaires()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Exemplaire(**r).model_dump() for r in items])


@app.get("/personnes", response_model=ListResponse, tags=["Vues GAV"])
async def get_personnes():
    items = await mediator.get_personnes()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Personne(**r).model_dump() for r in items])


@app.get("/adherents", response_model=ListResponse, tags=["Vues GAV"])
async def get_adherents():
    items = await mediator.get_adherents()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Adherent(**r).model_dump() for r in items])


@app.get("/enseignants", response_model=ListResponse, tags=["Vues GAV"])
async def get_enseignants():
    items = await mediator.get_enseignants()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Enseignant(**r).model_dump() for r in items])


@app.get("/emprunts", response_model=ListResponse, tags=["Vues GAV"])
async def get_emprunts():
    items = await mediator.get_emprunts()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Emprunt(**r).model_dump() for r in items])


@app.get("/suggestions", response_model=ListResponse, tags=["Vues GAV"])
async def get_suggestions():
    items = await mediator.get_suggestions()
    return ListResponse(total=len(items), source_counts=_count_by_source(items),
                        data=[Suggestion(**r).model_dump() for r in items])


# ══════════════════════════════════════════════════════════════
# CRUD — Multi-Sources (Spécifier S1, S2, ou S3)
# ══════════════════════════════════════════════════════════════

# ── AUTEUR ────────────────────────────────────────────────────
@app.post("/auteurs", tags=["CRUD"])
async def create_auteur(data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).create_auteur(data)
    return {"message": f"Auteur créé dans {source.upper()}"}

@app.put("/auteurs/{auteur_id}", tags=["CRUD"])
async def update_auteur(auteur_id: str, data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).update_auteur(auteur_id, data)
    return {"message": f"Auteur modifié dans {source.upper()}"}

@app.delete("/auteurs/{auteur_id}", tags=["CRUD"])
async def delete_auteur(auteur_id: str, source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).delete_auteur(auteur_id)
    return {"message": f"Auteur supprimé de {source.upper()}"}

# ── LIVRE ─────────────────────────────────────────────────────
@app.post("/livres", tags=["CRUD"])
async def create_livre(data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).create_livre(data)
    return {"message": f"Livre créé dans {source.upper()}"}

@app.put("/livres/{isbn}", tags=["CRUD"])
async def update_livre(isbn: str, data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).update_livre(isbn, data)
    return {"message": f"Livre modifié dans {source.upper()}"}

@app.delete("/livres/{isbn}", tags=["CRUD"])
async def delete_livre(isbn: str, source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).delete_livre(isbn)
    return {"message": f"Livre supprimé de {source.upper()}"}

# ── ADHERENT ──────────────────────────────────────────────────
@app.post("/adherents", tags=["CRUD"])
async def create_adherent(data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).create_adherent(data)
    return {"message": f"Adhérent créé dans {source.upper()}"}

@app.put("/adherents/{pid}", tags=["CRUD"])
async def update_adherent(pid: str, data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).update_adherent(pid, data)
    return {"message": f"Adhérent modifié dans {source.upper()}"}

@app.delete("/adherents/{pid}", tags=["CRUD"])
async def delete_adherent(pid: str, source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).delete_adherent(pid)
    return {"message": f"Adhérent supprimé de {source.upper()}"}

# ── ENSEIGNANT ────────────────────────────────────────────────
@app.post("/enseignants", tags=["CRUD"])
async def create_enseignant(data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).create_enseignant(data)
    return {"message": f"Enseignant créé dans {source.upper()}"}

@app.put("/enseignants/{pid}", tags=["CRUD"])
async def update_enseignant(pid: str, data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).update_enseignant(pid, data)
    return {"message": f"Enseignant modifié dans {source.upper()}"}

@app.delete("/enseignants/{pid}", tags=["CRUD"])
async def delete_enseignant(pid: str, source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).delete_enseignant(pid)
    return {"message": f"Enseignant supprimé de {source.upper()}"}

# ── EXEMPLAIRE ────────────────────────────────────────────────
@app.post("/exemplaires", tags=["CRUD"])
async def create_exemplaire(data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).create_exemplaire(data.get("livre_ref") or data.get("livre_id"), data)
    return {"message": f"Exemplaire créé dans {source.upper()}"}

@app.delete("/exemplaires/{eid}", tags=["CRUD"])
async def delete_exemplaire(eid: str, source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).delete_exemplaire(eid)
    return {"message": f"Exemplaire supprimé de {source.upper()}"}

# ── EMPRUNT ───────────────────────────────────────────────────
@app.post("/emprunts", tags=["CRUD"])
async def create_emprunt(data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).create_emprunt(data)
    return {"message": f"Emprunt créé dans {source.upper()}"}

@app.put("/emprunts/{eid}", tags=["CRUD"])
async def update_emprunt(eid: str, data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).update_emprunt(data.get("adherent_id"), data.get("exemplaire_id"), data)
    return {"message": f"Emprunt modifié dans {source.upper()}"}

# ── SUGGESTION ────────────────────────────────────────────────
@app.post("/suggestions", tags=["CRUD"])
async def create_suggestion(data: dict = Body(...), source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).create_suggestion(data)
    return {"message": f"Suggestion créée dans {source.upper()}"}

@app.delete("/suggestions/{sid}", tags=["CRUD"])
async def delete_suggestion(sid: str, source: str = Query("S1", description="S1 | S2 | S3")):
    await get_wrapper(source).delete_suggestion(sid, None)
    return {"message": f"Suggestion supprimée de {source.upper()}"}


# ══════════════════════════════════════════════════════════════
# SQL Query endpoint
# ══════════════════════════════════════════════════════════════
@app.post("/query/sql", tags=["Requêtes"])
async def run_sql_query(data: dict = Body(...)):
    sql = str(data.get("sql", "")).strip()
    if not sql.lower().startswith("select"):
        raise HTTPException(400, "Seules les requêtes SELECT sont autorisées")
    try:
        rows = await s1_crud._fetch_all(sql)
        return {"total": len(rows), "columns": list(rows[0].keys()) if rows else [], "rows": rows}
    except Exception as e:
        raise HTTPException(400, str(e))


# ══════════════════════════════════════════════════════════════
# APPROCHE LAV — Local As View
# ══════════════════════════════════════════════════════════════

@app.get("/lav/schema", tags=["LAV — Local As View"])
def get_lav_schema():
    return lav_schema_info()


@app.post("/lav/query", tags=["LAV — Local As View"])
async def run_lav_query(body: dict = Body(...)):
    entity = body.get("entity", "").upper()
    if not entity:
        raise HTTPException(400, "Le champ 'entity' est requis")

    try:
        result = await lav_query(
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


@app.get("/lav/{entity}", tags=["LAV — Local As View"])
async def get_lav_entity(
    entity: str,
    source:      Optional[str] = Query(None),
    attributes:  Optional[str] = Query(None),
    require_all: Optional[bool]= Query(False),
):
    entity_upper = entity.upper()
    attrs_list = [a.strip() for a in attributes.split(",")] if attributes else None
    sources_list = [source.upper()] if source else None

    try:
        result = await lav_query(
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
