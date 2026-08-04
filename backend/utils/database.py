import asyncpg
import json
import os
from zoneinfo import ZoneInfo
from datetime import datetime, date
from typing import Optional, Dict, List, Any, Coroutine
from dotenv import load_dotenv


load_dotenv()

# ---------------------------------------------------------------------------
# Database configuration
# ---------------------------------------------------------------------------

DB_CONFIG = {
    'host':     os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'ocr_db'),
    'user':     os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', ''),
    'port':     int(os.getenv('DB_PORT') or 5432),
}

pool = None

tz = ZoneInfo('Asia/Tashkent')


# ---------------------------------------------------------------------------
# Pool lifecycle
# ---------------------------------------------------------------------------

async def init_db_pool() -> None:
    """
    Initialize database connection pool and create tables.
    """
    global pool
    pool = await asyncpg.create_pool(**DB_CONFIG, min_size=5, max_size=20)

    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS ocr_requests (
                id                      SERIAL PRIMARY KEY,
                request_ip_address      INET,
                unique_job_id           TEXT NOT NULL UNIQUE,
                
                request_type            TEXT NOT NULL CHECK(request_type IN('url', 'file')),
                
                source_url              TEXT,
                source_url_status       INTEGER,
                
                file_hash               TEXT,
                filename                TEXT,
                file_extension          TEXT,
                mime_type               TEXT,
                
                file_size               BIGINT,
                page_count              INTEGER,
                
                language                TEXT,
                
                status                  TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'success', 'failed')),
                
                extracted_text          TEXT,
                extracted_length        INTEGER,
                
                created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                duration                BIGINT,
                finished_at             TIMESTAMPTZ
                
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              SERIAL PRIMARY KEY,
                user_id         TEXT NOT NULL UNIQUE,
                username        TEXT NOT NULL UNIQUE,
                first_name      TEXT NOT NULL,
                last_name       TEXT NOT NULL,
                department      TEXT NOT NULL,
                language        TEXT NOT NULL CHECK (language IN('ru', 'en', 'uz_c', 'uz_l')),
                password        TEXT NOT NULL,
                is_active       BOOLEAN NOT NULL DEFAULT TRUE,
                is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id              SERIAL PRIMARY KEY,
                user_id         TEXT NOT NULL,
                session_id      TEXT NOT NULL UNIQUE,
                ip_address      INET,
                status          TEXT NOT NULL CHECK (status IN ('active', 'expired', 'logged_out')),
                last_login      TIMESTAMPTZ,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expire_time     TIMESTAMPTZ,

                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_actions(
                id              SERIAL PRIMARY KEY,
                user_id         TEXT NOT NULL,
                unique_job_id   TEXT NOT NULL UNIQUE,
                session_id      TEXT NOT NULL,
                ip_address      INET,
                action          TEXT NOT NULL,
                action_status   TEXT NOT NULL CHECK (action_status IN ('success', 'failed')),
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE CASCADE
            )
        """)


async def close_db_pool() -> None:
    """Gracefully close the connection pool."""
    global pool
    if pool:
        await pool.close()
        pool = None



# ----------------------------------------------------------------------------------------------------------------------
# user auth
# ----------------------------------------------------------------------------------------------------------------------

async def create_superuser(user_id: str, username: str, first_name: str, last_name: str, department: str, language: str,
                           password: str, is_active: bool, is_admin: bool, created_at: datetime) -> bool:
    """Create a new superuser."""
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO users (user_id, username, first_name, last_name, department, language, password, is_active, is_admin, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """,
                user_id, username, first_name, last_name, department, language, password, is_active, is_admin,
                created_at
            )
        return True
    except asyncpg.UniqueViolationError:
        return False


async def get_user(username: str) -> Optional[dict]:
    """Fetch a single user."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT user_id, username, first_name, last_name, department, language, password, is_active, is_admin, created_at
            FROM users
            WHERE username = $1
            """,
            username,
        )

    return {"user_id": row["user_id"],
            "username": row["username"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "department": row["department"],
            "language": row["language"],
            "password": row["password"],
            "is_active": row["is_active"],
            "is_admin": row["is_admin"],
            "created_at": row["created_at"]
            } if row else None


async def get_user_id(user_id: str) -> Optional[dict]:
    """Fetch a single user."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT user_id, username, first_name, last_name, department, language, password, is_active, is_admin, created_at
            FROM users
            WHERE user_id = $1
            """,
            user_id,
        )

    return {"user_id": row["user_id"],
            "username": row["username"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "department": row["department"],
            "language": row["language"],
            "password": row["password"],
            "is_active": row["is_active"],
            "is_admin": row["is_admin"],
            "created_at": row["created_at"]
            } if row else None


async def create_user_session(user_id: str, session_id: str, ip_address: str, status: str, last_login: datetime,
                              created_at: datetime, expire_time: datetime) -> bool:
    """Create a new user session."""
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_sessions (user_id, session_id, ip_address, status, last_login, created_at, expire_time)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                user_id, session_id, ip_address, status, last_login, created_at, expire_time
            )
        return True
    except asyncpg.UniqueViolationError:
        return False


