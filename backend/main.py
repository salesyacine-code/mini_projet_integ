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