import os
import json
import boto3
from sqlalchemy.orm import Session
from models import AWSPricing
from database import SessionLocal, engine
import models

def get_aws_pricing_client():
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    
    if not access_key or not secret_key:
        print("AWS credentials not configured. Skipping live ingestion.")
        return None
    
    return boto3.client(
        'pricing',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name='us-east-1'
    )

def ingest_aws_pricing():
    db = SessionLocal()
    client = get_aws_pricing_client()
    
    if not client:
        seed_sample_data(db)
        db.close()
        return

    try:
        # Example: Fetching common instance types
        instance_types = ['t3.micro', 't3.small', 't3.medium', 'm5.large']
        
        for itype in instance_types:
            response = client.get_products(
                ServiceCode='AmazonEC2',
                Filters=[
                    {'Type': 'TERM_MATCH', 'Field': 'instanceType', 'Value': itype},
                    {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
                    {'Type': 'TERM_MATCH', 'Field': 'operatingSystem', 'Value': 'Linux'},
                    {'Type': 'TERM_MATCH', 'Field': 'preInstalledSw', 'Value': 'NA'},
                    {'Type': 'TERM_MATCH', 'Field': 'tenancy', 'Value': 'Shared'},
                    {'Type': 'TERM_MATCH', 'Field': 'capacitystatus', 'Value': 'Used'},
                ]
            )
            
            for product_json in response['PriceList']:
                product = json.loads(product_json)
                product_attr = product['product']['attributes']
                sku = product['product']['sku']
                
                # Extract price
                terms = product['terms']['OnDemand']
                term_key = list(terms.keys())[0]
                price_dimensions = terms[term_key]['priceDimensions']
                pd_key = list(price_dimensions.keys())[0]
                price_per_unit = float(price_dimensions[pd_key]['pricePerUnit']['USD'])
                
                # Update or Create
                existing = db.query(AWSPricing).filter(AWSPricing.sku == sku).first()
                if existing:
                    existing.price_per_unit = price_per_unit
                    existing.attributes = product_attr
                else:
                    new_price = AWSPricing(
                        sku=sku,
                        service_code='AmazonEC2',
                        location=product_attr.get('location'),
                        instance_type=product_attr.get('instanceType'),
                        vcpu=product_attr.get('vcpu'),
                        memory=product_attr.get('memory'),
                        operating_system=product_attr.get('operatingSystem'),
                        tenancy=product_attr.get('tenancy'),
                        usage_type=product_attr.get('usagetype'),
                        price_per_unit=price_per_unit,
                        attributes=product_attr
                    )
                    db.add(new_price)
        
        db.commit()
        print("AWS Ingestion completed successfully.")
    except Exception as e:
        print(f"Error during AWS ingestion: {e}")
        db.rollback()
    finally:
        db.close()

def seed_sample_data(db: Session):
    print("Seeding sample AWS pricing data...")
    samples = [
        {"sku": "SAMPLE-T3-MICRO", "instance_type": "t3.micro", "location": "US East (N. Virginia)", "vcpu": "2", "memory": "1 GiB", "price_per_unit": 0.0104, "operating_system": "Linux"},
        {"sku": "SAMPLE-T3-SMALL", "instance_type": "t3.small", "location": "US East (N. Virginia)", "vcpu": "2", "memory": "2 GiB", "price_per_unit": 0.0208, "operating_system": "Linux"},
        {"sku": "SAMPLE-T3-MEDIUM", "instance_type": "t3.medium", "location": "US East (N. Virginia)", "vcpu": "2", "memory": "4 GiB", "price_per_unit": 0.0416, "operating_system": "Linux"},
        {"sku": "SAMPLE-M5-LARGE", "instance_type": "m5.large", "location": "US West (Oregon)", "vcpu": "2", "memory": "8 GiB", "price_per_unit": 0.096, "operating_system": "Linux"},
    ]
    
    for s in samples:
        existing = db.query(AWSPricing).filter(AWSPricing.sku == s['sku']).first()
        if not existing:
            new_price = AWSPricing(
                sku=s['sku'],
                service_code='AmazonEC2',
                location=s['location'],
                instance_type=s['instance_type'],
                vcpu=s['vcpu'],
                memory=s['memory'],
                operating_system=s['operating_system'],
                tenancy='Shared',
                usage_type='BoxUsage',
                price_per_unit=s['price_per_unit'],
                attributes=s
            )
            db.add(new_price)
    
    db.commit()
    print("Sample data seeded.")

if __name__ == "__main__":
    ingest_aws_pricing()