async def get_session(session_id: str) -> Optional[dict]:
    """Fetch a single session."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT user_id, session_id, ip_address, status, created_at, expire_time
            FROM user_sessions
            WHERE session_id = $1
            """,
            session_id,
        )

    return {"user_id": row["user_id"],
            "session_id": row["session_id"],
            "ip_address": row["ip_address"],
            "status": row["status"],
            "created_at": row["created_at"],
            "expire_time": row["expire_time"],
            } if row else None


async def logout_user_session(session_id: str) -> bool:
    """Logout a user session."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE user_sessions SET status = 'logged_out' WHERE session_id = $1",
            session_id,
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False


async def expire_user_session(session_id: str) -> bool:
    """Expire a user session."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE user_sessions SET status = 'expired' WHERE session_id = $1",
            session_id,
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False



# ----------------------------------------------------------------------------------------------------------------------
# user data
# ----------------------------------------------------------------------------------------------------------------------

async def edit_user_language(language: str, username: str) -> bool:
    """Edit a user language."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE users SET language = $1 WHERE  username = $2",
            language, username
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False


async def edit_user_details(username: str, first_name: str, last_name: str, department: str, language: str,
                            is_active: bool, is_admin: bool, user_id: str) -> bool:
    """Edit a user details."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE users SET username = $1, first_name = $2, last_name = $3, department = $4,"
            "language = $5, is_active = $6, is_admin = $7 WHERE user_id = $8",
            username, first_name, last_name, department, language, is_active, is_admin, user_id
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False


async def edit_user_password(user_id: str, password: str) -> bool:
    """Edit a user password."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE users SET password = $2 WHERE user_id = $1",
            user_id, password
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False


async def add_new_user(user_id: str, username: str, first_name: str, last_name: str, department: str, language: str,
                       password: str, is_active: bool, is_admin: bool, created_at: datetime):
    """Add a new user."""
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO users (user_id, username, first_name, last_name, department, language, password, is_active, is_admin, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """,
                user_id, username, first_name, last_name, department, language, password, is_active, is_admin,
                created_at
            )
        return True
    except asyncpg.UniqueViolationError:
        return False


async def delete_user(user_id: str) -> Optional[int]:
    """Delete user from the database."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM users WHERE user_id = $1",
            user_id,
        )
    affected = int(result.split()[-1])
    return affected if affected > 0 else None


async def get_all_users():
    """Fetch all users."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT user_id, username, first_name, last_name, department, language, password, is_active, is_admin, created_at
            FROM users
            ORDER BY is_admin DESC
            """
        )
    return [dict(row) for row in rows]



# ----------------------------------------------------------------------------------------------------------------------
# user sessions
# ----------------------------------------------------------------------------------------------------------------------

async def get_all_sessions_data():
    """Fetch alls sessions."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT 
                s.user_id,
                s.session_id,
                s.ip_address,
                s.status,
                s.last_login,
                s.created_at,
                s.expire_time,

                u.username,
                u.first_name,
                u.last_name
            FROM user_sessions s
            JOIN users u ON u.user_id = s.user_id
            ORDER BY s.created_at DESC    
            """
        )

    return [dict(row) for row in rows]


async def delete_session(session_id: str):
    """Delete session from the database."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM user_sessions WHERE session_id = $1",
            session_id,
        )
    affected = int(result.split()[-1])
    return affected if affected > 0 else None


