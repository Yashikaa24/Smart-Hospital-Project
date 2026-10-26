import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback to SQLite if DATABASE_URL is not set
if not SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./hospital.db"

# Check if SQLite is used
is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

# Add check_same_thread for SQLite
connect_args = {"check_same_thread": False} if is_sqlite else {}

try:
    if not is_sqlite and "mysql" in SQLALCHEMY_DATABASE_URL:
        # Try to auto-create MySQL database if it doesn't exist
        try:
            base_url, db_name = SQLALCHEMY_DATABASE_URL.rsplit("/", 1)
            if "?" in db_name:
                db_name = db_name.split("?", 1)[0]
            temp_engine = create_engine(base_url)
            from sqlalchemy import text
            with temp_engine.connect() as conn:
                conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {db_name}"))
            temp_engine.dispose()
            print(f"MySQL Database '{db_name}' ensured to exist.")
        except Exception as e:
            print(f"MySQL database auto-creation failed: {e}. Attempting standard connection...")
            
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
    # Test connection
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"Failed to connect to database using {SQLALCHEMY_DATABASE_URL}: {e}")
    print("Falling back to SQLite (sqlite:///./hospital.db)...")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./hospital.db"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
