"""
services/mediator.py
Médiateur — vues GAV du schéma global v2

10 entités :
  AUTEUR · THEME · APPARTIENT_THEME · LIVRE
  EXEMPLAIRE · PERSONNE · ADHERENT · ENSEIGNANT
  EMPRUNT · SUGGESTION
"""

from __future__ import annotations
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable

from wrappers import s1_wrapper, s2_wrapper, s3_wrapper

logger = logging.getLogger(__name__)


# ── helpers ──────────────────────────────────────────────────

def _safe_call(fn: Callable, src: str) -> list[dict]:
    try:
        return fn()
    except Exception as exc:
        logger.warning("Source %s inaccessible (%s) : %s", src, fn.__name__, exc)
        return []


def _parallel(fns: list[tuple[Callable, str]]) -> list[list[dict]]:
    buf: dict[int, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(_safe_call, fn, src): i for i, (fn, src) in enumerate(fns)}
        for f in as_completed(futures):
            buf[futures[f]] = f.result()
    return [buf[i] for i in range(len(fns))]


def _union(*lists: list[dict]) -> list[dict]:
    out = []
    for lst in lists:
        out.extend(lst)
    return out


def _distinct(lists: list[list[dict]], key_fn: Callable) -> list[dict]:
    seen, out = set(), []
    for lst in lists:
        for item in lst:
            k = key_fn(item)
            if k and k not in seen:
                seen.add(k)
                out.append(item)
    return out


