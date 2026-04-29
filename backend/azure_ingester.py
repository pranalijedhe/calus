import requests
import os

def ingest_azure_pricing():
    try:
        # Get server URL from environment or default
        server_url = os.getenv("SERVER_URL", "http://localhost:3000")

        # Login as admin to get token
        login_response = requests.post(f"{server_url}/api/v1/auth/login", json={
            "email": "admin@yourcompany.com",
            "password": "yourpassword"
        })

        if login_response.status_code != 200:
            print(f"Azure Ingestion: Failed to authenticate - {login_response.status_code}")
            return

        token = login_response.json().get("token")
        if not token:
            print("Azure Ingestion: No token received")
            return

        # Call sync API
        headers = {"Authorization": f"Bearer {token}"}
        sync_response = requests.post(f"{server_url}/api/v1/azure/sync-pricing", headers=headers, json={})

        if sync_response.status_code == 200:
            print("Azure Ingestion: Successfully synced pricing data")
        else:
            print(f"Azure Ingestion: Failed to sync - {sync_response.status_code} - {sync_response.text}")

    except Exception as e:
        print(f"Azure Ingestion: Error - {str(e)}")

if __name__ == "__main__":
    ingest_azure_pricing()
