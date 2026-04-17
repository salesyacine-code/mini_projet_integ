"""
services/lav_definitions.py
═══════════════════════════════════════════════════════════════
Approche LAV — Local As View

Principe : chaque SOURCE LOCALE est décrite comme une VUE
du schéma global. L'inverse de GAV.

Dans GAV : schéma global = UNION des sources
Dans LAV  : chaque source locale = PROJECTION/RESTRICTION
            du schéma global

Concrètement ici, chaque source déclare :
  - quelles entités globales elle couvre
  - quels attributs globaux elle possède  (coverage)
  - quelles contraintes de valeur elle impose (conditions)
  - comment réécrire une requête globale en requête locale

Ces "mappings LAV" permettent au moteur de réécriture
(lav_rewriter.py) de choisir quelles sources interroger
pour répondre à une requête globale donnée.
═══════════════════════════════════════════════════════════════
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Optional


# ──────────────────────────────────────────────────────────────
# Types de base
# ──────────────────────────────────────────────────────────────

@dataclass
class AttributeMapping:
    """
    Décrit comment un attribut global est représenté dans la source.
      global_attr  : nom dans le schéma global   (ex: "titre")
      local_attr   : nom dans la source locale    (ex: "titre_long")
      transform    : fonction de normalisation    (ex: str.strip)
      available    : False si l'attribut est absent de cette source
    """
    global_attr: str
    local_attr:  str
    transform:   Optional[Callable] = None
    available:   bool = True


@dataclass
class LAVSourceView:
    """
    Définition LAV d'une source locale sur une entité globale.

      entity       : entité globale couverte      (ex: "LIVRE")
      source_name  : identifiant de la source     ("S1" | "S2" | "S3")
      description  : description lisible
      attributes   : liste des mappings d'attributs
      conditions   : contraintes implicites de la source
                     (ex: S2 ne contient que les ouvrages avec éditeur)
      completeness : "total" si la source couvre toutes les instances
                     "partial" si elle n'en couvre qu'une partie
      fetch_fn     : référence à la fonction wrapper correspondante
    """
    entity:       str
    source_name:  str
    description:  str
    attributes:   list[AttributeMapping] = field(default_factory=list)
    conditions:   list[str]              = field(default_factory=list)
    completeness: str                    = "partial"   # "total" | "partial"
    fetch_fn:     Optional[Callable]     = None


# ──────────────────────────────────────────────────────────────
# Registre global des vues LAV
# Rempli dynamiquement après import des wrappers
# ──────────────────────────────────────────────────────────────

LAV_REGISTRY: list[LAVSourceView] = []


def register(view: LAVSourceView):
    LAV_REGISTRY.append(view)


def get_views_for(entity: str) -> list[LAVSourceView]:
    """Retourne toutes les vues LAV qui couvrent une entité globale."""
    return [v for v in LAV_REGISTRY if v.entity == entity]


def get_views_for_source(source: str) -> list[LAVSourceView]:
    """Retourne toutes les vues LAV d'une source donnée."""
    return [v for v in LAV_REGISTRY if v.source_name == source]


def get_covered_attributes(entity: str) -> dict[str, list[str]]:
    """
    Pour une entité globale, retourne un dictionnaire
    { attribut_global → [sources qui le couvrent] }
    """
    coverage: dict[str, list[str]] = {}
    for view in get_views_for(entity):
        for attr in view.attributes:
            if attr.available:
                coverage.setdefault(attr.global_attr, []).append(view.source_name)
    return coverage


