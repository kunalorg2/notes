from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os
import logging
from pathlib import Path
import uuid
from datetime import datetime

# /backend 
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class Note(BaseModel):
    title: str
    content: dict  # Rich text content as JSON
    tags: Optional[List[str]] = []

class NoteResponse(Note):
    id: str
    created_at: datetime
    updated_at: datetime

@app.get("/api/notes")
async def get_notes():
    notes = await db.notes.find().sort("updated_at", -1).to_list(length=None)
    return [
        {
            "id": str(note["_id"]),
            "title": note["title"],
            "content": note["content"],
            "tags": note.get("tags", []),
            "created_at": note["created_at"],
            "updated_at": note["updated_at"]
        }
        for note in notes
    ]

@app.post("/api/notes", response_model=NoteResponse)
async def create_note(note: Note):
    now = datetime.utcnow()
    note_dict = note.dict()
    note_dict.update({
        "_id": str(uuid.uuid4()),
        "created_at": now,
        "updated_at": now
    })
    await db.notes.insert_one(note_dict)
    return {**note_dict, "id": note_dict["_id"]}

@app.put("/api/notes/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, note: Note):
    now = datetime.utcnow()
    update_data = note.dict()
    update_data["updated_at"] = now
    
    result = await db.notes.find_one_and_update(
        {"_id": note_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return {
        "id": result["_id"],
        "title": result["title"],
        "content": result["content"],
        "tags": result.get("tags", []),
        "created_at": result["created_at"],
        "updated_at": result["updated_at"]
    }

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str):
    result = await db.notes.delete_one({"_id": note_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}

@app.get("/api/search")
async def search_notes(q: str):
    notes = await db.notes.find(
        {"$or": [
            {"title": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}}
        ]}
    ).sort("updated_at", -1).to_list(length=None)
    
    return [
        {
            "id": str(note["_id"]),
            "title": note["title"],
            "content": note["content"],
            "tags": note.get("tags", []),
            "created_at": note["created_at"],
            "updated_at": note["updated_at"]
        }
        for note in notes
    ]

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()