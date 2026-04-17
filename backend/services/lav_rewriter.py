"""
services/lav_rewriter.py
═══════════════════════════════════════════════════════════════
Moteur de réécriture LAV (Local As View)

Principe LAV :
  Une requête globale Q sur le schéma global S est réécrite
  en un ensemble de requêtes locales Q1..Qn, une par source
  capable de répondre partiellement à Q.

  Le résultat final est l'UNION (ou la JOINTURE) des résultats
  locaux, après application des transformations définies dans
  les LAVSourceViews.

Algorithme implémenté :
  1. ANALYSE    — identifier les attributs demandés + filtres
  2. SÉLECTION  — choisir les sources capables de répondre
                  (celles qui couvrent les attributs requis)
  3. RÉÉCRITURE — construire une requête adaptée à chaque source
  4. EXÉCUTION  — appeler chaque source en parallèle
  5. FUSION     — UNION + déduplication sur clé sémantique
  6. COMPLÉTION — enrichir les tuples incomplets depuis d'autres sources

Différence clé avec GAV :
  - GAV : on appelle TOUJOURS toutes les sources puis on fusionne
  - LAV : on sélectionne UNIQUEMENT les sources pertinentes
          selon les attributs et filtres de la requête
═══════════════════════════════════════════════════════════════
"""

from __future__ import annotations
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from services.lav_definitions import (
    LAVSourceView, LAV_REGISTRY,
    get_views_for, get_covered_attributes, build_registry,
)

logger = logging.getLogger(__name__)

_REGISTRY_BUILT = False


def _ensure_registry():
    global _REGISTRY_BUILT
    if not _REGISTRY_BUILT:
        build_registry()
        _REGISTRY_BUILT = True


# ──────────────────────────────────────────────────────────────
# Structures de requête LAV
# ──────────────────────────────────────────────────────────────

@dataclass
class LAVQuery:
    """
    Représentation d'une requête sur le schéma global.

      entity       : entité globale ciblée  (ex: "LIVRE")
      attributes   : attributs souhaités    (None = tous)
      filters      : dict { attr → valeur } (ex: {"disponibilite": True})
      sources      : forcer certaines sources (None = automatique)
      require_all  : si True, exclure les tuples où un attribut
                     demandé est NULL (jointure stricte)
    """
    entity:      str
    attributes:  Optional[list[str]] = None
    filters:     dict[str, Any]      = field(default_factory=dict)
    sources:     Optional[list[str]] = None
    require_all: bool                = False


@dataclass
class LAVResult:
    """Résultat d'une exécution LAV."""
    entity:        str
    rows:          list[dict]
    source_counts: dict[str, int]
    sources_used:  list[str]
    sources_skipped: list[str]
    coverage_map:  dict[str, list[str]]   # attr → sources qui l'ont fourni
    plan:          list[str]              # log des étapes de réécriture
    total:         int = 0

    def __post_init__(self):
        self.total = len(self.rows)


# ──────────────────────────────────────────────────────────────
# Moteur de réécriture
# ──────────────────────────────────────────────────────────────

