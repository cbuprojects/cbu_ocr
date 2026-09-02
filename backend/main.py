import os
import uuid
import logging
import time
from datetime import date, datetime, timedelta
import pandas as pd
from pathlib import Path
import zipfile
from typing import Dict, Optional
import shutil
import asyncio
from uuid import uuid4
import io
import filetype

from pydantic import BaseModel
from passlib.context import CryptContext
import hmac
import hashlib
import secrets
from zoneinfo import ZoneInfo
from io import BytesIO
from pypdf import PdfReader
from functools import partial
import random
from fastapi import FastAPI, UploadFile, HTTPException, Form, BackgroundTasks, Request, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse

from utils.database import (init_db_pool, close_db_pool,
                            create_superuser, create_user_session, get_session, logout_user_session, expire_user_session,
                            edit_user_language, add_new_user, get_user, get_user_id, get_all_users, edit_user_details,
                            edit_user_password, delete_user,
                            get_all_sessions_data, edit_session_status, delete_session,
                            add_action_data, get_all_actions_data, delete_single_action, get_single_action_data,
                            get_all_ocr_data, get_single_ocr_data, delete_single_ocr_data,
                            add_ocr_data, edit_ocr_status, update_ocr_data,
                            check_ocr_file_hash_existence)
from utils.ocr_set import initialize_paddle_ocr


# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),                          # stdout
        logging.FileHandler("logs/app.log", encoding="utf-8") # persistent log file
    ]
)

logger = logging.getLogger("cbu_api")

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title='Cbu OCR APIs', docs_url='/', redoc_url=None)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# origins = [
#     "https://ocr.cbu.uz"
# ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Timezone
# ---------------------------------------------------------------------------

tz = ZoneInfo("Asia/Tashkent")


# ---------------------------------------------------------------------------
# Request timing middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    logger.info("➡️  %s %s  (client=%s)", request.method, request.url.path, request.client.host)
    response = await call_next(request)
    elapsed = (time.perf_counter() - start) * 1000
    logger.info(
        "⬅️  %s %s → %s  (%.1f ms)",
        request.method, request.url.path, response.status_code, elapsed
    )
    return response



# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting CBU API…")
    await init_db_pool()
    logger.info("✅ DB pool initialized!")

    # await create_admin_user()

    logger.info("OCR is being initialized...🔎")
    app.state.ocr_pipeline = initialize_paddle_ocr()
    app.state.ocr_semaphore = asyncio.Semaphore(1)
    logger.info("✅ Startup complete: OCR is initialized!")



@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Shutdown signal received — closing DB pool…")
    await close_db_pool()
    logger.info("✅ Shutdown complete: DB pool closed")


# ----------------------------------------------------------------------------------------------------------------------
# Admin auth
# ----------------------------------------------------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["argon2"],deprecated="auto")
psd = str(os.getenv("PD"))
ad = str(os.getenv("AD"))
fs = str(os.getenv("FS"))
ls = str(os.getenv("LS"))
dp = str(os.getenv("DP"))
l = str(os.getenv("L"))
iad = os.getenv("IAD", "false").lower() == "true"
ias = os.getenv("IAC", "false").lower() == "true"

async def create_admin_user():
    token = secrets.token_hex(64)
    await create_superuser(token, ad, fs, ls, dp, l, hs_pd(token), ias, iad, datetime.now(tz))

def hs_pd(token: str) -> str:
    hmac_result = hmac.new(token.encode(), psd.encode(), hashlib.sha256).hexdigest()
    return pwd_context.hash(hmac_result)



# ----------------------------------------------------------------------------------------------------------------------
# User auth
# ----------------------------------------------------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login_api(request: Request, data: LoginRequest):
    user = await get_user(data.username)
    if not user:
        raise HTTPException(401, "Invalid username!")

    if not verify_password(user_id=user['user_id'], password=data.password, hashed_password=user['password']):
        raise HTTPException(401, "Invalid credentials")

    session_data = create_session_token()
    # ip_address = request.client.host
    ip_address = request.headers.get("x-real-ip")
    if not ip_address:
        raise HTTPException(401, "Not valid user, not authenticated!")

    await create_user_session(user['user_id'], session_data['session_id'], ip_address,
                       'active', datetime.now(tz), datetime.now(tz), datetime.now(tz) + timedelta(minutes=60))

    unique_job_id = uuid.uuid4().hex[:12]
    await add_action_data(user_id=user['user_id'], session_id=session_data['session_id'], ip_address=ip_address,
                          unique_job_id=unique_job_id, action='Logged in', action_status='success', created_at=datetime.now(tz))

    return {"session_id": session_data['token']}


