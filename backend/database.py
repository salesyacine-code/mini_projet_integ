import os
from contextlib import contextmanager
from dotenv import load_dotenv

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
import pymongo
from neo4j import GraphDatabase

load_dotenv()

# ══════════════════════════════════════════════════════════════
# SOURCE S1 — MySQL
# ══════════════════════════════════════════════════════════════

# Utilisation de pymysql comme driver (vérifie qu'il est installé : pip install pymysql)
_MYSQL_URL = "mysql+pymysql://{user}:{pwd}@{host}:{port}/{db}?charset=utf8mb4".format(
    user=os.getenv("MYSQL_USER", "root"),
    pwd=os.getenv("MYSQL_PASSWORD", ""),
    host=os.getenv("MYSQL_HOST", "localhost"),
    port=os.getenv("MYSQL_PORT", "3306"),
    db=os.getenv("MYSQL_DATABASE", "bibliotheque"),
)

_mysql_engine = create_engine(
    _MYSQL_URL,
    pool_pre_ping=True,  # Vérifie si la connexion est vivante avant de l'utiliser
    pool_size=5,
    max_overflow=10,
    echo=False,
)
_MySQLSession = sessionmaker(bind=_mysql_engine)


@contextmanager
def get_mysql_session() -> Session: # type: ignore
    """Fournit une session SQLAlchemy pour S1 (MySQL)."""
    session = _MySQLSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def mysql_execute(sql: str, params: dict | None = None) -> list[dict]:
    """Exécute une requête SQL sur S1 et retourne une liste de dicts (Style GAV)."""
    with get_mysql_session() as session:
        # Optimisation SQLAlchemy 2.0 : .mappings() transforme directement en dictionnaire
        result = session.execute(text(sql), params or {})
        return [dict(row) for row in result.mappings().all()]


# ══════════════════════════════════════════════════════════════
# SOURCE S2 — MongoDB
# ══════════════════════════════════════════════════════════════

_mongo_client: pymongo.MongoClient | None = None


def get_mongo_db() -> pymongo.database.Database:
    """Retourne le handle vers la base MongoDB S2 (singleton)."""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = pymongo.MongoClient(
            os.getenv("MONGO_URI", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000,
        )
    return _mongo_client[os.getenv("MONGO_DATABASE", "bib")]


# ══════════════════════════════════════════════════════════════
# SOURCE S3 — Neo4j
# ══════════════════════════════════════════════════════════════



# database.py

# ... (gardez vos imports SQLAlchemy et PyMongo)
from neo4j import GraphDatabase, Driver  # <-- On importe Driver ici

# ... (votre code MySQL et MongoDB)

# ══════════════════════════════════════════════════════════════
# SOURCE S3 — Neo4j
# ══════════════════════════════════════════════════════════════

# On utilise Driver (la classe) et non GraphDatabase.driver (la méthode)
_neo4j_driver: Driver | None = None

def get_neo4j_driver() -> Driver:
    global _neo4j_driver
    if _neo4j_driver is None:
        _neo4j_driver = GraphDatabase.driver(
            os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            auth=(
                os.getenv("NEO4J_USER", "neo4j"),
                os.getenv("NEO4J_PASSWORD", "newpassword"),
            ),
        )
    return _neo4j_driver

def neo4j_execute(cypher: str, params: dict | None = None) -> list[dict]:
    driver = get_neo4j_driver()
    with driver.session() as session:
        result = session.run(cypher, params or {})
        return [record.data() for record in result]

# ══════════════════════════════════════════════════════════════
# FERMETURE PROPRE (FastAPI Lifespan)
# ══════════════════════════════════════════════════════════════

def close_all_connections():
    """Ferme proprement tous les pools de connexion."""
    global _mongo_client, _neo4j_driver
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None
    if _neo4j_driver:
        _neo4j_driver.close()
        _neo4j_driver = None
    _mysql_engine.dispose()