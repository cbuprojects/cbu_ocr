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
from decimal import Decimal
import filetype
from dotenv import load_dotenv
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
from utils.logging import setup_logging, get_logger
from utils.database import (init_db_pool, close_db_pool,
                            create_superuser, create_user_session, get_session, logout_user_session, expire_user_session,
                            edit_user_language, add_new_user, get_user, get_user_id, get_all_users, edit_user_details,
                            edit_user_password, delete_user,
                            get_all_sessions_data, edit_session_status, delete_session,
                            add_action_data, get_all_actions_data, delete_single_action, get_single_action_data,
                            get_all_external_ocr_data, get_single_external_ocr_data, delete_single_external_ocr_data,
                            add_external_ocr_data, update_external_ocr_data, update_external_ocr_status,
                            check_external_ocr_file_hash_existence,
                            get_all_internal_ocr_data, get_single_internal_ocr_data, delete_single_internal_ocr_data,
                            add_internal_ocr_data, update_internal_ocr_data, update_internal_ocr_status,
                            check_internal_ocr_file_hash_existence,
                            get_user_internal_ocr_data,
                            recover_interrupted_external_ocr, recover_interrupted_internal_ocr)
from utils.ocr_set import (initialize_paddle_ocr, initialize_docling, pdf_is_selectable,
                           extract_docx_text, extract_single_page, extract_multi_page)
from utils.language import detect_language
from utils.services import reset_temp_folder


load_dotenv()

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

setup_logging()

logger = get_logger("cbu_api")
external_logger = get_logger("cbu_api.external", "external.log")
internal_logger = get_logger("cbu_api.internal", "internal.log")

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title='Cbu OCR APIs', docs_url='/', redoc_url=None)


# origins = [
#    os.getenv('LOCAL_ORIGIN_1'),
#    os.getenv('LOCAL_ORIGIN_2')
# ]

origins = [
    os.getenv('PROD_ORIGIN')
]

allowed_ips = [os.getenv("ALLOWED_IP")]


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
    # ------------------------------------------------------------------------------------------------------------------
    # Initializing DB
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("🚀 Starting CBU API…")
    await init_db_pool()
    logger.info("✅ DB pool initialized!")


    # ------------------------------------------------------------------------------------------------------------------
    # Removing Temp folders
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("🗂️ Resetting Temp folder")
    removed_files = reset_temp_folder()
    if removed_files:
        logger.info(f"📂 Removed {len(removed_files)} number of files, files: {removed_files} ✅")
    else:
        logger.info('📂 Nothing to delete from Temp folder, ready to go ✅')


    # ------------------------------------------------------------------------------------------------------------------
    # Updating External table Interrupted jobs
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("🔄Updating <<Processing>> status of <<🗂️External 🗂️>> Not Finished jobs in the db 🔄")
    external_interrupted_jobs = await recover_interrupted_external_ocr()
    if external_interrupted_jobs:
        logger.info(f"🔄Updated status of these <<🗂️External 🗂️>> jobs to <<‼️Interrupted ‼️>>: {external_interrupted_jobs} 🔄")
    else:
        logger.info(f"✅Nothing to update in <<🗂️External 🗂️>> db table, all good ✅")


    # ------------------------------------------------------------------------------------------------------------------
    # Updating Internal table Interrupted jobs
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("🔄Updating <<Processing>> status of <<🗂Internal 🗂️>> Not Finished jobs in the db 🔄")
    internal_interrupted_jobs = await recover_interrupted_internal_ocr()
    if internal_interrupted_jobs:
        logger.info(f"🔄Updated status of these <<🗂Internal 🗂️>> jobs to <<‼️Interrupted ‼️>>: {internal_interrupted_jobs} 🔄")
    else:
        logger.info(f"✅Nothing to update in <<🗂Internal 🗂️>> db table, all good ✅")


    # ------------------------------------------------------------------------------------------------------------------
    # Updating OCR queue
    # ------------------------------------------------------------------------------------------------------------------
    app.state.ocr_queue_depth = 0
    logger.info('OCR has no queue ✅')


    # ------------------------------------------------------------------------------------------------------------------
    # Initializing Paddle OCR
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("Paddle OCR is being initialized...🔎")
    app.state.ocr_pipeline = initialize_paddle_ocr()
    app.state.ocr_semaphore = asyncio.Semaphore(1)
    app.state.paddle_queue = 0
    logger.info("✅ Paddle OCR initialized!")


    # ------------------------------------------------------------------------------------------------------------------
    # Initializing Paddle OCR
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("Docling OCR is being initialized...🔎")
    app.state.docling_converter = initialize_docling()
    app.state.docling_queue = 0
    logger.info("✅ Docling OCR initialized!")


    # ------------------------------------------------------------------------------------------------------------------
    # Creating Admin User
    # ------------------------------------------------------------------------------------------------------------------
    # admin_user = await create_admin_user()
    # if admin_user:
    #     logger.info("✅✅✅ 👤 Admin user created successfully! ✅✅✅")
    # else:
    #     logger.info("❌❌❌ 👤 Failed to create Admin user! ❌❌❌")


    logger.info("✅ Startup complete! ✅")