def verify_password(user_id: str, password: str, hashed_password: str) -> bool:
    password = hmac.new(user_id.encode(), password.encode(), hashlib.sha256).hexdigest()
    return pwd_context.verify(password, hashed_password)


def create_session_token():
    token = secrets.token_urlsafe(64)
    session_id = hashlib.sha256(token.encode()).hexdigest()
    return {'token': token, 'session_id': session_id}


async def get_current_user(request: Request):

    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(401, "Not authenticated")

    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid authorization header")

    session_id = authorization.split(" ", 1)[1]

    # ip_address = request.client.host
    # if not ip_address:
    #     raise HTTPException(401, "Not valid user, not authenticated!")

    ip_address = request.headers.get("x-real-ip")
    if not ip_address:
        raise HTTPException(401, "Not valid user, not authenticated!")

    hashed_session_id = hashlib.sha256(session_id.encode()).hexdigest()
    session = await get_session(hashed_session_id)

    # Session existence check
    if not session:
        raise HTTPException(401, "Invalid session!")

    # Session status check
    if session["status"] != "active":
        raise HTTPException(401, "Session is not valid!")

    # Session expired
    if session["expire_time"] < datetime.now(tz):
        await expire_user_session(hashed_session_id)
        raise HTTPException(401, "Session expired")

    if str(ip_address) != str(session["ip_address"]):
        await logout_user_session(hashed_session_id)
        raise HTTPException(403, "IP address is not valid!")

    user = await get_user_id(session["user_id"])

    # User deleted
    if not user:
        await logout_user_session(hashed_session_id)
        raise HTTPException(401, "User does not exist")

    # User blocked/inactive
    if not user["is_active"]:
        await logout_user_session(hashed_session_id)
        raise HTTPException(403, "User account is disabled!")

    return {'user': user,
            'session_id': session["session_id"]}


