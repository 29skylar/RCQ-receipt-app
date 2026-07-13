# RCQ_config.py
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_CONFIG_INITIALIZED = False


def _detect_project_root():
    """Find the repo root whether running locally or on Streamlit Cloud."""
    candidates = [
        os.path.abspath(os.path.join(SCRIPT_DIR, "..")),
        os.path.abspath(os.getcwd()),
    ]
    for root in candidates:
        if os.path.isfile(os.path.join(root, "app.py")):
            return root
    return candidates[0]


PROJECT_ROOT = _detect_project_root()
LOCAL_GCP_JSON_PATH = os.path.join(SCRIPT_DIR, "cqcproject-id-811fd6cca0de.json")

# Set during initialize_config()
GCP_SERVICE_ACCOUNT_INFO = None
GCP_PROJECT_ID = "cqcproject-id"
GCP_PROCESSOR_ID = "da5c716a7b47cfcf"
GCP_LOCATION = "us"
AWS_ACCESS_KEY_ID = None
AWS_SECRET_ACCESS_KEY = None
AWS_REGION = "us-east-1"
APP_PASSWORD = None

INPUT_DIR = os.path.join(PROJECT_ROOT, "receipt_images")
OUTPUT_EXCEL_PATH = os.path.join(PROJECT_ROOT, "receipt_results.xlsx")
TEMPLATE_EXCEL_PATH = os.path.join(PROJECT_ROOT, "Expense Reimbursement Form (blank).xlsx")
PROCESSED_DIR = os.path.join(PROJECT_ROOT, "receipt_images_processed")


def _load_dotenv():
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
        load_dotenv(os.path.join(PROJECT_ROOT, "passkey.env"))
    except ImportError:
        pass


def _streamlit_secrets():
    try:
        import streamlit as st
        if len(st.secrets) >= 0:
            return st.secrets
    except Exception:
        pass
    return None


def _secret(key, default=None):
    secrets = _streamlit_secrets()
    if secrets is not None:
        try:
            if key in secrets:
                return secrets[key]
        except Exception:
            pass
    return os.environ.get(key) or default


def initialize_config():
    """Load credentials once, on first use."""
    global _CONFIG_INITIALIZED
    global GCP_SERVICE_ACCOUNT_INFO, GCP_PROJECT_ID, GCP_PROCESSOR_ID, GCP_LOCATION
    global AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, APP_PASSWORD

    if _CONFIG_INITIALIZED:
        return
    _CONFIG_INITIALIZED = True

    _load_dotenv()

    secrets = _streamlit_secrets()
    if secrets is not None:
        try:
            if "gcp_service_account" in secrets:
                GCP_SERVICE_ACCOUNT_INFO = dict(secrets["gcp_service_account"])
        except Exception:
            pass

    if GCP_SERVICE_ACCOUNT_INFO is None and os.path.exists(LOCAL_GCP_JSON_PATH):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = LOCAL_GCP_JSON_PATH
    elif GCP_SERVICE_ACCOUNT_INFO is None and os.environ.get("GCP_SERVICE_ACCOUNT_JSON"):
        GCP_SERVICE_ACCOUNT_INFO = json.loads(os.environ["GCP_SERVICE_ACCOUNT_JSON"])

    GCP_PROJECT_ID = _secret("GCP_PROJECT_ID", GCP_PROJECT_ID)
    GCP_PROCESSOR_ID = _secret("GCP_PROCESSOR_ID", GCP_PROCESSOR_ID)
    GCP_LOCATION = _secret("GCP_LOCATION", GCP_LOCATION)
    AWS_ACCESS_KEY_ID = _secret("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = _secret("AWS_SECRET_ACCESS_KEY")
    AWS_REGION = _secret("AWS_REGION", AWS_REGION)
    APP_PASSWORD = _secret("APP_PASSWORD")


def resolve_template_path():
    """Return the first existing expense template path, or the default path."""
    initialize_config()
    override = _secret("TEMPLATE_EXCEL_PATH")
    if override and os.path.exists(override):
        return override

    candidates = [
        os.path.join(SCRIPT_DIR, "templates", "expense_form_template.xlsx"),
        os.path.join(PROJECT_ROOT, "templates", "expense_form_template.xlsx"),
        TEMPLATE_EXCEL_PATH,
        os.path.join(PROJECT_ROOT, "templates", "Expense Reimbursement Form (blank).xlsx"),
    ]

    for path in candidates:
        if os.path.exists(path):
            return path

    for search_dir in (
        PROJECT_ROOT,
        os.path.join(PROJECT_ROOT, "templates"),
        SCRIPT_DIR,
        os.path.join(SCRIPT_DIR, "templates"),
    ):
        if not os.path.isdir(search_dir):
            continue
        for name in os.listdir(search_dir):
            lower = name.lower()
            if lower.endswith(".xlsx") and "reimbursement" in lower and "blank" in lower:
                return os.path.join(search_dir, name)

    return TEMPLATE_EXCEL_PATH


def list_project_xlsx_files():
    """Return .xlsx filenames found in common project folders (for debugging)."""
    found = []
    for folder in (
        PROJECT_ROOT,
        os.path.join(PROJECT_ROOT, "templates"),
        SCRIPT_DIR,
        os.path.join(SCRIPT_DIR, "templates"),
    ):
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if name.lower().endswith(".xlsx"):
                found.append(os.path.join(folder, name))
    return found


def validate_credentials():
    """Return a list of missing credential names."""
    initialize_config()
    missing = []
    if not AWS_ACCESS_KEY_ID:
        missing.append("AWS_ACCESS_KEY_ID")
    if not AWS_SECRET_ACCESS_KEY:
        missing.append("AWS_SECRET_ACCESS_KEY")
    if not GCP_SERVICE_ACCOUNT_INFO and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        missing.append("GCP service account (gcp_service_account or JSON file)")
    return missing