def _count_by_source(items: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        s = item.get("source", "?")
        counts[s] = counts.get(s, 0) + 1
    return counts


# ── VUE AUTEUR ───────────────────────────────────────────────

def view_auteurs(source_filter: str | None = None) -> list[dict]:
    lists = _parallel([
        (s1_wrapper.get_auteurs, "S1"),
        (s2_wrapper.get_auteurs, "S2"),
        (s3_wrapper.get_auteurs, "S3"),
    ])
    if source_filter:
        lists = [[r for r in l if r.get("source") == source_filter] for l in lists]
    def key(r):
        return (str(r.get("nom","") or "").lower().strip(),
                str(r.get("prenom","") or "").lower().strip())
    return _distinct(lists, key)


# ── VUE THEME ────────────────────────────────────────────────

def view_themes(source_filter: str | None = None) -> list[dict]:
    s1, s2, s3 = _parallel([
        (s1_wrapper.get_themes, "S1"),
        (s2_wrapper.get_themes, "S2"),
        (s3_wrapper.get_themes, "S3"),
    ])
    # S3 prioritaire (a des theme_id réels)
    ordered = [s3, s1, s2]
    if source_filter:
        ordered = [[r for r in l if r.get("source") == source_filter] for l in ordered]
    def key(r):
        return str(r.get("nom_theme","") or "").lower().strip()
    return _distinct(ordered, key)


# ── VUE APPARTIENT_THEME ─────────────────────────────────────

def view_appartient_theme(source_filter: str | None = None) -> list[dict]:
    """
    Table de liaison LIVRE ↔ THEME.
    Déduplication sur (livre_ref, nom_theme) pour éviter les doublons
    entre sources pour le même livre.
    """
    lists = _parallel([
        (s1_wrapper.get_appartient_theme, "S1"),
        (s2_wrapper.get_appartient_theme, "S2"),
        (s3_wrapper.get_appartient_theme, "S3"),
    ])
    if source_filter:
        lists = [[r for r in l if r.get("source") == source_filter] for l in lists]
    def key(r):
        lr = str(r.get("livre_ref","") or "").strip()
        nt = str(r.get("nom_theme","") or "").lower().strip()
        return f"{lr}|{nt}"
    # S3 prioritaire (theme_ref réel), puis S1, S2
    s1l, s2l, s3l = lists
    return _distinct([s3l, s1l, s2l], key)


# ── VUE LIVRE ────────────────────────────────────────────────

import concurrent.futures
from wrappers import s1_wrapper, s2_wrapper, s3_wrapper

def _parallel(tasks):
    """Exécute les appels aux wrappers en parallèle pour gagner en performance."""
    with concurrent.futures.ThreadPoolExecutor() as executor:
        
        future_to_source = {executor.submit(task): name for task, name in tasks}
        results = []
        for future in concurrent.futures.as_completed(future_to_source):
            source_name = future_to_source[future]
            try:
                data = future.result()
                results.append(data)
            except Exception as e:
                print(f"Erreur sur la source {source_name}: {e}")
                results.append([]) # Retourne une liste vide en cas d'échec d'une source
        return results

def _union(*lists):
    """Aplatit les listes de listes en une seule liste globale."""
    return [item for sublist in lists for item in sublist]

def view_livres(
    source_filter: str | None = None,
    theme: str | None = None,
    titre: str | None = None,
) -> list[dict]:
    """
    Médiateur GAV : Fusionne, déduplique et filtre les livres de S1, S2 et S3.
    """
    # 1. Récupération parallèle (Reformulation/Unfolding)
    lists = _parallel([
        (s1_wrapper.get_livres, "S1"),
        (s2_wrapper.get_livres, "S2"),
        (s3_wrapper.get_livres, "S3"),
    ])
    
    all_items = _union(*lists)

    # 2. Déduplication et Fusion (Le "cerveau" du médiateur)
    isbn_map: dict[str, dict] = {}
    no_isbn: list[dict] = []

    for item in all_items:
        isbn = item.get("isbn")
        
        # Initialisation de la liste des sources contributrices
        if "sources" not in item:
            item["sources"] = [item.get("source")]

        if not isbn:
            no_isbn.append(item)
            continue

        if isbn not in isbn_map:
            # Nouveau livre découvert
            isbn_map[isbn] = item
            # S'assurer que 'themes' est une liste
            if not isinstance(item.get("themes"), list):
                item["themes"] = [item["themes"]] if item.get("themes") else []
        else:
            # Le livre existe déjà (fusion des données)
            existing = isbn_map[isbn]
            
            # Fusion des sources
            if item.get("source") not in existing["sources"]:
                existing["sources"].append(item.get("source"))

            # Fusion des thèmes (en évitant les doublons)
            new_themes = item.get("themes") or []
            if isinstance(new_themes, str): new_themes = [new_themes]
            
            current_themes = existing.get("themes") or []
            merged_themes = list({t.lower().strip() for t in (current_themes + new_themes) if t})
            existing["themes"] = merged_themes

            # Enrichissement des champs optionnels
            for field in ["nb_pages", "editeur", "auteur_id"]:
                if not existing.get(field) and item.get(field):
                    existing[field] = item[field]

    # Regroupement final
    items = list(isbn_map.values()) + no_isbn

    # 3. Filtrage global
    if source_filter:
        # On vérifie si la source est dans la liste des sources contributrices
        items = [r for r in items if source_filter.upper() in (r.get("sources") or [])]
    
    if theme:
        items = [r for r in items 
                 if any(theme.lower() in t.lower() for t in (r.get("themes") or []))]
    
    if titre:
        items = [r for r in items 
                 if titre.lower() in str(r.get("titre") or "").lower()]

    return items

def view_livre_by_isbn(isbn: str) -> list[dict]:
    fns = [
        (lambda: s1_wrapper.get_livre_by_isbn(isbn), "S1"),
        (lambda: s2_wrapper.get_livre_by_isbn(isbn), "S2"),
        (lambda: s3_wrapper.get_livre_by_isbn(isbn), "S3"),
    ]
    lists = _parallel(fns)
    items = _union(*lists)
    return items[:1] if items else []


# ── VUE EXEMPLAIRE ───────────────────────────────────────────

def view_exemplaires(
    source_filter: str | None = None,
    disponible_only: bool = False,
) -> list[dict]:
    if disponible_only:
        fns = [(s1_wrapper.get_exemplaires_disponibles, "S1"),
               (s2_wrapper.get_exemplaires_disponibles, "S2"),
               (s3_wrapper.get_exemplaires_disponibles, "S3")]
    else:
        fns = [(s1_wrapper.get_exemplaires, "S1"),
               (s2_wrapper.get_exemplaires, "S2"),
               (s3_wrapper.get_exemplaires, "S3")]
    lists = _parallel(fns)
    items = _union(*lists)
    if source_filter:
        items = [r for r in items if r.get("source") == source_filter]
    return items


def view_exemplaires_by_livre(livre_ref: str) -> list[dict]:
    return [e for e in view_exemplaires() if e.get("livre_ref") == livre_ref]


# ── VUE PERSONNE ─────────────────────────────────────────────

def view_personnes(
    source_filter: str | None = None,
    type_filter: str | None = None,
) -> list[dict]:
    lists = _parallel([(s1_wrapper.get_personnes, "S1"),
                        (s2_wrapper.get_personnes, "S2"),
                        (s3_wrapper.get_personnes, "S3")])
    items = _union(*lists)
    if source_filter:
        items = [r for r in items if r.get("source") == source_filter]
    if type_filter:
        items = [r for r in items if r.get("type") == type_filter]
    return items


# ── VUE ADHERENT ─────────────────────────────────────────────

def view_adherents(source_filter: str | None = None) -> list[dict]:
    lists = _parallel([(s1_wrapper.get_adherents, "S1"),
                        (s2_wrapper.get_adherents, "S2"),
                        (s3_wrapper.get_adherents, "S3")])
    items = _union(*lists)
    if source_filter:
        items = [r for r in items if r.get("source") == source_filter]
    return items


# ── VUE ENSEIGNANT ───────────────────────────────────────────

def view_enseignants(source_filter: str | None = None) -> list[dict]:
    lists = _parallel([(s1_wrapper.get_enseignants, "S1"),
                        (s2_wrapper.get_enseignants, "S2"),
                        (s3_wrapper.get_enseignants, "S3")])
    items = _union(*lists)
    if source_filter:
        items = [r for r in items if r.get("source") == source_filter]
    return items


# ── VUE EMPRUNT  (S1 + S3 uniquement) ────────────────────────

def view_emprunts(
    source_filter: str | None = None,
    en_cours_only: bool = False,
) -> list[dict]:
    if en_cours_only:
        fns = [(s1_wrapper.get_emprunts_en_cours, "S1"),
               (s3_wrapper.get_emprunts_en_cours, "S3")]
    else:
        fns = [(s1_wrapper.get_emprunts, "S1"),
               (s3_wrapper.get_emprunts, "S3")]
    lists = _parallel(fns)
    items = _union(*lists)
    if source_filter:
        items = [r for r in items if r.get("source") == source_filter]
    return items


# ── VUE SUGGESTION ───────────────────────────────────────────

def view_suggestions(source_filter: str | None = None) -> list[dict]:
    lists = _parallel([(s1_wrapper.get_suggestions, "S1"),
                        (s2_wrapper.get_suggestions, "S2"),
                        (s3_wrapper.get_suggestions, "S3")])
    items = _union(*lists)
    if source_filter:
        items = [r for r in items if r.get("source") == source_filter]
    return items


# ── HEALTH ───────────────────────────────────────────────────

def check_health() -> dict[str, str]:
    status: dict[str, str] = {}
    try:
        from database import mysql_execute
        mysql_execute("SELECT 1")
        status["s1_mysql"] = "OK"
    except Exception as e:
        status["s1_mysql"] = f"ERROR: {e}"
    try:
        from database import get_mongo_db
        get_mongo_db().command("ping")
        status["s2_mongodb"] = "OK"
    except Exception as e:
        status["s2_mongodb"] = f"ERROR: {e}"
    try:
        from database import neo4j_execute
        neo4j_execute("RETURN 1")
        status["s3_neo4j"] = "OK"
    except Exception as e:
        status["s3_neo4j"] = f"ERROR: {e}"
    return status