@app.post("/api/logout")
async def logout_api(user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    session_id = user_session_data['session_id']
    if not user:
        raise HTTPException(401, "Not authenticated!")

    await logout_user_session(session_id)

    user_session = await get_session(session_id)
    unique_job_id = uuid.uuid4().hex[:12]
    await add_action_data(user_id=user['user_id'], session_id=session_id, ip_address=user_session['ip_address'],
                          unique_job_id=unique_job_id, action='Logged out', action_status='success',
                          created_at=datetime.now(tz))

    return {'status': "Logged out successfully!"}



# ----------------------------------------------------------------------------------------------------------------------
# user data
# ----------------------------------------------------------------------------------------------------------------------

@app.put("/api/update_language", tags=["User Language"])
async def update_language_api(language: str, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("update_language | language=%s   username=%s", language, user['username'])
    if not language:
        logger.warning("update_language | Missing language parameter")
        raise HTTPException(status_code=400, detail="Language parameter is required")

    user_language_updated = await edit_user_language(language, user['username'])
    if not user_language_updated:
        logger.warning("update_language | User language edit failed")
        raise HTTPException(status_code=400, detail="Language does not exist")

    user_session = await get_session(user_session_data['session_id'])
    unique_job_id = uuid.uuid4().hex[:12]
    await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'], ip_address=user_session['ip_address'],
                          unique_job_id=unique_job_id, action=f'Changed language', action_status='success',
                          created_at=datetime.now(tz))

    return {"Status": 'Success', 'user': {
        'user_id': user['user_id'],
        'username': user['username'],
        'first_name': user['first_name'],
        'last_name': user['last_name'],
        'department': user['department'],
        'language': language,
        'is_active': user['is_active'],
        'is_admin': user['is_admin']
    }}


class UserData(BaseModel):
    username: str
    first_name: str
    last_name: str
    department: str
    language: str
    password: str
    is_active: bool
    is_admin: bool
@app.post("/api/add_user", tags=["Add User"])
async def add_user_api(data: UserData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("add_user | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    user_exists = await get_user(username=data.username)
    if user_exists:
        raise HTTPException(403, "User already exists!")

    if data.language not in ['ru', 'en', 'uz_c', 'uz_l']:
        raise HTTPException(403, "Language does not exist!")

    user_id = secrets.token_hex(64)
    hmac_result = hmac.new(user_id.encode(), data.password.encode(), hashlib.sha256).hexdigest()
    password_hash = pwd_context.hash(hmac_result)

    user_session = await get_session(user_session_data['session_id'])
    unique_job_id = uuid.uuid4().hex[:12]

    added_new_user = await add_new_user(user_id, data.username, data.first_name, data.last_name, data.department,
                       data.language, password_hash, data.is_active, data.is_admin, datetime.now(tz))
    if not added_new_user:
        await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                              ip_address=user_session['ip_address'],
                              unique_job_id=unique_job_id, action='Added user', action_status='failed',
                              created_at=datetime.now(tz))
        raise HTTPException(403, "Could not add new user!")


    await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'], ip_address=user_session['ip_address'],
                          unique_job_id=unique_job_id, action='Added user', action_status='success',
                          created_at=datetime.now(tz))

    return {'status': "Success", 'data': 'Added successfully!'}


@app.get("/api/get_all_users", tags=["Get All Users"])
async def get_all_users_api(user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("get_all_users | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    all_users = await get_all_users()
    if not all_users:
        raise HTTPException(403, "No users found!")

    return {'status': "Success", 'admin': user, 'users': all_users}


class UserEditData(BaseModel):
    user_id: str
    username: str
    first_name: str
    last_name: str
    department: str
    language: str
    is_active: bool
    is_admin: bool
@app.put("/api/edit_user_details", tags=["Edit User_details"])
async def edit_user_details_api(data: UserEditData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("edit_user_details | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    user_exists = await get_user_id(data.user_id)
    if not user_exists:
        raise HTTPException(403, "User does not exist!")

    if data.language not in ['ru', 'en', 'uz_c', 'uz_l']:
        raise HTTPException(403, "Language does not exist!")

    edited_user = await edit_user_details(username=data.username,
                                          first_name=data.first_name,
                                          last_name=data.last_name,
                                          department=data.department,
                                          language=data.language,
                                          is_active=data.is_active,
                                          is_admin=data.is_admin,
                                          user_id=data.user_id)

    user_session = await get_session(user_session_data['session_id'])
    unique_job_id = uuid.uuid4().hex[:12]

    if not edited_user:
        await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                              ip_address=user_session['ip_address'],
                              unique_job_id=unique_job_id, action='Edited user details', action_status='failed',
                              created_at=datetime.now(tz))
        raise HTTPException(403, "Could not edit user details!")

    await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                          ip_address=user_session['ip_address'],
                          unique_job_id=unique_job_id, action='Edited user details', action_status='success',
                          created_at=datetime.now(tz))

    return {'status': "Success", 'data': edited_user}


class UserEditPasswordData(BaseModel):
    user_id: str
    password: str
@app.put("/api/edit_user_password", tags=["Edit Password"])
async def edit_user_password_api(data: UserEditPasswordData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("edit_user_password | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    user_data = await get_user_id(data.user_id)
    if not user_data:
        raise HTTPException(403, "User does not exist!")

    hmac_result = hmac.new(data.user_id.encode(), data.password.encode(), hashlib.sha256).hexdigest()
    hashed_password = pwd_context.hash(hmac_result)

    user_session = await get_session(user_session_data['session_id'])
    unique_job_id = uuid.uuid4().hex[:12]

    edited_user = await edit_user_password(data.user_id, hashed_password)
    if not edited_user:
        await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                              ip_address=user_session['ip_address'],
                              unique_job_id=unique_job_id, action='Edited user password', action_status='failed',
                              created_at=datetime.now(tz))
        raise HTTPException(403, "Could not edit user password!")

    await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                          ip_address=user_session['ip_address'],
                          unique_job_id=unique_job_id, action='Edited user password', action_status='success',
                          created_at=datetime.now(tz))

    return {'status': "Success", 'data': 'Edited successfully!'}


class DeleteUserData(BaseModel):
    user_id: str
    username: str
@app.delete("/api/delete_user", tags=["Delete User"])
async def delete_user_api(data: DeleteUserData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("delete_user | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    user_exists = await get_user_id(data.user_id)
    if not user_exists:
        raise HTTPException(403, "User does not exist!")

    user_session = await get_session(user_session_data['session_id'])
    unique_job_id = uuid.uuid4().hex[:12]

    deleted_user = await delete_user(data.user_id)
    if not deleted_user:
        await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                              ip_address=user_session['ip_address'],
                              unique_job_id=unique_job_id, action='Deleted user', action_status='failed',
                              created_at=datetime.now(tz))
        raise HTTPException(403, "Could not delete user details!")

    await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                          ip_address=user_session['ip_address'],
                          unique_job_id=unique_job_id, action='Deleted user', action_status='success',
                          created_at=datetime.now(tz))

    return {'status': "Success", 'data': 'Deleted successfully!'}



# ----------------------------------------------------------------------------------------------------------------------
# user sessions
# ----------------------------------------------------------------------------------------------------------------------

@app.get("/api/get_all_users_sessions", tags=["Get All Users Sessions"])
async def get_all_users_sessions_api(user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("get_all_users_sessions | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    all_sessions_data = await get_all_sessions_data()
    if not all_sessions_data:
        return {'status': "Failed", 'admin': user, 'data': all_sessions_data}

    return {'status': "Success", 'admin': user, 'data': all_sessions_data}


class EditSessionStatusData(BaseModel):
    session_id: str
    status: str
    expire_time: datetime
@app.put('/api/edit_session_details', tags=["Edit Session Details"])
async def edit_session_status_api(data: EditSessionStatusData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("edit_session_status | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    session_existence = await get_session(data.session_id)
    if not session_existence:
        raise HTTPException(403, "Session does not exist!")

    edited_session_status = await edit_session_status(data.session_id, data.status, data.expire_time)
    if not edited_session_status:
        raise HTTPException(403, "Could not edit session status!")

    return {'status': "Success", 'data': 'Edited successfully!'}


class DeleteSessionData(BaseModel):
    session_id: str
@app.delete('/api/delete_session', tags=["Delete Session"])
async def delete_session_api(data: DeleteSessionData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("delete_session | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    session_existence = await get_session(data.session_id)
    if not session_existence:
        raise HTTPException(403, "Session does not exist!")

    user_session = await get_session(user_session_data['session_id'])
    unique_job_id = uuid.uuid4().hex[:12]

    deleted_session = await delete_session(data.session_id)
    if not deleted_session:
        await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                              ip_address=user_session['ip_address'],
                              unique_job_id=unique_job_id, action='Deleted session', action_status='failed',
                              created_at=datetime.now(tz))
        raise HTTPException(403, "Could not delete session!")

    await add_action_data(user_id=user['user_id'], session_id=user_session_data['session_id'],
                          ip_address=user_session['ip_address'],
                          unique_job_id=unique_job_id, action='Deleted session', action_status='success',
                          created_at=datetime.now(tz))

    return {'status': "Success", 'data': 'Deleted successfully!'}



# ----------------------------------------------------------------------------------------------------------------------
# user actions
# ----------------------------------------------------------------------------------------------------------------------

@app.get('/api/get_all_user_actions', tags=["Get All Actions"])
async def get_all_user_actions_api(user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("get_all_actions | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    user_actions = await get_all_actions_data()
    if not user_actions:
        return {'status': "Failed", 'admin': user, 'data': user_actions}

    return {'status': "Success", 'admin': user, 'data': user_actions}


class DeleteActionsData(BaseModel):
    unique_job_id: str
@app.delete('/api/delete_user_action', tags=["Delete User Action"])
async def delete_user_action_api(data: DeleteActionsData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    logger.info("delete_user_action | username=%s", user['username'])
    if not user:
        raise HTTPException(401, "Not authenticated!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    action_existence = await get_single_action_data(data.unique_job_id)
    if not action_existence:
        raise HTTPException(403, "Action does not exist!")

    deleted_action = await delete_single_action(data.unique_job_id)
    if not deleted_action:
        raise HTTPException(403, "Could not delete action!")

    return {'status': "Success", 'data': 'Deleted successfully!'}



# ----------------------------------------------------------------------------------------------------------------------
# ocr
# ----------------------------------------------------------------------------------------------------------------------

@app.get('/api/get_all_ocr_data', tags=["Get All Ocr Data"])
async def get_all_ocr_data_api(user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    if not user:
        logger.warning("get_all_ocr_data | Missing user")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    logger.info("get_all_ocr_data | Fetching all ocr data")
    all_ocr_data = await get_all_ocr_data()

    if not all_ocr_data:
        logger.warning("get_all_ocr_data | No ocr data found in DB")
        return {"Status": 'Failed', 'user': user, 'Data': all_ocr_data}

    logger.info("get_all_ocr_data | Returned %d records", len(all_ocr_data))
    return {"Status": 'Success', 'user': user, 'Data': all_ocr_data}


@app.post('/api/external/ocr_files/', tags=["OCR Files"])
async def ocr_files_api(input_file: UploadFile, request: Request):
    """
        1. IP authorization
        2. Filename exists
        3. Extension is allowed
        4. File size
        5. Read bytes
        6. Magic bytes (filetype)
        7. OCR
    """

    client_ip = request.client.host
    if client_ip not in origins:
        raise HTTPException(status_code=403, detail="Not authorized!")

    if not input_file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing!")

    ALLOWED_EXTENSIONS = {
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
    }

    ext = Path(input_file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file extension.")

    MAX_FILE_SIZE = 25 * 1024 * 1024
    file = input_file.file
    current = file.tell()
    file.seek(0, 2)
    size = file.tell()
    file.seek(current)

    if size > MAX_FILE_SIZE:
        raise HTTPException(413, "File size exceeds 25 MB")
    if size == 0:
        raise HTTPException(400, "Empty file")

    file_content = await input_file.read()

    ALLOWED_TYPES = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }
    kind = filetype.guess(file_content)
    if kind is None or kind.mime != ALLOWED_TYPES[ext]:
        raise HTTPException(status_code=400, detail="File extension does not match file content.")
    # Reset pointer for later OCR processing
    await input_file.seek(0)

    file_hash = hashlib.sha256(file_content).hexdigest()
    if ext == '.pdf':
        reader = PdfReader(io.BytesIO(file_content))
        page_number = len(reader.pages)
    else:
        page_number = 1

    file_data_existence = await check_ocr_file_hash_existence(file_hash)
    if file_data_existence:
        return {
            'status': "Success",
            'data': {
                'filename': file_data_existence['filename'],
                'file_extension': file_data_existence['file_extension'],
                'mime_type': file_data_existence['mime_type'],
                'file_size': file_data_existence['file_size'],
                'page_count': file_data_existence['page_count'],
                'language': file_data_existence['language'],
                'status': file_data_existence['status'],
                'extracted_text': file_data_existence['extracted_text'],
                'extracted_length': file_data_existence['extracted_length'],
                'created_at': file_data_existence['created_at'],
                'duration': file_data_existence['duration'],
                'finished_at': file_data_existence['finished_at']
            }
        }

    unique_job_id = str(uuid4().hex)

    await add_ocr_data(request_ip_address=client_ip, unique_job_id=unique_job_id,
                       file_hash=file_hash, filename=input_file.filename,
                       file_extension=ext, mime_type=kind.mime,
                       file_size=size, page_count=page_number,
                       status='processing', created_at=datetime.now(tz))

    try:
        temp_path = Path('temp/external') / f"{input_file.filename}{ext}"
        temp_path.write_bytes(file_content)



    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))







