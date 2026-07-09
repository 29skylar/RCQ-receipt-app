# RCQ_config.py
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))


def _load_dotenv():
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
    except ImportError:
        pass


def _streamlit_secrets():
    try:
        import streamlit as st
        return st.secrets
    except Exception:
        return None


def _secret(key, default=None):
    value = os.environ.get(key)
    if value:
        return value

    secrets = _streamlit_secrets()
    if secrets is not None and key in secrets:
        return secrets[key]

    return default


_load_dotenv()

# ===== Google Cloud credentials =====
LOCAL_GCP_JSON_PATH = os.path.join(SCRIPT_DIR, "cqcproject-id-811fd6cca0de.json")
GCP_SERVICE_ACCOUNT_INFO = None

_secrets = _streamlit_secrets()
if _secrets is not None and "gcp_service_account" in _secrets:
    GCP_SERVICE_ACCOUNT_INFO = dict(_secrets["gcp_service_account"])
elif os.path.exists(LOCAL_GCP_JSON_PATH):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = LOCAL_GCP_JSON_PATH
elif os.environ.get("GCP_SERVICE_ACCOUNT_JSON"):
    GCP_SERVICE_ACCOUNT_INFO = json.loads(os.environ["GCP_SERVICE_ACCOUNT_JSON"])

# ===== GCP Document AI settings =====
GCP_PROJECT_ID = _secret("GCP_PROJECT_ID", "cqcproject-id")
GCP_PROCESSOR_ID = _secret("GCP_PROCESSOR_ID", "da5c716a7b47cfcf")
GCP_LOCATION = _secret("GCP_LOCATION", "us")

# ===== AWS Textract credentials =====
AWS_ACCESS_KEY_ID = _secret("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = _secret("AWS_SECRET_ACCESS_KEY")
AWS_REGION = _secret("AWS_REGION", "us-east-1")

# ===== Optional app access control =====
APP_PASSWORD = _secret("APP_PASSWORD")

# ===== Paths =====
INPUT_DIR = os.path.join(PROJECT_ROOT, "receipt_images")
OUTPUT_EXCEL_PATH = os.path.join(PROJECT_ROOT, "receipt_results.xlsx")
TEMPLATE_EXCEL_PATH = os.path.join(PROJECT_ROOT, "Expense Reimbursement Form (blank).xlsx")
PROCESSED_DIR = os.path.join(PROJECT_ROOT, "receipt_images_processed")


def validate_credentials():
    """Return a list of missing credential names."""
    missing = []
    if not AWS_ACCESS_KEY_ID:
        missing.append("AWS_ACCESS_KEY_ID")
    if not AWS_SECRET_ACCESS_KEY:
        missing.append("AWS_SECRET_ACCESS_KEY")
    if not GCP_SERVICE_ACCOUNT_INFO and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        missing.append("GCP service account (gcp_service_account or JSON file)")
    return missing
