from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    role = Column(String, default="user")

class AWSPricing(Base):
    __tablename__ = "aws_pricing"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    service_code = Column(String)
    location = Column(String)
    instance_type = Column(String)
    vcpu = Column(String)
    memory = Column(String)
    operating_system = Column(String)
    tenancy = Column(String)
    usage_type = Column(String)
    price_per_unit = Column(Float)
    unit = Column(String, default="Hrs")
    attributes = Column(JSON)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
