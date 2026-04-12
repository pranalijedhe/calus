import os
import json
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import boto3
import firebase_admin
from firebase_admin import credentials, auth, firestore
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

import models
import pricing
from database import engine, get_db
from aws_ingester import ingest_aws_pricing

# Load environment variables
load_dotenv()

# Create tables
models.Base.metadata.create_all(bind=engine)

# Run initial ingestion
try:
    ingest_aws_pricing()
except Exception as e:
    print(f"Startup ingestion error: {e}")

app = FastAPI(title="AWS Calcus API")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(pricing.router)

# API Routes
@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/api/v1/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return users

@app.post("/api/v1/aws/sync-pricing")
async def sync_pricing(db: Session = Depends(get_db)):
    try:
        ingest_aws_pricing()
        return {"message": "Sync completed successfully", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

# Serve Static Files (Production)
dist_path = os.path.join(os.getcwd(), "dist")
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index_file = os.path.join(dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"error": "Frontend not built"}

if __name__ == "__main__":
    import uvicorn
    # Port 3000 is required by the environment
    uvicorn.run(app, host="0.0.0.0", port=3000)
