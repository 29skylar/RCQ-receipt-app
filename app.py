# app.py — Streamlit web UI for RCQ receipt processing
import importlib
import os
import shutil
import sys
import tempfile
from datetime import datetime

import pandas as pd
import streamlit as st

# Allow imports from Main/
MAIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Main")
if MAIN_DIR not in sys.path:
    sys.path.insert(0, MAIN_DIR)

import RCQ_main_pipeline  # noqa: E402
from RCQ_config import APP_PASSWORD, validate_credentials  # noqa: E402

APP_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_TEMP_ROOT = os.path.join(APP_DIR, "_upload_temp")

st.set_page_config(
    page_title="RCQ — Receipt Capture",
    page_icon="🧾",
    layout="wide",
)

missing_credentials = validate_credentials()
if missing_credentials:
    st.error("Missing credentials. Configure Streamlit secrets or a local `.env` file.")
    st.code("\n".join(f"- {name}" for name in missing_credentials))
    st.info(
        "For Streamlit Cloud: add secrets at share.streamlit.io → your app → Settings → Secrets. "
        "See `.streamlit/secrets.toml.example` for the format."
    )
    st.stop()

if APP_PASSWORD:
    if "rcq_authenticated" not in st.session_state:
        st.session_state.rcq_authenticated = False

    if not st.session_state.rcq_authenticated:
        st.title("RCQ — Login")
        password = st.text_input("Password", type="password")
        if st.button("Enter", type="primary"):
            if password == APP_PASSWORD:
                st.session_state.rcq_authenticated = True
                st.rerun()
            else:
                st.error("Incorrect password.")
        st.stop()

st.title("🧾 RCQ — Receipt Capture & Query")
st.markdown(
    "Upload receipt images or PDFs. The app extracts store name, date, amount, "
    "and category using AWS Textract and Google Document AI, then generates "
    "an expense reimbursement Excel file."
)

with st.sidebar:
    st.header("How it works")
    st.markdown(
        """
1. Upload one or more receipt files
2. Click **Process receipts**
3. Review the extracted data
4. Download the Excel report
        """
    )
    st.divider()
    st.caption("Supported formats: PNG, JPG, JPEG, BMP, TIFF, PDF")

uploaded_files = st.file_uploader(
    "Upload receipts",
    type=["png", "jpg", "jpeg", "bmp", "tiff", "tif", "pdf"],
    accept_multiple_files=True,
)

if uploaded_files:
    st.info(f"{len(uploaded_files)} file(s) ready to process.")

process_clicked = st.button("Process receipts", type="primary", disabled=not uploaded_files)

if process_clicked and uploaded_files:
    progress = st.progress(0, text="Preparing files...")
    status = st.empty()

    try:
        os.makedirs(UPLOAD_TEMP_ROOT, exist_ok=True)
        work_dir = os.path.abspath(tempfile.mkdtemp(dir=UPLOAD_TEMP_ROOT))
        try:
            saved_files = []
            for idx, uploaded in enumerate(uploaded_files):
                save_path = os.path.join(work_dir, uploaded.name)
                with open(save_path, "wb") as f:
                    f.write(uploaded.getbuffer())
                saved_files.append((uploaded.name, save_path))
                progress.progress(
                    (idx + 1) / (len(uploaded_files) + 1),
                    text=f"Saved {uploaded.name}",
                )

            status.info("Running AWS Textract and Google Document AI — this may take a minute...")
            importlib.reload(RCQ_main_pipeline)
            results, output_path, excel_bytes = RCQ_main_pipeline.process_uploaded_files(
                saved_files, work_dir
            )
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

        progress.progress(1.0, text="Done!")
        progress.empty()
        status.empty()

        if not results:
            st.warning("No valid receipt files were found in your upload.")
        else:
            stats = RCQ_main_pipeline.summarize_results(results)
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Receipts processed", len(results))
            col2.metric("High confidence", stats["high"])
            col3.metric("Needs review", stats["review"])
            col4.metric("Low confidence", stats["low"])

            display_rows = []
            for row in results:
                display_rows.append({
                    "Filename": row["Filename"],
                    "Date": row["Date"].strftime("%d-%b-%Y") if row["Date"] else "",
                    "Time": row["Time"],
                    "Category": row["Category"],
                    "Store": row["Store_Name"],
                    "Amount": row["Amount"],
                    "Confidence": row["Confidence_Flag"],
                })

            st.subheader("Extracted data")
            st.dataframe(pd.DataFrame(display_rows), use_container_width=True, hide_index=True)

            if excel_bytes:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                download_name = f"receipt_results_{timestamp}.xlsx"
                st.download_button(
                    label="Download Excel report",
                    data=excel_bytes,
                    file_name=download_name,
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    type="primary",
                )

    except Exception as e:
        progress.empty()
        status.empty()
        st.error(f"Processing failed: {e}")
        st.exception(e)
