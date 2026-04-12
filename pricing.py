from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models

router = APIRouter(prefix="/api/v1/pricing", tags=["pricing"])

@router.get("/compute")
def get_compute_pricing(
    provider_id: Optional[str] = None,
    region_id: Optional[str] = None,
    instance_type: Optional[str] = None,
    os: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.AWSPricing)
    
    if region_id:
        query = query.filter(models.AWSPricing.location == region_id)
    if instance_type:
        query = query.filter(models.AWSPricing.instance_type == instance_type)
    if os:
        query = query.filter(models.AWSPricing.operating_system == os)
        
    results = query.all()
    return results

@router.get("/regions")
def get_available_regions(db: Session = Depends(get_db)):
    regions = db.query(models.AWSPricing.location).distinct().all()
    return [r[0] for r in regions if r[0]]

@router.get("/instance-types")
def get_instance_types(region: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.AWSPricing.instance_type).distinct()
    if region:
        query = query.filter(models.AWSPricing.location == region)
    results = query.all()
    return [r[0] for r in results if r[0]]
