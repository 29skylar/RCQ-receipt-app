# RCQ_pdf_handler.py
import os
import re

from pypdf import PdfReader, PdfWriter


def _safe_filename(name):
    """Remove characters that are invalid on Windows file paths."""
    return re.sub(r'[<>:"/\\|?*]', '_', name)


def expand_pdf_to_pages(filename, pdf_path, output_dir):
    """
    Expand a PDF into one entry per page for separate receipt processing.
    Single-page PDFs are returned as-is. Multi-page PDFs are split into
    individual single-page PDF files.
    Returns a list of (display_name, path) tuples.
    """
    output_dir = os.path.abspath(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    try:
        reader = PdfReader(os.path.abspath(pdf_path))
        page_count = len(reader.pages)
    except Exception as e:
        print(f"   Could not open PDF {pdf_path}: {e}")
        return []

    if page_count <= 1:
        return [(filename, pdf_path)]

    print(f"\nSplitting PDF into {page_count} pages: {filename}")
    base_name = _safe_filename(os.path.splitext(filename)[0])
    entries = []

    for page_index in range(page_count):
        page_num = page_index + 1
        writer = PdfWriter()
        writer.add_page(reader.pages[page_index])

        page_filename = f"{base_name}_page{page_num}.pdf"
        page_path = os.path.join(output_dir, page_filename)
        with open(page_path, "wb") as page_file:
            writer.write(page_file)

        entries.append((f"{filename} (page {page_num})", page_path))
        print(f"   Extracted page {page_num} -> {page_filename}")

    return entries
