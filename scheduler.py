import time
import schedule
from aws_ingester import ingest_aws_pricing
from azure_ingester import ingest_azure_pricing
from gcp_ingester import ingest_gcp_pricing

def run_all_ingestions():
    print("Starting daily ingestion task...")
    ingest_aws_pricing()
    ingest_azure_pricing()
    ingest_gcp_pricing()
    print("Daily ingestion task completed.")

# Schedule daily at 2:00 AM
schedule.every().day.at("02:00").do(run_all_ingestions)

def start_scheduler():
    print("Scheduler started. Waiting for tasks...")
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    run_all_ingestions() # Run once on start
    start_scheduler()
