"""
main.py — Point d'entrée FastAPI
Bibliothèque — Système de médiation de données hétérogènes

Chaque endpoint d'écriture (POST / PUT / DELETE) accepte un paramètre
query ?source=S1|S2|S3 qui indique dans quelle source physique écrire.
Les lectures (GET) fusionnent automatiquement les 3 sources.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Literal, Optional
from datetime import date

from database import get_s1_pool, close_s1, close_s2, close_s3
from services.mediator import Mediator
from models import (
    AuteurCreate, AuteurUpdate,
    ThemeCreate, ThemeUpdate,
    LivreCreate, LivreUpdate,
    ExemplaireCreate, ExemplaireUpdate,
    AdherentCreate, AdherentUpdate,
    EnseignantCreate, EnseignantUpdate,
    EmpruntCreate, EmpruntUpdate,
    SuggestionCreate, SuggestionUpdate,
    CRUDResponse,
)

Source = Literal["S1", "S2", "S3"]


# ════════════════════════════════════════════════════════════
#  Lifecycle — init / teardown des connexions
# ════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_s1_pool()     # préchauffe le pool MySQL
    yield
    close_s1()
    close_s2()
    close_s3()


app = FastAPI(
    title="Bibliothèque — API de médiation",
    description="CRUD sur 3 sources hétérogènes (MySQL, MongoDB, Neo4j) via un médiateur GAV.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

mediator = Mediator()


# ════════════════════════════════════════════════════════════
#  AUTEUR
# ════════════════════════════════════════════════════════════
@app.get("/auteurs", tags=["Auteur"], summary="Lire tous les auteurs (3 sources fusionnées)")
async def get_auteurs():
    return await mediator.get_auteurs()

@app.post("/auteurs", tags=["Auteur"], response_model=CRUDResponse)
async def create_auteur(
    body: AuteurCreate,
    source: Source = Query(..., description="Source cible : S1, S2 ou S3")
):
    return await mediator.create_auteur(source, body.model_dump())

@app.put("/auteurs/{auteur_id}", tags=["Auteur"], response_model=CRUDResponse)
async def update_auteur(
    auteur_id: str,
    body: AuteurUpdate,
    source: Source = Query(...)
):
    return await mediator.update_auteur(source, auteur_id, body.model_dump(exclude_none=True))

@app.delete("/auteurs/{auteur_id}", tags=["Auteur"], response_model=CRUDResponse)
async def delete_auteur(
    auteur_id: str,
    source: Source = Query(...)
):
    return await mediator.delete_auteur(source, auteur_id)


# ════════════════════════════════════════════════════════════
#  THEME
# ════════════════════════════════════════════════════════════
@app.get("/themes", tags=["Thème"], summary="Lire tous les thèmes (3 sources fusionnées)")
async def get_themes():
    return await mediator.get_themes()

@app.post("/themes", tags=["Thème"], response_model=CRUDResponse)
async def create_theme(
    body: ThemeCreate,
    source: Source = Query(...)
):
    return await mediator.create_theme(source, body.model_dump())

@app.put("/themes/{theme_id}", tags=["Thème"], response_model=CRUDResponse)
async def update_theme(
    theme_id: str,
    body: ThemeUpdate,
    source: Source = Query(...)
):
    return await mediator.update_theme(source, theme_id, body.model_dump(exclude_none=True))

@app.delete("/themes/{theme_id}", tags=["Thème"], response_model=CRUDResponse)
async def delete_theme(
    theme_id: str,
    source: Source = Query(...)
):
    return await mediator.delete_theme(source, theme_id)


# ════════════════════════════════════════════════════════════
#  LIVRE
# ════════════════════════════════════════════════════════════
@app.get("/livres", tags=["Livre"], summary="Lire tous les livres (3 sources fusionnées)")
async def get_livres():
    return await mediator.get_livres()

@app.post("/livres", tags=["Livre"], response_model=CRUDResponse)
async def create_livre(
    body: LivreCreate,
    source: Source = Query(...)
):
    return await mediator.create_livre(source, body.model_dump())

@app.put("/livres/{isbn}", tags=["Livre"], response_model=CRUDResponse)
async def update_livre(
    isbn: str,
    body: LivreUpdate,
    source: Source = Query(...)
):
    return await mediator.update_livre(source, isbn, body.model_dump(exclude_none=True))

@app.delete("/livres/{isbn}", tags=["Livre"], response_model=CRUDResponse)
async def delete_livre(
    isbn: str,
    source: Source = Query(...)
):
    return await mediator.delete_livre(source, isbn)


# ════════════════════════════════════════════════════════════
#  EXEMPLAIRE
# ════════════════════════════════════════════════════════════
@app.get("/exemplaires", tags=["Exemplaire"])
async def get_exemplaires():
    return await mediator.get_exemplaires()

@app.post("/exemplaires", tags=["Exemplaire"], response_model=CRUDResponse)
async def create_exemplaire(
    body: ExemplaireCreate,
    source: Source = Query(...),
    isbn: Optional[str] = Query(None, description="Requis pour S2 et S3")
):
    data = body.model_dump()
    if isbn:
        data["isbn"] = isbn
    return await mediator.create_exemplaire(source, data)

@app.put("/exemplaires/{exemplaire_id}", tags=["Exemplaire"], response_model=CRUDResponse)
async def update_exemplaire(
    exemplaire_id: str,
    body: ExemplaireUpdate,
    source: Source = Query(...)
):
    return await mediator.update_exemplaire(source, exemplaire_id, body.model_dump(exclude_none=True))

@app.delete("/exemplaires/{exemplaire_id}", tags=["Exemplaire"], response_model=CRUDResponse)
async def delete_exemplaire(
    exemplaire_id: str,
    source: Source = Query(...),
    isbn: Optional[str] = Query(None, description="Requis pour S2")
):
    return await mediator.delete_exemplaire(source, exemplaire_id, isbn)


# ════════════════════════════════════════════════════════════
#  ADHERENT
# ════════════════════════════════════════════════════════════
@app.get("/adherents", tags=["Adhérent"])
async def get_adherents():
    return await mediator.get_adherents()

@app.post("/adherents", tags=["Adhérent"], response_model=CRUDResponse)
async def create_adherent(
    body: AdherentCreate,
    source: Source = Query(...)
):
    return await mediator.create_adherent(source, body.model_dump())

@app.put("/adherents/{adherent_id}", tags=["Adhérent"], response_model=CRUDResponse)
async def update_adherent(
    adherent_id: str,
    body: AdherentUpdate,
    source: Source = Query(...)
):
    return await mediator.update_adherent(source, adherent_id, body.model_dump(exclude_none=True))

@app.delete("/adherents/{adherent_id}", tags=["Adhérent"], response_model=CRUDResponse)
async def delete_adherent(
    adherent_id: str,
    source: Source = Query(...)
):
    return await mediator.delete_adherent(source, adherent_id)


# ════════════════════════════════════════════════════════════
#  ENSEIGNANT
# ════════════════════════════════════════════════════════════
@app.get("/enseignants", tags=["Enseignant"])
async def get_enseignants():
    return await mediator.get_enseignants()

@app.post("/enseignants", tags=["Enseignant"], response_model=CRUDResponse)
async def create_enseignant(
    body: EnseignantCreate,
    source: Source = Query(...)
):
    return await mediator.create_enseignant(source, body.model_dump())

@app.put("/enseignants/{enseignant_id}", tags=["Enseignant"], response_model=CRUDResponse)
async def update_enseignant(
    enseignant_id: str,
    body: EnseignantUpdate,
    source: Source = Query(...)
):
    return await mediator.update_enseignant(source, enseignant_id, body.model_dump(exclude_none=True))

@app.delete("/enseignants/{enseignant_id}", tags=["Enseignant"], response_model=CRUDResponse)
async def delete_enseignant(
    enseignant_id: str,
    source: Source = Query(...)
):
    return await mediator.delete_enseignant(source, enseignant_id)


# ════════════════════════════════════════════════════════════
#  EMPRUNT  (S1 + S3 — absent de S2)
# ════════════════════════════════════════════════════════════
@app.get("/emprunts", tags=["Emprunt"], summary="Lire tous les emprunts (S1 + S3)")
async def get_emprunts():
    return await mediator.get_emprunts()

@app.post("/emprunts", tags=["Emprunt"], response_model=CRUDResponse)
async def create_emprunt(
    body: EmpruntCreate,
    source: Source = Query(..., description="S1 ou S3 uniquement (S2 absent)")
):
    return await mediator.create_emprunt(source, body.model_dump())

@app.put("/emprunts/{emprunt_id}", tags=["Emprunt"], response_model=CRUDResponse)
async def update_emprunt(
    emprunt_id: str,
    body: EmpruntUpdate,
    source: Source = Query(...)
):
    return await mediator.update_emprunt(source, emprunt_id, body.model_dump(exclude_none=True))

@app.delete("/emprunts/{emprunt_id}", tags=["Emprunt"], response_model=CRUDResponse)
async def delete_emprunt(
    emprunt_id: str,
    source: Source = Query(...),
    adherent_id: Optional[str] = Query(None, description="Requis pour S3"),
    exemplaire_id: Optional[str] = Query(None, description="Requis pour S3")
):
    data = {}
    if adherent_id:
        data["adherent_id"] = adherent_id
    if exemplaire_id:
        data["exemplaire_id"] = exemplaire_id
    return await mediator.delete_emprunt(source, emprunt_id, data)


# ════════════════════════════════════════════════════════════
#  SUGGESTION
# ════════════════════════════════════════════════════════════
@app.get("/suggestions", tags=["Suggestion"])
async def get_suggestions():
    return await mediator.get_suggestions()

@app.post("/suggestions", tags=["Suggestion"], response_model=CRUDResponse)
async def create_suggestion(
    body: SuggestionCreate,
    source: Source = Query(...)
):
    return await mediator.create_suggestion(source, body.model_dump())

@app.put("/suggestions/{suggestion_id}", tags=["Suggestion"], response_model=CRUDResponse)
async def update_suggestion(
    suggestion_id: str,
    body: SuggestionUpdate,
    source: Source = Query(..., description="Mise à jour uniquement supportée par S1")
):
    return await mediator.update_suggestion(source, suggestion_id, body.model_dump(exclude_none=True))

@app.delete("/suggestions/{suggestion_id}", tags=["Suggestion"], response_model=CRUDResponse)
async def delete_suggestion(
    suggestion_id: str,
    source: Source = Query(...),
    enseignant_id: Optional[str] = Query(None, description="Requis pour S2 et S3"),
    livre_id: Optional[str] = Query(None, description="Requis pour S3"),
    titre: Optional[str] = Query(None, description="Requis pour S2")
):
    data = {}
    if enseignant_id: data["enseignant_id"] = enseignant_id
    if livre_id:      data["livre_id"]      = livre_id
    if titre:         data["titre"]         = titre
    return await mediator.delete_suggestion(source, suggestion_id, data)


# ════════════════════════════════════════════════════════════
#  Santé
# ════════════════════════════════════════════════════════════
@app.get("/health", tags=["Système"])
async def health():
    return {"status": "ok", "sources": ["S1 (MySQL)", "S2 (MongoDB)", "S3 (Neo4j)"]}



def _count_by_source(items: list) -> dict:
    counts = {"S1": 0, "S2": 0, "S3": 0}
    for item in items:
        # On suppose que vos objets médiateur ont un champ 'source' ou 'provenance'
        src = item.get("source") or item.get("provenance")
        if src in counts:
            counts[src] += 1
    return counts

@app.get("/stats", tags=["Système"], summary="Statistiques globales des sources fusionnées")
async def get_stats():
    """
    Récupère les statistiques de comptage en interrogeant le médiateur.
    """
    async def _safe_fetch(coro):
        try:
            items = await coro
            return {
                "total": len(items), 
                "par_source": _count_by_source(items)
            }
        except Exception as e:
            return {"total": 0, "erreur": str(e)}

    return {
        "auteurs":      await _safe_fetch(mediator.get_auteurs()),
        "themes":       await _safe_fetch(mediator.get_themes()),
        "livres":       await _safe_fetch(mediator.get_livres()),
        "exemplaires":  await _safe_fetch(mediator.get_exemplaires()),
        "adherents":    await _safe_fetch(mediator.get_adherents()),
        "enseignants":  await _safe_fetch(mediator.get_enseignants()),
        "emprunts":     await _safe_fetch(mediator.get_emprunts()),
        "suggestions":  await _safe_fetch(mediator.get_suggestions()),
    }