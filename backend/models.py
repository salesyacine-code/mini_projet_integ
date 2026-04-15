from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import date


# ─────────────────────────────────────────
#  AUTEUR
# ─────────────────────────────────────────
class AuteurCreate(BaseModel):
    nom: str
    prenom: str
    nationalite: Optional[str] = None
    date_naissance: Optional[date] = None

class AuteurUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    nationalite: Optional[str] = None
    date_naissance: Optional[date] = None

class Auteur(AuteurCreate):
    auteur_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  THEME
# ─────────────────────────────────────────
class ThemeCreate(BaseModel):
    nom_theme: str

class ThemeUpdate(BaseModel):
    nom_theme: Optional[str] = None

class Theme(ThemeCreate):
    theme_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  LIVRE
# ─────────────────────────────────────────
class LivreCreate(BaseModel):
    isbn: str
    titre: str
    annee_publication: Optional[int] = None
    nb_pages: Optional[int] = None
    editeur: Optional[str] = None
    auteur_id: Optional[int] = None
    theme: Optional[str] = None

class LivreUpdate(BaseModel):
    titre: Optional[str] = None
    annee_publication: Optional[int] = None
    nb_pages: Optional[int] = None
    editeur: Optional[str] = None
    auteur_id: Optional[int] = None
    theme: Optional[str] = None

class Livre(LivreCreate):
    livre_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  EXEMPLAIRE
# ─────────────────────────────────────────
class ExemplaireCreate(BaseModel):
    livre_id: int
    code_barre: str
    etat: Optional[str] = "bon"
    disponibilite: bool = True

class ExemplaireUpdate(BaseModel):
    etat: Optional[str] = None
    disponibilite: Optional[bool] = None

class Exemplaire(ExemplaireCreate):
    exemplaire_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  PERSONNE (super-entité)
# ─────────────────────────────────────────
class PersonneCreate(BaseModel):
    nom: str
    prenom: str
    email: Optional[str] = None
    type: Literal["Adherent", "Enseignant"]

class PersonneUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[str] = None

class Personne(PersonneCreate):
    personne_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  ADHERENT (sous-type)
# ─────────────────────────────────────────
class AdherentCreate(BaseModel):
    nom: str
    prenom: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    date_inscription: Optional[date] = None
    cursus: Optional[str] = None      # ex: "Licence"
    niveau: Optional[str] = None      # ex: "L3"
    annee: Optional[str] = None       # ex: "2024"

class AdherentUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    cursus: Optional[str] = None
    niveau: Optional[str] = None
    annee: Optional[str] = None

class Adherent(AdherentCreate):
    adherent_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  ENSEIGNANT (sous-type)
# ─────────────────────────────────────────
class EnseignantCreate(BaseModel):
    nom: str
    prenom: str
    email: Optional[str] = None
    departement: Optional[str] = None

class EnseignantUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[str] = None
    departement: Optional[str] = None

class Enseignant(EnseignantCreate):
    enseignant_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  EMPRUNT
# ─────────────────────────────────────────
class EmpruntCreate(BaseModel):
    exemplaire_id: int
    adherent_id: int
    date_emprunt: date
    date_retour_prevue: Optional[date] = None
    statut: Optional[str] = "en cours"

class EmpruntUpdate(BaseModel):
    date_retour_prevue: Optional[date] = None
    statut: Optional[str] = None

class Emprunt(EmpruntCreate):
    emprunt_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  SUGGESTION
# ─────────────────────────────────────────
class SuggestionCreate(BaseModel):
    enseignant_id: int
    livre_id: Optional[int] = None      # nullable dans S2
    date_suggestion: Optional[date] = None
    raison: Optional[str] = None

class SuggestionUpdate(BaseModel):
    raison: Optional[str] = None
    date_suggestion: Optional[date] = None

class Suggestion(SuggestionCreate):
    suggestion_id: int
    _source: Optional[str] = None


# ─────────────────────────────────────────
#  Réponse générique avec métadonnées
# ─────────────────────────────────────────
class CRUDResponse(BaseModel):
    success: bool
    source: str
    message: str
    data: Optional[dict] = None