class LAVRewriter:
    """
    Moteur principal LAV.
    Réécrit une LAVQuery en appels locaux et fusionne les résultats.
    """

    # ── Étape 1 : Analyse ────────────────────────────────────

    def _analyze(self, query: LAVQuery) -> dict:
        """
        Analyse la requête : quels attributs sont demandés,
        quels filtres sont actifs, quels attributs nécessitent
        une source précise.
        """
        views = get_views_for(query.entity)
        coverage = get_covered_attributes(query.entity)

        # Attributs demandés (ou tous si None)
        requested = query.attributes or list(coverage.keys())

        # Pour chaque attribut demandé : quelles sources peuvent le fournir
        attr_sources: dict[str, list[str]] = {}
        for attr in requested:
            providers = coverage.get(attr, [])
            attr_sources[attr] = providers

        # Attributs dans les filtres : sources capables de filtrer
        filter_attrs = list(query.filters.keys())

        return {
            "requested_attrs": requested,
            "filter_attrs":    filter_attrs,
            "attr_sources":    attr_sources,
            "all_views":       views,
            "coverage":        coverage,
        }

    # ── Étape 2 : Sélection des sources ──────────────────────

    def _select_sources(self, query: LAVQuery, analysis: dict) -> list[LAVSourceView]:
        """
        Sélectionne les sources à interroger.

        Logique LAV :
          - Si sources forcées dans la query → utiliser celles-là
          - Sinon, sélectionner les sources qui couvrent AU MOINS
            UN attribut demandé OU un attribut de filtre.
          - Exclure les sources dont les conditions sont incompatibles
            avec les filtres.
        """
        if query.sources:
            return [v for v in analysis["all_views"] if v.source_name in query.sources]

        selected = []
        requested = set(analysis["requested_attrs"])
        filter_set = set(analysis["filter_attrs"])

        for view in analysis["all_views"]:
            covered = {a.global_attr for a in view.attributes if a.available}

            # La source est utile si elle couvre au moins un attribut demandé
            if covered & (requested | filter_set):
                # Vérification des conditions d'incompatibilité
                if self._is_compatible(view, query.filters):
                    selected.append(view)

        return selected

    def _is_compatible(self, view: LAVSourceView, filters: dict) -> bool:
        """
        Vérifie que la source est compatible avec les filtres.
        Ex: S2 ne peut pas filtrer sur emprunt (absent).
        """
        for condition in view.conditions:
            if "ABSENT" in condition and filters:
                return False  # source vide pour cette entité
        return True

    # ── Étape 3 : Réécriture ─────────────────────────────────

    def _rewrite(self, view: LAVSourceView, query: LAVQuery) -> Callable:
        """
        Produit une fonction d'appel adaptée à la source.
        Applique les filtres post-fetch si la source ne les supporte pas.
        """
        def local_query():
            if view.fetch_fn is None:
                return []
            rows = view.fetch_fn()

            # Application des filtres
            for attr, value in query.filters.items():
                rows = [r for r in rows if self._matches(r, attr, value)]

            # Projection sur les attributs demandés (+ source toujours gardé)
            if query.attributes:
                keep = set(query.attributes) | {"source", "auteur_id",
                                                 "livre_ref", "personne_id",
                                                 "exemplaire_id", "emprunt_id",
                                                 "suggestion_id", "theme_id"}
                rows = [{k: v for k, v in r.items() if k in keep} for r in rows]

            return rows

        return local_query

    def _matches(self, row: dict, attr: str, value: Any) -> bool:
        """Évalue si un tuple satisfait un filtre."""
        v = row.get(attr)
        if isinstance(value, bool):
            return bool(v) == value
        if isinstance(value, str):
            return str(v or "").lower() == value.lower()
        return v == value

    # ── Étape 4 : Exécution parallèle ────────────────────────

    def _execute(self, rewrites: list[tuple[LAVSourceView, Callable]]) -> dict[str, list[dict]]:
        """Exécute toutes les requêtes locales en parallèle."""
        results: dict[str, list[dict]] = {}

        def safe_run(view, fn):
            try:
                return view.source_name, fn()
            except Exception as e:
                logger.warning("LAV — Source %s erreur : %s", view.source_name, e)
                return view.source_name, []

        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {pool.submit(safe_run, v, fn): v.source_name for v, fn in rewrites}
            for future in as_completed(futures):
                src, rows = future.result()
                results[src] = rows

        return results

    # ── Étape 5 : Fusion + déduplication ─────────────────────

    def _merge(
        self,
        entity: str,
        results: dict[str, list[dict]],
        require_all: bool,
        requested_attrs: list[str],
    ) -> list[dict]:
        """
        UNION des résultats locaux avec déduplication sémantique.

        Clés de déduplication par entité :
          LIVRE       → isbn
          AUTEUR      → (nom, prenom)
          THEME       → nom_theme
          EXEMPLAIRE  → code_barre
          PERSONNE    → email
          ADHERENT    → email
          ENSEIGNANT  → email
          EMPRUNT     → (exemplaire_id, personne_id, date_emprunt)
          SUGGESTION  → (personne_id, livre_ref, date_suggestion)
        """
        KEY_FNS = {
            "LIVRE":      lambda r: r.get("isbn"),
            "AUTEUR":     lambda r: (str(r.get("nom","")).lower(), str(r.get("prenom","")).lower()),
            "THEME":      lambda r: str(r.get("nom_theme","")).lower().strip(),
            "EXEMPLAIRE": lambda r: r.get("code_barre"),
            "PERSONNE":   lambda r: str(r.get("email","")).lower(),
            "ADHERENT":   lambda r: str(r.get("email","") or r.get("personne_id","")).lower(),
            "ENSEIGNANT": lambda r: str(r.get("email","") or r.get("personne_id","")).lower(),
            "EMPRUNT":    lambda r: (r.get("exemplaire_id"), r.get("personne_id"), r.get("date_emprunt")),
            "SUGGESTION": lambda r: (r.get("personne_id"), r.get("livre_ref"), r.get("date_suggestion")),
        }
        key_fn = KEY_FNS.get(entity, lambda r: id(r))

        # Fusion avec enrichissement inter-sources
        merged: dict[Any, dict] = {}
        for src in ("S1", "S2", "S3"):      # S1 prioritaire pour les conflits
            for row in results.get(src, []):
                k = key_fn(row)
                if k is None:
                    k = id(row)
                if k not in merged:
                    merged[k] = dict(row)
                else:
                    # Enrichissement LAV : compléter les champs NULL
                    for attr, val in row.items():
                        if val is not None and merged[k].get(attr) is None:
                            merged[k][attr] = val

        rows = list(merged.values())

        # Filtre require_all : exclure si attribut demandé manquant
        if require_all and requested_attrs:
            rows = [
                r for r in rows
                if all(r.get(a) is not None for a in requested_attrs)
            ]

        return rows

    # ── Étape 6 : Production du plan de réécriture ───────────

    def _build_plan(
        self,
        query: LAVQuery,
        selected: list[LAVSourceView],
        skipped: list[LAVSourceView],
        analysis: dict,
    ) -> list[str]:
        plan = [
            f"LAV Query — entité : {query.entity}",
            f"Attributs demandés : {', '.join(query.attributes or ['*'])}",
            f"Filtres actifs : {query.filters or 'aucun'}",
            "─────────────────────────────────",
        ]

        for view in selected:
            covered = {a.global_attr for a in view.attributes if a.available}
            missing = set(analysis["requested_attrs"]) - covered
            plan.append(
                f"✓ {view.source_name} — {view.description}"
            )
            if missing:
                plan.append(
                    f"   └─ attributs non couverts par {view.source_name} : {', '.join(missing)}"
                )
            if view.conditions:
                plan.append(f"   └─ conditions : {' · '.join(view.conditions)}")

        for view in skipped:
            plan.append(f"✗ {view.source_name} IGNORÉE — ne couvre aucun attribut pertinent")

        plan.append("─────────────────────────────────")
        plan.append(
            f"Stratégie de fusion : UNION + déduplication"
            + (" + require_all" if query.require_all else "")
        )
        return plan

    # ── Point d'entrée principal ──────────────────────────────

    def execute(self, query: LAVQuery) -> LAVResult:
        """
        Exécute une requête LAV complète.
        Retourne un LAVResult avec les données et les métadonnées
        de réécriture.
        """
        _ensure_registry()

        # 1. Analyse
        analysis = self._analyze(query)

        # 2. Sélection
        all_views = analysis["all_views"]
        selected  = self._select_sources(query, analysis)
        skipped   = [v for v in all_views if v not in selected]

        # 3. Réécriture
        rewrites = [(v, self._rewrite(v, query)) for v in selected]

        # 4. Exécution parallèle
        raw_results = self._execute(rewrites)

        # 5. Fusion
        rows = self._merge(
            entity=query.entity,
            results=raw_results,
            require_all=query.require_all,
            requested_attrs=analysis["requested_attrs"],
        )

        # 6. Plan
        plan = self._build_plan(query, selected, skipped, analysis)

        # Statistiques par source
        source_counts: dict[str, int] = {}
        for src, src_rows in raw_results.items():
            if src_rows:
                source_counts[src] = len(src_rows)

        return LAVResult(
            entity=query.entity,
            rows=rows,
            source_counts=source_counts,
            sources_used=[v.source_name for v in selected],
            sources_skipped=[v.source_name for v in skipped],
            coverage_map=analysis["attr_sources"],
            plan=plan,
        )