def build_registry():
    """
    Construit le registre LAV après import des wrappers.
    Appelé une seule fois au démarrage de l'application.
    """
    from wrappers.wrapper_s1 import WrapperS1
    from wrappers.wrapper_s2 import WrapperS2
    from wrappers.wrapper_s3 import WrapperS3

    s1_wrapper = WrapperS1()
    s2_wrapper = WrapperS2()
    s3_wrapper = WrapperS3()

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : AUTEUR
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="AUTEUR",
        source_name="S1",
        description="S1 modélise AUTEUR comme entité propre avec tous ses attributs.",
        completeness="total",
        fetch_fn=s1_wrapper.get_auteurs,
        conditions=["auteur est une personne physique distincte"],
        attributes=[
            AttributeMapping("auteur_id",      "auteur_id"),
            AttributeMapping("nom",            "nom"),
            AttributeMapping("prenom",         "prenom"),
            AttributeMapping("nationalite",    "nationalite"),
            AttributeMapping("date_naissance", "date_naissance"),
        ],
    ))

    register(LAVSourceView(
        entity="AUTEUR",
        source_name="S2",
        description="S2 imbrique les auteurs dans contributeurs[] filtré sur role=auteur.",
        completeness="partial",
        fetch_fn=s2_wrapper.get_auteurs,
        conditions=["role contient 'auteur'", "pas d'ID ni de date de naissance"],
        attributes=[
            AttributeMapping("auteur_id",      "auteur_id",      available=False),
            AttributeMapping("nom",            "nom"),
            AttributeMapping("prenom",         "prenom"),
            AttributeMapping("nationalite",    "nationalite",    available=False),
            AttributeMapping("date_naissance", "date_naissance", available=False),
        ],
    ))

    register(LAVSourceView(
        entity="AUTEUR",
        source_name="S3",
        description="S3 modélise l'auteur comme nœud Writer avec full_name et country.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_auteurs,
        conditions=["full_name est splitté en nom/prenom par le wrapper"],
        attributes=[
            AttributeMapping("auteur_id",      "writer_id"),
            AttributeMapping("nom",            "full_name",   transform=lambda x: x.split(" ",1)[-1] if x else None),
            AttributeMapping("prenom",         "full_name",   transform=lambda x: x.split(" ",1)[0] if x else None),
            AttributeMapping("nationalite",    "country"),
            AttributeMapping("date_naissance", "date_naissance", available=False),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : THEME
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="THEME",
        source_name="S1",
        description="S1 stocke le thème comme attribut categorie dans LIVRE (pas d'entité propre).",
        completeness="partial",
        fetch_fn=s1_wrapper.get_themes,
        conditions=["pas de theme_id", "1 thème max par livre", "valeur texte libre"],
        attributes=[
            AttributeMapping("theme_id",  "theme_id",  available=False),
            AttributeMapping("nom_theme", "categorie", transform=str.lower),
        ],
    ))

    register(LAVSourceView(
        entity="THEME",
        source_name="S2",
        description="S2 stocke le thème comme attribut sujet dans ouvrages.",
        completeness="partial",
        fetch_fn=s2_wrapper.get_themes,
        conditions=["pas de theme_id", "1 thème max par ouvrage"],
        attributes=[
            AttributeMapping("theme_id",  "theme_id",  available=False),
            AttributeMapping("nom_theme", "sujet",     transform=str.lower),
        ],
    ))

    register(LAVSourceView(
        entity="THEME",
        source_name="S3",
        description="S3 modélise Theme comme nœud propre avec un ID réel.",
        completeness="total",
        fetch_fn=s3_wrapper.get_themes,
        conditions=["seule source avec des theme_id persistants"],
        attributes=[
            AttributeMapping("theme_id",  "theme_id"),
            AttributeMapping("nom_theme", "name", transform=str.lower),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : APPARTIENT_THEME
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="APPARTIENT_THEME",
        source_name="S1",
        description="S1 lie un livre à un thème (categorie).",
        completeness="partial",
        fetch_fn=s1_wrapper.get_appartient_theme,
        conditions=[],
        attributes=[
            AttributeMapping("livre_ref", "livre_ref"),
            AttributeMapping("theme_ref", "nom_theme"),
            AttributeMapping("nom_theme", "nom_theme"),
        ],
    ))

    register(LAVSourceView(
        entity="APPARTIENT_THEME",
        source_name="S2",
        description="S2 lie un livre à un thème (sujet).",
        completeness="partial",
        fetch_fn=s2_wrapper.get_appartient_theme,
        conditions=[],
        attributes=[
            AttributeMapping("livre_ref", "livre_ref"),
            AttributeMapping("theme_ref", "nom_theme"),
            AttributeMapping("nom_theme", "nom_theme"),
        ],
    ))

    register(LAVSourceView(
        entity="APPARTIENT_THEME",
        source_name="S3",
        description="S3 lie un livre à un thème via la relation BELONGS_TO.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_appartient_theme,
        conditions=[],
        attributes=[
            AttributeMapping("livre_ref", "livre_ref"),
            AttributeMapping("theme_ref", "nom_theme"),
            AttributeMapping("nom_theme", "nom_theme"),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : LIVRE
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="LIVRE",
        source_name="S1",
        description="S1 est la source principale pour LIVRE avec tous les attributs clés.",
        completeness="partial",
        fetch_fn=s1_wrapper.get_livres,
        conditions=["pas de nb_pages ni editeur dans S1"],
        attributes=[
            AttributeMapping("livre_id",          "livre_id"),
            AttributeMapping("isbn",              "isbn"),
            AttributeMapping("titre",             "titre"),
            AttributeMapping("annee_publication", "annee_publication"),
            AttributeMapping("nb_pages",          "nb_pages",  available=False),
            AttributeMapping("editeur",           "editeur",   available=False),
            AttributeMapping("auteur_id",         "auteur_id"),
        ],
    ))

    register(LAVSourceView(
        entity="LIVRE",
        source_name="S2",
        description="S2 enrichit LIVRE avec editeur, nb_pages via ouvrages.",
        completeness="partial",
        fetch_fn=s2_wrapper.get_livres,
        conditions=["pas d'annee_publication", "nb_pages est un String converti en INT"],
        attributes=[
            AttributeMapping("livre_id",          "livre_id",          available=False),
            AttributeMapping("isbn",              "isbn_ref"),
            AttributeMapping("titre",             "titre_long"),
            AttributeMapping("annee_publication", "annee_publication",  available=False),
            AttributeMapping("nb_pages",          "nbPage",  transform=lambda x: int("".join(c for c in str(x) if c.isdigit())) if x else None),
            AttributeMapping("editeur",           "editeur"),
            AttributeMapping("auteur_id",         "auteur_id",         available=False),
        ],
    ))

    register(LAVSourceView(
        entity="LIVRE",
        source_name="S3",
        description="S3 modélise Book avec year et isbn, lié à Writer via WROTE.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_livres,
        conditions=["year = annee_publication", "pas d'editeur ni nb_pages"],
        attributes=[
            AttributeMapping("livre_id",          "book_id"),
            AttributeMapping("isbn",              "isbn"),
            AttributeMapping("titre",             "title"),
            AttributeMapping("annee_publication", "year"),
            AttributeMapping("nb_pages",          "nb_pages",  available=False),
            AttributeMapping("editeur",           "editeur",   available=False),
            AttributeMapping("auteur_id",         "writer_id"),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : EXEMPLAIRE
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="EXEMPLAIRE",
        source_name="S1",
        description="S1 modélise EXEMPLAIRE comme entité séparée liée à LIVRE.",
        completeness="partial",
        fetch_fn=s1_wrapper.get_exemplaires,
        conditions=["disponibilite est un BOOLEAN SQL"],
        attributes=[
            AttributeMapping("exemplaire_id",  "exemplaire_id"),
            AttributeMapping("livre_ref",      "livre_id"),
            AttributeMapping("code_barre",     "code_barre"),
            AttributeMapping("etat",           "etat"),
            AttributeMapping("disponibilite",  "disponibilite"),
        ],
    ))

    register(LAVSourceView(
        entity="EXEMPLAIRE",
        source_name="S2",
        description="S2 imbrique les exemplaires dans stocks[] au sein de ouvrages.",
        completeness="partial",
        fetch_fn=s2_wrapper.get_exemplaires,
        conditions=["pas d'exemplaire_id", "disponible est une String 'oui'/'non'"],
        attributes=[
            AttributeMapping("exemplaire_id", "exemplaire_id", available=False),
            AttributeMapping("livre_ref",     "isbn_ref"),
            AttributeMapping("code_barre",    "code_barre"),
            AttributeMapping("etat",          "etat"),
            AttributeMapping("disponibilite", "disponible", transform=lambda x: x in ("oui","true","1")),
        ],
    ))

    register(LAVSourceView(
        entity="EXEMPLAIRE",
        source_name="S3",
        description="S3 modélise Copy comme nœud lié à Book via HAS_COPY.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_exemplaires,
        conditions=["status='available' → disponibilite=True", "condition=etat"],
        attributes=[
            AttributeMapping("exemplaire_id", "copy_id"),
            AttributeMapping("livre_ref",     "isbn"),
            AttributeMapping("code_barre",    "barcode"),
            AttributeMapping("etat",          "condition"),
            AttributeMapping("disponibilite", "status", transform=lambda x: x == "available"),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : PERSONNE
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="PERSONNE",
        source_name="S1",
        description="S1 sépare ADHERENT et ENSEIGNANT — union des deux = PERSONNE.",
        completeness="partial",
        fetch_fn=s1_wrapper.get_personnes,
        conditions=["type discriminant déduit de la table d'origine"],
        attributes=[
            AttributeMapping("personne_id", "adherent_id ou enseignant_id"),
            AttributeMapping("nom",         "nom"),
            AttributeMapping("prenom",      "prenom"),
            AttributeMapping("email",       "email"),
            AttributeMapping("type",        "type", transform=lambda t: "Adherent" if t=="adherent" else "Enseignant"),
        ],
    ))

    register(LAVSourceView(
        entity="PERSONNE",
        source_name="S2",
        description="S2 utilise un discriminant 'type' dans adherant (Etudiant/Professeur).",
        completeness="partial",
        fetch_fn=s2_wrapper.get_personnes,
        conditions=["type='Etudiant' → Adherent", "type='Professeur' → Enseignant"],
        attributes=[
            AttributeMapping("personne_id", "_id"),
            AttributeMapping("nom",         "identite.nom"),
            AttributeMapping("prenom",      "identite.prenom"),
            AttributeMapping("email",       "identite.email"),
            AttributeMapping("type",        "type"),
        ],
    ))

    register(LAVSourceView(
        entity="PERSONNE",
        source_name="S3",
        description="S3 sépare Member (Adherent) et Professor (Enseignant) en deux nœuds.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_personnes,
        conditions=["full_name splitté en nom/prenom", "Member→Adherent, Professor→Enseignant"],
        attributes=[
            AttributeMapping("personne_id", "member_id ou prof_id"),
            AttributeMapping("nom",         "full_name", transform=lambda x: x.split(" ",1)[-1] if x else None),
            AttributeMapping("prenom",      "full_name", transform=lambda x: x.split(" ",1)[0] if x else None),
            AttributeMapping("email",       "email"),
            AttributeMapping("type",        "type"),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : ADHERENT
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="ADHERENT",
        source_name="S1",
        description="S1 modélise ADHERENT avec telephone et date_inscription.",
        completeness="partial",
        fetch_fn=s1_wrapper.get_adherents,
        conditions=["cursus/annee absents"],
        attributes=[
            AttributeMapping("personne_id",      "adherent_id"),
            AttributeMapping("telephone",        "telephone"),
            AttributeMapping("date_inscription", "date_inscription"),
            AttributeMapping("cursus",           "cursus",           available=False),
            AttributeMapping("annee",            "annee",            available=False),
        ],
    ))

    register(LAVSourceView(
        entity="ADHERENT",
        source_name="S2",
        description="S2 enrichit ADHERENT avec cursus{niveau,annee} pour type=Etudiant.",
        completeness="partial",
        fetch_fn=s2_wrapper.get_adherents,
        conditions=["telephone/date_inscription absents", "cursus disponible si type=Etudiant"],
        attributes=[
            AttributeMapping("personne_id",      "_id"),
            AttributeMapping("telephone",        "telephone",        available=False),
            AttributeMapping("date_inscription", "date_inscription", available=False),
            AttributeMapping("cursus",           "cursus.niveau"),
            AttributeMapping("annee",            "cursus.annee"),
        ],
    ))

    register(LAVSourceView(
        entity="ADHERENT",
        source_name="S3",
        description="S3 modélise Member sans attributs de cursus ni de contact.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_adherents,
        conditions=["attributs limités à member_id, full_name, email"],
        attributes=[
            AttributeMapping("personne_id",      "member_id"),
            AttributeMapping("telephone",        "telephone",        available=False),
            AttributeMapping("date_inscription", "date_inscription", available=False),
            AttributeMapping("cursus",           "cursus",           available=False),
            AttributeMapping("annee",            "annee",            available=False),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : ENSEIGNANT
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="ENSEIGNANT",
        source_name="S1",
        description="S1 modélise ENSEIGNANT avec departement.",
        completeness="partial",
        fetch_fn=s1_wrapper.get_enseignants,
        conditions=[],
        attributes=[
            AttributeMapping("personne_id", "enseignant_id"),
            AttributeMapping("departement", "departement"),
        ],
    ))

    register(LAVSourceView(
        entity="ENSEIGNANT",
        source_name="S2",
        description="S2 : adherant type=Professeur avec departement.",
        completeness="partial",
        fetch_fn=s2_wrapper.get_enseignants,
        conditions=["type='Professeur' uniquement"],
        attributes=[
            AttributeMapping("personne_id", "_id"),
            AttributeMapping("departement", "departement"),
        ],
    ))

    register(LAVSourceView(
        entity="ENSEIGNANT",
        source_name="S3",
        description="S3 : nœud Professor avec department.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_enseignants,
        conditions=["department → departement (normalisation du nom)"],
        attributes=[
            AttributeMapping("personne_id", "prof_id"),
            AttributeMapping("departement", "department"),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : EMPRUNT
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="EMPRUNT",
        source_name="S1",
        description="S1 modélise EMPRUNT comme entité complète avec statut explicite.",
        completeness="partial",
        fetch_fn=s1_wrapper.get_emprunts,
        conditions=["statut ∈ {en cours, rendu, retard}", "date_retour_prevue peut être NULL"],
        attributes=[
            AttributeMapping("emprunt_id",         "emprunt_id"),
            AttributeMapping("exemplaire_id",      "exemplaire_id"),
            AttributeMapping("personne_id",        "adherent_id"),
            AttributeMapping("date_emprunt",       "date_emprunt"),
            AttributeMapping("date_retour_prevue", "date_retour_prevue"),
            AttributeMapping("statut",             "statut"),
        ],
    ))

    register(LAVSourceView(
        entity="EMPRUNT",
        source_name="S2",
        description="S2 ne modélise pas les emprunts — source vide pour EMPRUNT.",
        completeness="partial",
        fetch_fn=s2_wrapper.get_emprunts,
        conditions=["ABSENT de S2"],
        attributes=[],
    ))

    register(LAVSourceView(
        entity="EMPRUNT",
        source_name="S3",
        description="S3 modélise l'emprunt via relation BORROWED{date,return_date} sur Copy.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_emprunts,
        conditions=["pas d'emprunt_id", "statut déduit de return_date IS NULL"],
        attributes=[
            AttributeMapping("emprunt_id",         "emprunt_id",         available=False),
            AttributeMapping("exemplaire_id",      "copy_id"),
            AttributeMapping("personne_id",        "member_id"),
            AttributeMapping("date_emprunt",       "date"),
            AttributeMapping("date_retour_prevue", "return_date"),
            AttributeMapping("statut",             "return_date", transform=lambda x: "rendu" if x else "en cours"),
        ],
    ))

    # ══════════════════════════════════════════════════════════
    # ENTITÉ GLOBALE : SUGGESTION
    # ══════════════════════════════════════════════════════════

    register(LAVSourceView(
        entity="SUGGESTION",
        source_name="S1",
        description="S1 modélise SUGGESTION comme entité liée à ENSEIGNANT et LIVRE.",
        completeness="partial",
        fetch_fn=s1_wrapper.get_suggestions,
        conditions=["livre_ref toujours présent"],
        attributes=[
            AttributeMapping("suggestion_id",   "suggestion_id"),
            AttributeMapping("personne_id",     "enseignant_id"),
            AttributeMapping("livre_ref",       "livre_id"),
            AttributeMapping("date_suggestion", "date_suggestion"),
            AttributeMapping("raison",          "raison"),
        ],
    ))

    register(LAVSourceView(
        entity="SUGGESTION",
        source_name="S2",
        description="S2 imbrique suggestions[] dans adherant Professeur sans FK vers livre.",
        completeness="partial",
        fetch_fn=s2_wrapper.get_suggestions,
        conditions=["livre_ref toujours NULL", "titre libre non lié"],
        attributes=[
            AttributeMapping("suggestion_id",   "suggestion_id",   available=False),
            AttributeMapping("personne_id",     "_id"),
            AttributeMapping("livre_ref",       "livre_ref",        available=False),
            AttributeMapping("date_suggestion", "date_sugg"),
            AttributeMapping("raison",          "raison"),
        ],
    ))

    register(LAVSourceView(
        entity="SUGGESTION",
        source_name="S3",
        description="S3 modélise la suggestion via relation RECOMMENDS{date,reason}.",
        completeness="partial",
        fetch_fn=s3_wrapper.get_suggestions,
        conditions=["livre_ref = isbn du livre", "reason → raison"],
        attributes=[
            AttributeMapping("suggestion_id",   "suggestion_id",   available=False),
            AttributeMapping("personne_id",     "prof_id"),
            AttributeMapping("livre_ref",       "isbn"),
            AttributeMapping("date_suggestion", "date"),
            AttributeMapping("raison",          "reason"),
        ],
    ))