@app.on_event("shutdown")
async def shutdown_event():
    # ------------------------------------------------------------------------------------------------------------------
    # Shutdown started
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("🛑 Shutdown signal received — shutting down CBU API... 🛑")


    # ------------------------------------------------------------------------------------------------------------------
    # Stopping OCR processing
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("🛑 Stopping OCR processing...")

    # Release Paddle OCR
    if getattr(app.state, "ocr_pipeline", None) is not None:
        app.state.ocr_pipeline = None
        logger.info("🛑 Paddle OCR released")

    # Release Docling OCR
    if getattr(app.state, "docling_converter", None) is not None:
        app.state.docling_converter = None
        logger.info("🛑 Docling OCR released")

    # Reset OCR state
    app.state.ocr_semaphore = None
    app.state.paddle_queue = 0
    app.state.docling_queue = 0
    app.state.ocr_queue_depth = 0

    logger.info("✅🛑 OCR processing stopped 🛑✅")


    # ------------------------------------------------------------------------------------------------------------------
    # Removing Temp folders
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("🗂️ Removing Temp files...")

    removed_files = reset_temp_folder()

    if removed_files:
        logger.info(
            f"📂 Removed {len(removed_files)} number of files, "
            f"files: {removed_files} ✅"
        )
    else:
        logger.info("📂 Nothing to delete from Temp folder ✅")


    # ------------------------------------------------------------------------------------------------------------------
    # Closing DB
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("🗄️ Closing DB pool...")
    await close_db_pool()
    logger.info("✅ DB pool closed")


    # ------------------------------------------------------------------------------------------------------------------
    # Shutdown complete
    # ------------------------------------------------------------------------------------------------------------------
    logger.info("✅🛑 Shutdown complete! 🛑✅")



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
    return True

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
# ocr all external
# ----------------------------------------------------------------------------------------------------------------------

