# RCQ_gcp_engine.py
import os


def _get_gcp_client():
    from google.cloud import documentai_v1 as documentai
    from google.oauth2 import service_account
    from RCQ_config import (
        GCP_PROJECT_ID,
        GCP_LOCATION,
        GCP_PROCESSOR_ID,
        GCP_SERVICE_ACCOUNT_INFO,
        initialize_config,
    )

    initialize_config()
    opts = {"api_endpoint": f"{GCP_LOCATION}-documentai.googleapis.com"}
    if GCP_SERVICE_ACCOUNT_INFO:
        credentials = service_account.Credentials.from_service_account_info(
            GCP_SERVICE_ACCOUNT_INFO
        )
        return documentai.DocumentProcessorServiceClient(
            credentials=credentials,
            client_options=opts,
        )
    return documentai.DocumentProcessorServiceClient(client_options=opts)


def extract_with_gcp(image_path):
    """
    Uses Google Cloud Document AI Expense Parser.
    Returns a dictionary with store_name, date, total, subtotal.
    """
    from google.cloud import documentai_v1 as documentai
    from RCQ_config import GCP_PROJECT_ID, GCP_LOCATION, GCP_PROCESSOR_ID

    client = _get_gcp_client()
    name = client.processor_path(GCP_PROJECT_ID, GCP_LOCATION, GCP_PROCESSOR_ID)

    # Detect MIME type from extension
    lower = image_path.lower()
    if lower.endswith('.png'):
        mime_type = 'image/png'
    elif lower.endswith(('.jpg', '.jpeg')):
        mime_type = 'image/jpeg'
    elif lower.endswith('.pdf'):
        mime_type = 'application/pdf'
    else:
        mime_type = 'image/png'

    with open(image_path, "rb") as image:
        image_content = image.read()

    raw_document = documentai.RawDocument(content=image_content, mime_type=mime_type)
    request = documentai.ProcessRequest(name=name, raw_document=raw_document)

    response = client.process_document(request=request)
    document = response.document

    result = {
        'store_name': '',
        'date': '',
        'time': '',          # ← NEW
        'total': '',
        'subtotal': '',
    }

    # GCP Expense Parser entity type mapping (in priority order)
    field_mapping = {
        'store_name': ['supplier_name', 'merchant_name', 'receiver_name'],
        'date': [
            'receipt_date', 'invoice_date', 'purchase_date',
            'start_date', 'service_start_date', 'check_in_date',
            'transaction_date', 'issue_date', 'order_date',
        ],
        'time': ['purchase_time', 'receipt_time', 'transaction_time'],
        'total': ['total_amount', 'total_price', 'net_amount'],
        'subtotal': ['subtotal_amount', 'subtotal'],
    }
    # ===== TEMPORARY DEBUG =====
    print(f"   --- GCP raw entities for {os.path.basename(image_path)} ---")
    if not document.entities:
        print(f"   (no entities returned at all)")
    for entity in document.entities:
        print(f"   type='{entity.type_}' | text='{entity.mention_text}' | conf={entity.confidence:.2f}")
    print(f"   --- end of GCP entities ---")
    # ===== END DEBUG =====
    # Build a lookup of entity_type -> highest-confidence text
    entities = {}
    for entity in document.entities:
        entity_type = entity.type_.lower()
        text = entity.mention_text.strip()
        confidence = entity.confidence
        if text:
            if entity_type not in entities or confidence > entities[entity_type][1]:
                entities[entity_type] = (text, confidence)

    # Map to our output keys
    for our_key, gcp_types in field_mapping.items():
        for gcp_type in gcp_types:
            if gcp_type in entities:
                result[our_key] = entities[gcp_type][0]
                break

    # NEW: also return the full OCR text for fallback keyword search
    result['_full_text'] = document.text

    return result