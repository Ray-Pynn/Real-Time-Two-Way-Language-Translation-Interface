
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List
import json

app = FastAPI(title="Live Translator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    source_language: str
    target_language: str

class RoomManager:
    def __init__(self):
        self.active_rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_code: str, websocket: WebSocket):
        await websocket.accept()
        if room_code not in self.active_rooms:
            self.active_rooms[room_code] = []
        self.active_rooms[room_code].append(websocket)
        await self.broadcast_system(room_code, f"A user joined room {room_code}.")

    def disconnect(self, room_code: str, websocket: WebSocket):
        if room_code in self.active_rooms:
            if websocket in self.active_rooms[room_code]:
                self.active_rooms[room_code].remove(websocket)
            if not self.active_rooms[room_code]:
                del self.active_rooms[room_code]

    async def broadcast_message(self, room_code: str, message: dict, sender_ws: WebSocket):
        if room_code in self.active_rooms:
            for connection in self.active_rooms[room_code]:
                if connection != sender_ws:
                    await connection.send_text(json.dumps(message))

    async def broadcast_system(self, room_code: str, text: str):
        if room_code in self.active_rooms:
            payload = json.dumps({"type": "system", "message": text})
            for connection in self.active_rooms[room_code]:
                await connection.send_text(payload)

manager = RoomManager()

@app.get("/api/health")
def health_check():
    return {"status": "online"}

@app.post("/api/translate")
def translate_text(payload: TranslationRequest):
    text_clean = payload.text.strip()
    
    phrasebook = {
        "hello": {"hi-IN": "नमस्ते", "mr-IN": "नमस्कार", "en-US": "Hello"},
        "how are you": {"hi-IN": "आप कैसे हैं?", "mr-IN": "तुम्ही कसे आहात?", "en-US": "How are you?"},
        "thank you": {"hi-IN": "धन्यवाद", "mr-IN": "धन्यवाद", "en-US": "Thank you"},
    }
    
    lower_text = text_clean.lower()
    if lower_text in phrasebook and payload.target_language in phrasebook[lower_text]:
        translated = phrasebook[lower_text][payload.target_language]
        trans_type = "phrasebook"
    else:
        translated = f"[{payload.target_language}] {text_clean}"
        trans_type = "simulated-fallback"
        
    return {
        "original_text": text_clean,
        "translated_text": translated,
        "source_language": payload.source_language,
        "target_language": payload.target_language,
        "translation_type": trans_type,
    }

@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("en-US")
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty audio file received.")
    
    return {
        "status": "success",
        "transcript": "Transcribed spoken message demo",
        "filename": file.filename,
        "language": language
    }

@app.websocket("/ws/{room_code}")
async def websocket_endpoint(websocket: WebSocket, room_code: str):
    clean_code = room_code.upper()
    await manager.connect(clean_code, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await manager.broadcast_message(clean_code, message, websocket)
    except WebSocketDisconnect:
        manager.disconnect(clean_code, websocket)
        await manager.broadcast_system(clean_code, "A user left the room.")
      