@app.get('/api/get_all_external_ocr_data', tags=["Get All External Ocr Data"])
async def get_all_external_ocr_data_api(user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    if not user:
        logger.warning("get_all_external_ocr_data | Missing user")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    logger.info("get_all_external_ocr_data | Fetching all external ocr data")
    all_external_ocr_data = await get_all_external_ocr_data()

    if not all_external_ocr_data:
        logger.warning("get_all_external_ocr_data | No external ocr data found in DB")
        return {"Status": 'Failed', 'user': user, 'Data': all_external_ocr_data}

    logger.info("get_all_external_ocr_data | Returned %d records", len(all_external_ocr_data))
    return {"Status": 'Success', 'user': user, 'Data': all_external_ocr_data}


class ExternalOcrDeleteData(BaseModel):
    unique_job_id: str
@app.delete('/api/delete_external_ocr_data', tags=["Delete External Ocr Data"])
async def delete_external_ocr_data_api(data: ExternalOcrDeleteData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    if not user:
        logger.warning("delete_external_ocr_data | Missing user")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    unique_job_id = str(uuid4().hex)
    user_session = await get_session(session_id=user_session_data['session_id'])

    try:
        logger.info("delete_external_ocr_data | unique_job_id=%s", data.unique_job_id)
        if not data.unique_job_id:
            logger.warning("delete_external_ocr_data | Missing Job data!")
            raise HTTPException(status_code=400, detail="Job Data is required")

        checking_data_existence = await get_single_external_ocr_data(unique_job_id=data.unique_job_id)
        if not checking_data_existence:
            logger.warning("delete_external_ocr_data | Not found: job_data=%s", data.unique_job_id)
            raise HTTPException(status_code=404, detail="Such data does not exist!")

        deleted_row = await delete_single_external_ocr_data(unique_job_id=data.unique_job_id)
        if not deleted_row:
            logger.error("delete_external_ocr_data | DB delete failed for unique_job_id=%s", data.unique_job_id)
            raise HTTPException(status_code=404, detail="Such data does not exist!")

        await add_action_data(user_id=user['user_id'], unique_job_id=unique_job_id,
                              session_id=user_session_data["session_id"], ip_address=user_session['ip_address'],
                              action='Deleted External Job Data Request', action_status="success", created_at=datetime.now(tz))

        logger.info("delete_external_ocr_data | Deleted unique_job_id=%s", data.unique_job_id)
        return {"Status": 'Success', 'Data': 'Deleted successfully!'}
    except Exception as e:
        await add_action_data(user_id=user['user_id'], unique_job_id=unique_job_id,
                              session_id=user_session_data["session_id"], ip_address=user_session['ip_address'],
                              action='Deleted External Job Data Request', action_status="failed", created_at=datetime.now(tz))
        logger.error("delete_external_ocr_data | Failed to delete unique_job_id=%s, error=%s", data.unique_job_id, e)
        raise HTTPException(status_code=404, detail="Could not delete the external unique_job_id!")


@app.post('/api/external/ocr_files/', tags=["OCR External Files"])
async def ocr_external_files_api(input_file: UploadFile, request: Request):
    """
        External OCR endpoint — called by the complaints service.

            1. IP authorization
            2. Filename exists
            3. Extension is allowed
            4. File size
            5. Read bytes
            6. Magic bytes (filetype)
            7. Hash + dedup
            8. Route: docling (docx / selectable pdf) or PaddleOCR-VL (scan / image)
            9. Detect language, persist, return text
        """

    # ------------------------------------------------------------------------------------------------------------------
    # IP Auth
    # ------------------------------------------------------------------------------------------------------------------
    client_ip = request.client.host
    if client_ip not in allowed_ips:
        external_logger.warning("🚫 rejected | ip=%s | not in allowlist", client_ip)
        raise HTTPException(status_code=403, detail="Not authorized!")


    # ------------------------------------------------------------------------------------------------------------------
    # Filename check
    # ------------------------------------------------------------------------------------------------------------------
    if not input_file.filename:
        external_logger.warning("🚫 rejected | ip=%s | missing filename", client_ip)
        raise HTTPException(status_code=400, detail="Filename is missing!")


    # ------------------------------------------------------------------------------------------------------------------
    # Extensions check
    # ------------------------------------------------------------------------------------------------------------------
    ALLOWED_EXTENSIONS = {
        ".docx",
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
    }

    ext = Path(input_file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        external_logger.warning("🚫 rejected | ip=%s | bad extension=%s", client_ip, ext)
        raise HTTPException(status_code=400, detail="Unsupported file extension.")


    # ------------------------------------------------------------------------------------------------------------------
    # File size check
    # ------------------------------------------------------------------------------------------------------------------
    MAX_FILE_SIZE = 25 * 1024 * 1024
    file = input_file.file
    current = file.tell()
    file.seek(0, 2)
    size = file.tell()
    file.seek(current)

    if size > MAX_FILE_SIZE:
        external_logger.warning("🚫 rejected | ip=%s | too large=%.1f MB",
                                client_ip, size / 1024 / 1024)
        raise HTTPException(413, "File size exceeds 25 MB")
    if size == 0:
        external_logger.warning("🚫 rejected | ip=%s | empty file", client_ip)
        raise HTTPException(400, "Empty file")


    # ------------------------------------------------------------------------------------------------------------------
    # Reading bytes
    # ------------------------------------------------------------------------------------------------------------------
    file_content = await input_file.read()


    # ------------------------------------------------------------------------------------------------------------------
    # Filetype
    # ------------------------------------------------------------------------------------------------------------------
    ALLOWED_TYPES = {
        ".pdf":  {"application/pdf"},
        ".png":  {"image/png"},
        ".jpg":  {"image/jpeg"},
        ".jpeg": {"image/jpeg"},
        ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "application/zip"},
    }
    kind = filetype.guess(file_content)
    if kind is None or kind.mime not in ALLOWED_TYPES[ext]:
        external_logger.warning("🚫 rejected | ip=%s | ext=%s mime=%s mismatch",
                                client_ip, ext, kind.mime if kind else None)
        raise HTTPException(status_code=400,
                            detail="File extension does not match file content.")
    # Reset pointer for later OCR processing
    # await input_file.seek(0)


    # ------------------------------------------------------------------------------------------------------------------
    # File hash check
    # ------------------------------------------------------------------------------------------------------------------
    file_hash = hashlib.sha256(file_content).hexdigest()
    if ext == '.pdf':
        reader = PdfReader(io.BytesIO(file_content))
        page_number = len(reader.pages)
    else:
        page_number = 1

    file_data_existence = await check_external_ocr_file_hash_existence(file_hash)
    if file_data_existence:
        external_logger.info("♻️  cache hit | ip=%s | hash=%s | job=%s",
                             client_ip, file_hash[:12], file_data_existence['unique_job_id'])
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
                'extracted_text_length': file_data_existence['extracted_text_length'],
                'created_at': file_data_existence['created_at'],
                'duration': file_data_existence['duration'],
                'finished_at': file_data_existence['finished_at']
            }
        }


    # ------------------------------------------------------------------------------------------------------------------
    # New File
    # ------------------------------------------------------------------------------------------------------------------
    unique_job_id = str(uuid4().hex)
    created_at = datetime.now(tz)
    filename = f'filename_{unique_job_id}'
    await add_external_ocr_data(request_ip_address=client_ip, unique_job_id=unique_job_id,
                       file_hash=file_hash, filename=filename,
                       file_extension=ext, mime_type=kind.mime,
                       file_size=size, page_count=page_number,
                       status='processing', created_at=created_at)

    app.state.ocr_queue_depth += 1

    external_logger.info(
        "📥 accepted | job=%s | ip=%s | ext=%s | %.1f KB | pages=%d | hash=%s",
        unique_job_id, client_ip, ext, size / 1024, page_number, file_hash[:12]
    )

    temp_dir = Path('temp_files/external')
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_file_path = temp_dir / f"filename_{unique_job_id}{ext}"
    file_path = str(temp_file_path)


    # ------------------------------------------------------------------------------------------------------------------
    # Routing OCR tool
    # ------------------------------------------------------------------------------------------------------------------
    final_text = None
    method = None
    try:
        temp_file_path.write_bytes(file_content)
        if ext == '.docx':
            method = 'docling'
            app.state.docling_queue += 1
            final_text = await asyncio.wait_for(asyncio.to_thread(extract_docx_text,app.state.docling_converter, file_path), timeout=120)

        elif ext == '.pdf':
            selectable = await asyncio.to_thread(pdf_is_selectable, path=file_path, min_chars=50)
            external_logger.info("🔀 routing | job=%s | pdf selectable=%s | pages=%d",
                                 unique_job_id, selectable, page_number)
            if selectable:
                method = 'docling'
                app.state.docling_queue += 1
                final_text = await asyncio.wait_for(asyncio.to_thread(extract_docx_text, app.state.docling_converter,
                                                                      file_path), timeout=120)
            else:
                method = 'paddle'
                app.state.paddle_queue += 1
                if page_number == 1:
                    async with app.state.ocr_semaphore:
                        final_text = await asyncio.wait_for(
                            asyncio.to_thread(extract_single_page,app.state.ocr_pipeline, file_path),
                            timeout=page_number * 30 + 60,
                        )

                else:
                    async with app.state.ocr_semaphore:
                        final_text = await asyncio.wait_for(
                            asyncio.to_thread(extract_multi_page,app.state.ocr_pipeline, file_path),
                            timeout=page_number * 30 + 60,
                        )
                external_logger.info("⏳ gpu queue | job=%s | depth=%d",
                                     unique_job_id, app.state.ocr_queue_depth)

        elif ext == '.jpg' or ext == '.jpeg' or ext == '.png':
            method = 'paddle'
            app.state.paddle_queue += 1
            external_logger.info("⏳ gpu queue | job=%s | depth=%d",
                                 unique_job_id, app.state.ocr_queue_depth)
            async with app.state.ocr_semaphore:
                final_text = await asyncio.wait_for(
                    asyncio.to_thread(extract_single_page, app.state.ocr_pipeline, file_path), timeout=90)
        else:
            method = None
            raise ValueError(f"No extractor for {ext}")

        external_logger.info("📄 extracted | job=%s | method=%s", unique_job_id, method)

    except asyncio.TimeoutError:
        failed_at = datetime.now(tz)
        elapsed = Decimal(str(round((failed_at - created_at).total_seconds(), 2)))
        external_logger.error("⏱️  timeout | job=%s | ext=%s | pages=%d | after=%ss",
                              unique_job_id, ext, page_number, elapsed)
        await update_external_ocr_data( unique_job_id=unique_job_id, page_count=page_number, language=None,
                                        status='timeout', extracted_text=None, extracted_text_length=0,
                                        duration=elapsed, finished_at=failed_at)
        raise HTTPException(504, "Extraction timed out")
    except Exception as e:
        failed_at = datetime.now(tz)
        elapsed = Decimal(str(round((failed_at - created_at).total_seconds(), 2)))
        external_logger.exception("❌ failed | job=%s | ext=%s | after=%ss | %s",
                                  unique_job_id, ext, elapsed, e)
        await update_external_ocr_data(unique_job_id=unique_job_id, page_count=page_number, language=None,
                                       status='failed', extracted_text=None, extracted_text_length=0,
                                        duration=elapsed, finished_at=failed_at)
        raise HTTPException(500, f"Extraction failed: {e}")
    finally:
        if method == 'paddle':
            app.state.paddle_queue -= 1
        elif method == 'docling':
            app.state.docling_queue -= 1

        app.state.ocr_queue_depth -= 1
        temp_file_path.unlink(missing_ok=True)


    finished_at = datetime.now(tz)
    duration = Decimal(str(round((finished_at - created_at).total_seconds(), 2)))

    if not final_text:
        await update_external_ocr_data(unique_job_id=unique_job_id, page_count=page_number,
                                       language=None, status='failed', extracted_text=None,
                                       extracted_text_length=0, duration=duration,
                                       finished_at=finished_at)
        raise HTTPException(500, "Extraction produced no text")


    # ------------------------------------------------------------------------------------------------------------------
    # Finalizing OCR result
    # ------------------------------------------------------------------------------------------------------------------
    language = detect_language(text=final_text)

    await update_external_ocr_data(unique_job_id=unique_job_id, page_count=page_number, language=language,
                          status='success', extracted_text=final_text, extracted_text_length=len(final_text),
                          duration=duration, finished_at=finished_at)

    external_logger.info(
        "✅ success | job=%s | method=%s | lang=%s | pages=%d | chars=%d | %ss (%.2fs/page)",
        unique_job_id, method, language, page_number, len(final_text),
        duration, float(duration) / max(page_number, 1)
    )

    return {
        'status': "Success",
        'data': {
            'filename': filename,
            'file_extension': ext,
            'mime_type': kind.mime,
            'file_size': size,
            'page_count': page_number,
            'language': language,
            'status': 'success',
            'extracted_text': final_text,
            'extracted_text_length': len(final_text),
            'created_at': created_at,
            'duration': duration,
            'finished_at': finished_at,
        }
    }