async def edit_session_status(session_id: str, status: str, expire_time: datetime) -> bool:
    """Edit session details."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE user_sessions SET status = $2, expire_time = $3 WHERE session_id = $1",
            session_id, status, expire_time
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False



# ----------------------------------------------------------------------------------------------------------------------
# user actions
# ----------------------------------------------------------------------------------------------------------------------

async def get_all_actions_data():
    """Fetch all actions."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                ua.user_id,
                ua.session_id,
                ua.unique_job_id,
                u.username,
                u.first_name,
                u.last_name,
                u.department,
                ua.ip_address,
                ua.action,
                ua.action_status,
                ua.created_at
            FROM user_actions ua
            JOIN users u
                ON ua.user_id = u.user_id
            ORDER BY ua.created_at DESC
            """
        )

    return [dict(row) for row in rows]


async def get_single_action_data(unique_job_id: str):
    """Fetch single action."""
    """Fetch a single session."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT user_id, unique_job_id, session_id, ip_address, action, action_status, created_at
            FROM user_actions
            WHERE unique_job_id = $1
            """,
            unique_job_id,
        )

    return {"user_id": row["user_id"],
            "unique_job_id": row["unique_job_id"],
            "session_id": row["session_id"],
            "ip_address": row["ip_address"],
            "action": row["action"],
            "action_status": row["action_status"],
            "created_at": row["created_at"]
            } if row else None


async def delete_single_action(unique_job_id: str):
    """Delete single action."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM user_actions WHERE unique_job_id = $1",
            unique_job_id,
        )
    affected = int(result.split()[-1])
    return affected if affected > 0 else None


async def add_action_data(user_id, unique_job_id, session_id, ip_address, action, action_status, created_at):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_actions (user_id, unique_job_id, session_id, ip_address, action, action_status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            user_id, unique_job_id, session_id, ip_address, action, action_status, created_at
        )
    return True


async def edit_action_status(unique_job_id: str, status: str):
    """Edit user actions status."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE user_actions SET action_status = $2 WHERE unique_job_id = $1",
            unique_job_id, status
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False



# ----------------------------------------------------------------------------------------------------------------------
# ocr
# ----------------------------------------------------------------------------------------------------------------------

async def get_all_ocr_data():

    """Fetch all ocr data."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
                SELECT
                    request_ip_address,
                    unique_job_id,
                    request_type,
                    source_url,
                    source_url_status,
                    file_hash,
                    filename,
                    file_extension,
                    mime_type,
                    file_size,
                    page_count,
                    language,
                    status,
                    extracted_text, 
                    extracted_length,
                    created_at,
                    duration,
                    finished_at
                FROM ocr_requests
                ORDER BY created_at DESC           
            """
        )
    return [dict(row) for row in rows]


async def get_single_ocr_data(unique_job_id: str):
    """Fetch single ocr data."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT request_ip_address, unique_job_id, request_type, source_url, source_url_status,
              file_hash, filename, file_extension, mime_type, file_size,
              page_count, language, status, extracted_text, extracted_length,
              created_at, duration, finished_at
            FROM ocr_requests
            WHERE unique_job_id = $1
            """,
            unique_job_id,
        )

    if row is None:
        return None

    return dict(row)


async def delete_single_ocr_data(unique_job_id: str):
    """Delete single ocr data."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM ocr_requests WHERE unique_job_id = $1",
            unique_job_id,
        )
    affected = int(result.split()[-1])
    return affected if affected > 0 else None


async def add_ocr_data(request_ip_address, unique_job_id, request_type, source_url, source_url_status,
              file_hash, filename, file_extension, mime_type, file_size,
              status, created_at):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_actions (request_ip_address, unique_job_id, request_type, source_url, source_url_status,
              file_hash, filename, file_extension, mime_type, file_size,
              status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """,
            request_ip_address, unique_job_id, request_type, source_url, source_url_status,
            file_hash, filename, file_extension, mime_type, file_size,
            status, created_at
        )
    return True


async def edit_ocr_status(unique_job_id: str, status: str):
    """Edit user ocr status."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE ocr_requests SET ocr_status = $2 WHERE unique_job_id = $1",
            unique_job_id, status
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False


async def update_ocr_data(unique_job_id: str, page_count, language, status, extracted_text, extracted_length, duration, finished_at):
    """Update user ocr data."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE ocr_requests SET page_count=$2, language=$3, status=$4, extracted_text=$5, extracted_length=$6, duration=$7, finished_at=$8 WHERE unique_job_id=$1",
            unique_job_id, page_count, language, status, extracted_text, extracted_length, duration, finished_at
        )
    affected = int(result.split()[-1])  # asyncpg returns e.g. "UPDATE 1"
    return True if affected > 0 else False