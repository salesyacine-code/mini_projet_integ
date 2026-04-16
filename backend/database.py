"""
database.py
Gère les connexions aux 3 sources :
  - S1 : MySQL via aiomysql (async)
  - S2 : MongoDB via motor (async)
  - S3 : Neo4j via neo4j (driver officiel, exécution dans threadpool)
"""

import asyncio
import os
from typing import Optional

# ── S1 : MySQL ────────────────────────────────────────────
import aiomysql

# ── S2 : MongoDB ──────────────────────────────────────────
from  motor.motor_asyncio import AsyncIOMotorClient

# ── S3 : Neo4j ────────────────────────────────────────────
from neo4j import GraphDatabase


# ════════════════════════════════════════════════════════════
#  Configuration (à surcharger avec variables d'environnement)
# ════════════════════════════════════════════════════════════
S1_CONFIG = {
    "host":     os.getenv("S1_HOST",     "localhost"),
    "port":     int(os.getenv("S1_PORT", "3306")),
    "user":     os.getenv("S1_USER",     "root"),
    "password": os.getenv("S1_PASSWORD", ""),
    "db":       os.getenv("S1_DB",       "bibliotheque"),
    "autocommit": True,
}

S2_URI  = os.getenv("S2_URI",  "mongodb://localhost:27017")
S2_DB   = os.getenv("S2_DB",   "bib")

S3_URI  = os.getenv("S3_URI",  "neo4j://localhost:7687")
S3_USER = os.getenv("S3_USER", "neo4j")
S3_PASS = os.getenv("S3_PASS", "newpassword")


# ════════════════════════════════════════════════════════════
#  S1 — MySQL  (pool de connexions)
# ════════════════════════════════════════════════════════════
_s1_pool: Optional[aiomysql.Pool] = None

async def get_s1_pool() -> aiomysql.Pool:
    global _s1_pool
    if _s1_pool is None:
        _s1_pool = await aiomysql.create_pool(**S1_CONFIG)
    return _s1_pool

async def close_s1():
    global _s1_pool
    if _s1_pool:
        _s1_pool.close()
        await _s1_pool.wait_closed()
        _s1_pool = None


# ════════════════════════════════════════════════════════════
#  S2 — MongoDB
# ════════════════════════════════════════════════════════════
_s2_client: Optional[AsyncIOMotorClient] = None

def get_s2_db():
    global _s2_client
    if _s2_client is None:
        _s2_client = AsyncIOMotorClient(S2_URI)
    return _s2_client[S2_DB]

def close_s2():
    global _s2_client
    if _s2_client:
        _s2_client.close()
        _s2_client = None


# ════════════════════════════════════════════════════════════
#  S3 — Neo4j  (driver synchrone — exécuté via run_in_executor)
# ════════════════════════════════════════════════════════════
_s3_driver = None

def get_s3_driver():
    global _s3_driver
    if _s3_driver is None:
        _s3_driver = GraphDatabase.driver(S3_URI, auth=(S3_USER, S3_PASS))
    return _s3_driver

def close_s3():
    global _s3_driver
    if _s3_driver:
        _s3_driver.close()
        _s3_driver = None

async def run_s3_query(query: str, params: dict = None):
    """Exécute une requête Cypher dans un threadpool pour ne pas bloquer asyncio."""
    driver = get_s3_driver()
    loop = asyncio.get_event_loop()

    def _run():
        with driver.session() as session:
            result = session.run(query, params or {})
            return [dict(r) for r in result]

    return await loop.run_in_executor(None, _run)

async def run_s3_write(query: str, params: dict = None):
    """Exécute une requête Cypher d'écriture (CREATE / MERGE / SET / DELETE)."""
    driver = get_s3_driver()
    loop = asyncio.get_event_loop()

    def _run():
        with driver.session() as session:
            result = session.run(query, params or {})
            return result.consume().counters.__dict__

    return await loop.run_in_executor(None, _run)