# ----------------------------------------------------------------------------------------------------------------------
# ocr all internal
# ----------------------------------------------------------------------------------------------------------------------

@app.get('/api/get_all_internal_ocr_data', tags=["Get All Internal Ocr Data"])
async def get_all_internal_ocr_data_api(user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    if not user:
        logger.warning("get_all_internal_ocr_data | Missing user")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    logger.info("get_all_internal_ocr_data | Fetching all internal ocr data")
    all_internal_ocr_data = await get_all_internal_ocr_data()

    if not all_internal_ocr_data:
        logger.warning("get_all_internal_ocr_data | No internal ocr data found in DB")
        return {"Status": 'Failed', 'user': user, 'Data': all_internal_ocr_data}

    logger.info("get_all_internal_ocr_data | Returned %d records", len(all_internal_ocr_data))
    return {"Status": 'Success', 'user': user, 'Data': all_internal_ocr_data}


class InternalOcrDeleteData(BaseModel):
    unique_job_id: str
@app.delete('/api/delete_internal_ocr_data', tags=["Delete Internal Ocr Data"])
async def delete_internal_ocr_data_api(data: InternalOcrDeleteData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    if not user:
        logger.warning("delete_internal_ocr_data | Missing user")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    if not user['is_admin']:
        raise HTTPException(403, "User does not have admin rights!")

    unique_job_id = str(uuid4().hex)
    user_session = await get_session(session_id=user_session_data['session_id'])

    try:
        logger.info("delete_internal_ocr_data | unique_job_id=%s", data.unique_job_id)
        if not data.unique_job_id:
            logger.warning("delete_internal_ocr_data | Missing Job data!")
            raise HTTPException(status_code=400, detail="Job Data is required")

        checking_data_existence = await get_single_internal_ocr_data(unique_job_id=data.unique_job_id)
        if not checking_data_existence:
            logger.warning("delete_internal_ocr_data | Not found: job_data=%s", data.unique_job_id)
            raise HTTPException(status_code=404, detail="Such data does not exist!")

        deleted_row = await delete_single_internal_ocr_data(unique_job_id=data.unique_job_id)
        if not deleted_row:
            logger.error("delete_internal_ocr_data | DB delete failed for unique_job_id=%s", data.unique_job_id)
            raise HTTPException(status_code=404, detail="Such data does not exist!")

        await add_action_data(user_id=user['user_id'], unique_job_id=unique_job_id,
                              session_id=user_session_data["session_id"], ip_address=user_session['ip_address'],
                              action='Deleted Internal Job Data Request', action_status="success", created_at=datetime.now(tz))

        logger.info("delete_internal_ocr_data | Deleted unique_job_id=%s", data.unique_job_id)
        return {"Status": 'Success', 'Data': 'Deleted successfully!'}
    except Exception as e:
        await add_action_data(user_id=user['user_id'], unique_job_id=unique_job_id,
                              session_id=user_session_data["session_id"], ip_address=user_session['ip_address'],
                              action='Deleted Internal Job Data Request', action_status="failed", created_at=datetime.now(tz))
        logger.error("delete_internal_ocr_data | Failed to delete unique_job_id=%s, error=%s", data.unique_job_id, e)
        raise HTTPException(status_code=404, detail="Could not delete the internal unique_job_id!")


@app.post('/api/internal/ocr_files/', tags=["OCR Internal Files"])
async def ocr_internal_files_api(input_file: UploadFile, request: Request, user_session_data = Depends(get_current_user)):
    """
        External OCR endpoint — called by the complaints service.

            1. User authorization
            2. Filename exists
            3. Extension is allowed
            4. File size
            5. Read bytes
            6. Magic bytes (filetype)
            7. Hash + dedup
            8. Route: docling (docx / selectable pdf) or PaddleOCR-VL (scan / image)
            9. Detect language, persist, return text
        """

    # ------------------------------------------------------------------------------------------------------------------
    # User Auth
    # ------------------------------------------------------------------------------------------------------------------
    user = user_session_data['user']
    if not user:
        internal_logger.warning("🚫 rejected | no user in session")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    username = user['username']
    session_data = await get_session(session_id=user_session_data['session_id'])
    ip_address = session_data['ip_address']


    # ------------------------------------------------------------------------------------------------------------------
    # Filename check
    # ------------------------------------------------------------------------------------------------------------------
    if not input_file.filename:
        internal_logger.warning("🚫 rejected | user=%s | ip=%s | missing filename", username, ip_address)
        raise HTTPException(status_code=400, detail="Filename is missing!")


    # ------------------------------------------------------------------------------------------------------------------
    # Extensions check
    # ------------------------------------------------------------------------------------------------------------------
    ALLOWED_EXTENSIONS = {
        ".docx",
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
    }

    ext = Path(input_file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        internal_logger.warning("🚫 rejected | user=%s | ip=%s | bad extension=%s", username, ip_address, ext)
        raise HTTPException(status_code=400, detail="Unsupported file extension.")


    # ------------------------------------------------------------------------------------------------------------------
    # File size check
    # ------------------------------------------------------------------------------------------------------------------
    MAX_FILE_SIZE = 25 * 1024 * 1024
    file = input_file.file
    current = file.tell()
    file.seek(0, 2)
    size = file.tell()
    file.seek(current)

    if size > MAX_FILE_SIZE:
        internal_logger.warning("🚫 rejected | user=%s | ip=%s | too large=%.1f MB", username, ip_address, size / 1024 / 1024)
        raise HTTPException(413, "File size exceeds 25 MB")
    if size == 0:
        internal_logger.warning("🚫 rejected | user=%s | ip=%s | empty file", username, ip_address)
        raise HTTPException(400, "Empty file")


    # ------------------------------------------------------------------------------------------------------------------
    # Reading bytes
    # ------------------------------------------------------------------------------------------------------------------
    file_content = await input_file.read()


    # ------------------------------------------------------------------------------------------------------------------
    # Filetype
    # ------------------------------------------------------------------------------------------------------------------
    ALLOWED_TYPES = {
        ".pdf":  {"application/pdf"},
        ".png":  {"image/png"},
        ".jpg":  {"image/jpeg"},
        ".jpeg": {"image/jpeg"},
        ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "application/zip"},
    }
    kind = filetype.guess(file_content)
    if kind is None or kind.mime not in ALLOWED_TYPES[ext]:
        internal_logger.warning("🚫 rejected | user=%s | ip=%s | ext=%s mime=%s mismatch", username, ip_address, ext, kind.mime if kind else None)
        raise HTTPException(status_code=400,
                            detail="File extension does not match file content.")
    # Reset pointer for later OCR processing
    # await input_file.seek(0)


    # ------------------------------------------------------------------------------------------------------------------
    # File hash check
    # ------------------------------------------------------------------------------------------------------------------
    file_hash = hashlib.sha256(file_content).hexdigest()
    if ext == '.pdf':
        reader = PdfReader(io.BytesIO(file_content))
        page_number = len(reader.pages)
    else:
        page_number = 1

    file_data_existence = await check_internal_ocr_file_hash_existence(file_hash)
    if file_data_existence:
        internal_logger.info("♻️  cache hit | user=%s | hash=%s | job=%s", username, file_hash[:12], file_data_existence['unique_job_id'])
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
                'extracted_text_length': file_data_existence['extracted_text_length'],
                'created_at': file_data_existence['created_at'],
                'duration': file_data_existence['duration'],
                'finished_at': file_data_existence['finished_at']
            }
        }


    # ------------------------------------------------------------------------------------------------------------------
    # New File
    # ------------------------------------------------------------------------------------------------------------------
    unique_job_id = str(uuid4().hex)
    created_at = datetime.now(tz)
    filename = f'filename_{unique_job_id}'
    await add_internal_ocr_data(request_ip_address=ip_address, unique_job_id=unique_job_id,
                       file_hash=file_hash, filename=filename,
                       file_extension=ext, mime_type=kind.mime,
                       file_size=size, page_count=page_number,
                       status='processing', created_at=created_at)

    app.state.ocr_queue_depth += 1

    internal_logger.info("📥 accepted | job=%s | user=%s | ip=%s | ext=%s | %.1f KB | pages=%d | hash=%s",
                         unique_job_id, username, ip_address, ext, size / 1024, page_number, file_hash[:12])

    temp_dir = Path('temp_files/internal')
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_file_path = temp_dir / f"filename_{unique_job_id}{ext}"
    file_path = str(temp_file_path)


    # ------------------------------------------------------------------------------------------------------------------
    # Routing OCR tool
    # ------------------------------------------------------------------------------------------------------------------
    final_text = None
    method = None
    try:
        temp_file_path.write_bytes(file_content)
        if ext == '.docx':
            method = 'docling'
            app.state.docling_queue += 1
            final_text = await asyncio.wait_for(asyncio.to_thread(extract_docx_text,
                                                            app.state.docling_converter,file_path), timeout=120)

        elif ext == '.pdf':
            selectable = await asyncio.to_thread(pdf_is_selectable, path=file_path, min_chars=50)
            internal_logger.info("🔀 routing | job=%s | pdf selectable=%s | pages=%d",
                                 unique_job_id, selectable, page_number)
            if selectable:
                method = 'docling'
                app.state.docling_queue += 1
                final_text = await asyncio.wait_for(asyncio.to_thread(extract_docx_text,
                                                                      app.state.docling_converter,
                                                                      file_path), timeout=120)
            else:
                method = 'paddle'
                app.state.paddle_queue += 1
                internal_logger.info("⏳ gpu queue | job=%s | depth=%d",
                                     unique_job_id, app.state.ocr_queue_depth)
                if page_number == 1:
                    async with app.state.ocr_semaphore:
                        final_text = await asyncio.wait_for(
                            asyncio.to_thread(extract_single_page,app.state.ocr_pipeline, file_path),
                            timeout=page_number * 30 + 60,
                        )

                else:
                    async with app.state.ocr_semaphore:
                        final_text = await asyncio.wait_for(
                            asyncio.to_thread(extract_multi_page,
                                              app.state.ocr_pipeline,
                                              file_path),
                            timeout=page_number * 30 + 60,
                        )

        elif ext == '.jpg' or ext == '.jpeg' or ext == '.png':
            method = 'paddle'
            app.state.paddle_queue += 1
            internal_logger.info("⏳ gpu queue | job=%s | depth=%d",
                                 unique_job_id, app.state.ocr_queue_depth)
            async with app.state.ocr_semaphore:
                final_text = await asyncio.wait_for(
                    asyncio.to_thread(extract_single_page,app.state.ocr_pipeline, file_path), timeout=90)
        else:
            raise ValueError(f"No extractor for {ext}")

        internal_logger.info("📄 extracted | job=%s | method=%s", unique_job_id, method)

    except asyncio.TimeoutError:
        failed_at = datetime.now(tz)
        elapsed = Decimal(str(round((failed_at - created_at).total_seconds(), 2)))
        internal_logger.error("⏱️  timeout | job=%s | user=%s | ext=%s | pages=%d | after=%ss",
                              unique_job_id, username, ext, page_number, elapsed)
        await update_internal_ocr_data( unique_job_id=unique_job_id, page_count=page_number, language=None,
                                        status='timeout', extracted_text=None, extracted_text_length=0,
                                        duration=elapsed, finished_at=failed_at)
        raise HTTPException(504, "Extraction timed out")
    except Exception as e:
        failed_at = datetime.now(tz)
        elapsed = Decimal(str(round((failed_at - created_at).total_seconds(), 2)))
        internal_logger.exception("❌ failed | job=%s | user=%s | ext=%s | after=%ss | %s",
                                  unique_job_id, username, ext, elapsed, e)
        await update_internal_ocr_data(unique_job_id=unique_job_id, page_count=page_number, language=None,
                                       status='failed', extracted_text=None, extracted_text_length=0,
                                        duration=elapsed, finished_at=failed_at)
        raise HTTPException(500, f"Extraction failed: {e}")
    finally:
        if method == 'paddle':
            app.state.paddle_queue -= 1
        elif method == 'docling':
            app.state.docling_queue -= 1

        app.state.ocr_queue_depth -= 1
        temp_file_path.unlink(missing_ok=True)


    finished_at = datetime.now(tz)
    duration = Decimal(str(round((finished_at - created_at).total_seconds(), 2)))

    if not final_text:
        await update_internal_ocr_data(unique_job_id=unique_job_id, page_count=page_number,
                                       language=None, status='failed', extracted_text=None,
                                       extracted_text_length=0, duration=duration,
                                       finished_at=finished_at)
        raise HTTPException(500, "Extraction produced no text")

    # ------------------------------------------------------------------------------------------------------------------
    # Finalizing OCR result
    # ------------------------------------------------------------------------------------------------------------------
    language = detect_language(text=final_text)

    await update_internal_ocr_data(unique_job_id=unique_job_id, page_count=page_number, language=language,
                          status='success', extracted_text=final_text, extracted_text_length=len(final_text),
                          duration=duration, finished_at=finished_at)

    internal_logger.info("✅ success | job=%s | user=%s | method=%s | lang=%s | pages=%d | chars=%d | %ss (%.2fs/page)",
                         unique_job_id, username, method, language, page_number, len(final_text),
                         duration, float(duration) / max(page_number, 1))

    return {
        'status': "Success",
        'data': {
            'filename': filename,
            'file_extension': ext,
            'mime_type': kind.mime,
            'file_size': size,
            'page_count': page_number,
            'language': language,
            'status': 'success',
            'extracted_text': final_text,
            'extracted_text_length': len(final_text),
            'created_at': created_at,
            'duration': duration,
            'finished_at': finished_at,
        }
    }