# ──────────────────────────────────────────────────────────────
# Instance globale du moteur
# ──────────────────────────────────────────────────────────────

rewriter = LAVRewriter()


# ──────────────────────────────────────────────────────────────
# API publique simplifiée
# ──────────────────────────────────────────────────────────────

def lav_query(
    entity:      str,
    attributes:  Optional[list[str]] = None,
    filters:     dict[str, Any]      = None,
    sources:     Optional[list[str]] = None,
    require_all: bool                = False,
) -> LAVResult:
    """
    Point d'entrée principal de l'approche LAV.

    Exemples :
      # Tous les livres
      lav_query("LIVRE")

      # Livres avec isbn et editeur (S2 sera sélectionnée pour editeur)
      lav_query("LIVRE", attributes=["isbn","titre","editeur","nb_pages"])

      # Exemplaires disponibles seulement
      lav_query("EXEMPLAIRE", filters={"disponibilite": True})

      # Auteurs depuis S1 uniquement
      lav_query("AUTEUR", sources=["S1"])
    """
    q = LAVQuery(
        entity=entity,
        attributes=attributes,
        filters=filters or {},
        sources=sources,
        require_all=require_all,
    )
    return rewriter.execute(q)


def lav_schema_info() -> dict:
    """
    Retourne la description complète du schéma LAV :
    pour chaque entité globale, quelles sources la couvrent
    et quels attributs sont disponibles où.
    """
    _ensure_registry()
    info: dict = {}
    entities = sorted({v.entity for v in LAV_REGISTRY})
    for entity in entities:
        coverage = get_covered_attributes(entity)
        views    = get_views_for(entity)
        info[entity] = {
            "sources": [
                {
                    "source": v.source_name,
                    "description": v.description,
                    "completeness": v.completeness,
                    "conditions": v.conditions,
                    "attributes_available": [
                        a.global_attr for a in v.attributes if a.available
                    ],
                    "attributes_missing": [
                        a.global_attr for a in v.attributes if not a.available
                    ],
                }
                for v in views
            ],
            "attribute_coverage": {
                attr: srcs for attr, srcs in coverage.items()
            },
        }
    return info
