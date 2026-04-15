"""
schemas/global_models.py
Modèles Pydantic du schéma global intégré — version finale (10 entités).

Schéma global :
  AUTEUR
  THEME
  APPARTIENT_THEME   ← table de liaison LIVRE ↔ THEME (N-M)
  LIVRE              ← plus de theme_id direct, plus de categorie
  EXEMPLAIRE
  PERSONNE           ← super-entité ISA
  ADHERENT           ← sous-type ISA (personne_id PK+FK)
  ENSEIGNANT         ← sous-type ISA (personne_id PK+FK)
  EMPRUNT            ← personne_id → ADHERENT
  SUGGESTION         ← personne_id → ENSEIGNANT
"""

from __future__ import annotations
from typing import Optional, Literal, List
from pydantic import BaseModel, Field, ConfigDict


class Auteur(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    auteur_id:      Optional[str] = None
    nom:            Optional[str] = None
    prenom:         Optional[str] = None
    nationalite:    Optional[str] = None
    date_naissance: Optional[str] = None
    source:         Optional[str] = Field(None, description="S1 | S2 | S3")


class Theme(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    theme_id:  Optional[str] = None
    nom_theme: Optional[str] = None
    source:    Optional[str] = Field(None, description="S1 | S2 | S3")


class AppartientTheme(BaseModel):
    """Table de liaison LIVRE <-> THEME (relation N-M)."""
    model_config = ConfigDict(from_attributes=True)
    livre_ref:  Optional[str] = None
    theme_ref:  Optional[str] = None
    nom_theme:  Optional[str] = None
    source:     Optional[str] = Field(None, description="S1 | S2 | S3")


class Livre(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    livre_id:          Optional[str]       = None
    isbn:              Optional[str]       = None
    titre:             Optional[str]       = None
    annee_publication: Optional[int]       = None
    nb_pages:          Optional[int]       = None
    editeur:           Optional[str]       = None
    auteur_id:         Optional[str]       = None
    themes:            Optional[List[str]] = Field(default=None, description="Thèmes liés (dénormalisé)")
    source:            Optional[str]       = Field(None, description="S1 | S2 | S3")


class Exemplaire(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    exemplaire_id:  Optional[str]  = None
    livre_ref:      Optional[str]  = None
    code_barre:     Optional[str]  = None
    etat:           Optional[str]  = None
    disponibilite:  Optional[bool] = None
    source:         Optional[str]  = Field(None, description="S1 | S2 | S3")


class Personne(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    personne_id: Optional[str]                               = None
    nom:         Optional[str]                               = None
    prenom:      Optional[str]                               = None
    email:       Optional[str]                               = None
    type:        Optional[Literal["Adherent", "Enseignant"]] = None
    source:      Optional[str]                               = Field(None, description="S1 | S2 | S3")


class Adherent(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    personne_id:      Optional[str] = None
    nom:              Optional[str] = None
    prenom:           Optional[str] = None
    email:            Optional[str] = None
    telephone:        Optional[str] = None
    date_inscription: Optional[str] = None
    cursus:           Optional[str] = None
    annee:            Optional[str] = None
    source:           Optional[str] = Field(None, description="S1 | S2 | S3")


class Enseignant(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    personne_id:  Optional[str] = None
    nom:          Optional[str] = None
    prenom:       Optional[str] = None
    email:        Optional[str] = None
    departement:  Optional[str] = None
    source:       Optional[str] = Field(None, description="S1 | S2 | S3")


class Emprunt(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    emprunt_id:         Optional[str]  = None
    exemplaire_id:      Optional[str]  = None
    personne_id:        Optional[str]  = None
    date_emprunt:       Optional[str]  = None
    date_retour_prevue: Optional[str]  = None
    statut:             Optional[str]  = None
    source:             Optional[str]  = Field(None, description="S1 | S3")


class Suggestion(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    suggestion_id:   Optional[str] = None
    personne_id:     Optional[str] = None
    livre_ref:       Optional[str] = None
    date_suggestion: Optional[str] = None
    raison:          Optional[str] = None
    source:          Optional[str] = Field(None, description="S1 | S2 | S3")


class ListResponse(BaseModel):
    total:         int
    source_counts: dict[str, int] = Field(default_factory=dict)
    data:          list


class HealthStatus(BaseModel):
    s1_mysql:   str
    s2_mongodb: str
    s3_neo4j:   str