# ----------------------------------------------------------------------------------------------------------------------
# ocr user internal
# ----------------------------------------------------------------------------------------------------------------------

@app.get('/api/get_user_internal_ocr_data', tags=["Get All Internal Ocr Data"])
async def get_user_internal_ocr_data_api(user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    if not user:
        logger.warning("get_all_internal_ocr_data | Missing user")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    logger.info("get_user_internal_ocr_data | Fetching user internal ocr data")
    user_internal_ocr_data = await get_user_internal_ocr_data(user_id=user['user_id'])

    if not user_internal_ocr_data:
        logger.warning("get_user_internal_ocr_data | No internal ocr data found in DB")
        return {"Status": 'Failed', 'user': user, 'Data': user_internal_ocr_data}

    logger.info("get_user_internal_ocr_data | Returned %d records", len(user_internal_ocr_data))
    return {"Status": 'Success', 'user': user, 'Data': user_internal_ocr_data}


class InternalOcrDeleteData(BaseModel):
    unique_job_id: str
@app.delete('/api/delete_internal_ocr_data', tags=["Delete Internal Ocr Data"])
async def delete_internal_ocr_data_api(data: InternalOcrDeleteData, user_session_data = Depends(get_current_user)):
    user = user_session_data['user']
    if not user:
        logger.warning("delete_internal_ocr_data | Missing user")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    unique_job_id = str(uuid4().hex)
    user_session = await get_session(session_id=user_session_data['session_id'])

    try:
        logger.info("delete_internal_ocr_data | unique_job_id=%s", data.unique_job_id)
        if not data.unique_job_id:
            logger.warning("delete_internal_ocr_data | Missing Job data!")
            raise HTTPException(status_code=400, detail="Job Data is required")

        checking_data_existence = await get_single_internal_ocr_data(unique_job_id=data.unique_job_id)
        if not checking_data_existence:
            logger.warning("delete_internal_ocr_data | Not found: job_data=%s", data.unique_job_id)
            raise HTTPException(status_code=404, detail="Such data does not exist!")

        deleted_row = await delete_single_internal_ocr_data(unique_job_id=data.unique_job_id)
        if not deleted_row:
            logger.error("delete_internal_ocr_data | DB delete failed for unique_job_id=%s", data.unique_job_id)
            raise HTTPException(status_code=404, detail="Such data does not exist!")

        await add_action_data(user_id=user['user_id'], unique_job_id=unique_job_id,
                              session_id=user_session_data["session_id"], ip_address=user_session['ip_address'],
                              action='Deleted Internal Job Data Request', action_status="success", created_at=datetime.now(tz))

        logger.info("delete_internal_ocr_data | Deleted unique_job_id=%s", data.unique_job_id)
        return {"Status": 'Success', 'Data': 'Deleted successfully!'}
    except Exception as e:
        await add_action_data(user_id=user['user_id'], unique_job_id=unique_job_id,
                              session_id=user_session_data["session_id"], ip_address=user_session['ip_address'],
                              action='Deleted Internal Job Data Request', action_status="failed", created_at=datetime.now(tz))
        logger.error("delete_internal_ocr_data | Failed to delete unique_job_id=%s, error=%s", data.unique_job_id, e)
        raise HTTPException(status_code=404, detail="Could not delete the internal unique_job_id!")



# ----------------------------------------------------------------------------------------------------------------------
# ocr status check
# ----------------------------------------------------------------------------------------------------------------------

@app.get('/api/ocr_status_check', tags=["OCR Status Check"])
async def get_ocr_status_check_api(user_session_data = Depends(get_current_user)):
    """
    Live OCR engine state. Reads in-memory counters only — no DB, no GPU
    work — so the frontend can poll this every second.

    Statuses:
        Not loaded  — the engine failed to initialize at startup
        Processing  — currently extracting
        Free        — idle
        Error       — counter went negative, accounting has drifted
    """
    user = user_session_data['user']
    if not user:
        logger.warning("ocr_status_check | Missing user")
        raise HTTPException(status_code=401, detail="Not Authorized!")

    if not user['is_admin']:
        logger.warning("ocr_status_check | user=%s | not admin", user['username'])
        raise HTTPException(403, "User does not have admin rights!")

    # ------------------------------------------------------------------------------------------------------------------
    # State must exist — if startup did not complete, say so plainly
    # ------------------------------------------------------------------------------------------------------------------
    required = ('ocr_queue_depth', 'docling_queue', 'paddle_queue', 'ocr_semaphore')
    missing = [attr for attr in required if not hasattr(app.state, attr)]
    if missing:
        logger.error("ocr_status_check | app.state missing: %s", missing)
        raise HTTPException(status_code=503, detail="OCR service is not ready!")

    # ------------------------------------------------------------------------------------------------------------------
    # Are the engines actually loaded?
    # ------------------------------------------------------------------------------------------------------------------
    paddle_loaded = getattr(app.state, 'ocr_pipeline', None) is not None
    docling_loaded = getattr(app.state, 'docling_converter', None) is not None

    # ------------------------------------------------------------------------------------------------------------------
    # Counters
    # ------------------------------------------------------------------------------------------------------------------
    total_number_of_processes = app.state.ocr_queue_depth
    docling_processes = app.state.docling_queue
    paddle_processes = app.state.paddle_queue

    # Semaphore tells us whether the GPU is occupied right now, as opposed
    # to a job that is accepted but still queued behind another.
    paddle_busy = app.state.ocr_semaphore.locked()
    paddle_waiting = max(paddle_processes - (1 if paddle_busy else 0), 0)

    # ------------------------------------------------------------------------------------------------------------------
    # Statuses
    # ------------------------------------------------------------------------------------------------------------------
    if not paddle_loaded:
        paddle_status = 'Not loaded'
    elif paddle_processes < 0:
        paddle_status = 'Error'
        logger.error("ocr_status_check | paddle counter negative: %d", paddle_processes)
    elif paddle_busy or paddle_processes > 0:
        paddle_status = 'Processing'
    else:
        paddle_status = 'Free'

    if not docling_loaded:
        docling_status = 'Not loaded'
    elif docling_processes < 0:
        docling_status = 'Error'
        logger.error("ocr_status_check | docling counter negative: %d", docling_processes)
    elif docling_processes > 0:
        docling_status = 'Processing'
    else:
        docling_status = 'Free'

    if total_number_of_processes < 0:
        logger.error("ocr_status_check | total counter negative: %d",
                     total_number_of_processes)

    return {
        'Status': 'Success',
        'data': {
            'total_number_of_processes': total_number_of_processes,

            'docling': {
                'loaded': docling_loaded,
                'status': docling_status,
                'processes': docling_processes,
            },

            'paddle': {
                'loaded': paddle_loaded,
                'status': paddle_status,
                'processes': paddle_processes,
                'on_gpu': paddle_busy,
                'waiting': paddle_waiting,
            },
        }
    }










