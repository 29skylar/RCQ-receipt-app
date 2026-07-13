# RCQ_pdf_handler.py
import io
import os
import re

from PIL import Image


def _get_fitz():
    """Lazy import — PyMuPDF can segfault on some cloud hosts at module import."""
    import fitz
    return fitz


def _safe_filename(name):
    """Remove characters that are invalid on Windows file paths."""
    return re.sub(r'[<>:"/\\|?*]', '_', name)


def _pixmap_to_png_bytes(pix):
    """Encode a PyMuPDF pixmap to PNG bytes without touching the filesystem."""
    mode = "RGBA" if pix.alpha else "RGB"
    img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


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
        fitz = _get_fitz()
        with open(os.path.abspath(pdf_path), "rb") as pdf_file:
            pdf_bytes = pdf_file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"   Could not open PDF {pdf_path}: {e}")
        return []

    page_count = len(doc)
    base_name = _safe_filename(os.path.splitext(filename)[0])

    if page_count <= 1:
        doc.close()
        return [(filename, pdf_path)]

    print(f"\nSplitting PDF into {page_count} pages: {filename}")
    entries = []

    try:
        fitz = _get_fitz()
        for page_index in range(page_count):
            page_num = page_index + 1
            single_page_doc = fitz.open()
            single_page_doc.insert_pdf(doc, from_page=page_index, to_page=page_index)

            page_filename = f"{base_name}_page{page_num}.pdf"
            page_path = os.path.join(output_dir, page_filename)
            with open(page_path, "wb") as page_file:
                page_file.write(single_page_doc.tobytes())

            single_page_doc.close()
            entries.append((f"{filename} (page {page_num})", page_path))
            print(f"   Extracted page {page_num} -> {page_filename}")
    finally:
        doc.close()

    return entries


def convert_pdf_to_images(pdf_path, output_dir, dpi=300):
    """
    Converts every page of a PDF into a high-resolution PNG image.
    Returns a list of image file paths (one per page).
    """
    image_paths = []
    pdf_filename = _safe_filename(os.path.splitext(os.path.basename(pdf_path))[0])
    output_dir = os.path.abspath(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    try:
        fitz = _get_fitz()
        with open(os.path.abspath(pdf_path), "rb") as pdf_file:
            pdf_bytes = pdf_file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"   Could not open PDF {pdf_path}: {e}")
        return []

    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)

    page_count = len(doc)
    try:
        for page_index in range(page_count):
            page_num = page_index + 1
            page = doc[page_index]
            pix = page.get_pixmap(matrix=matrix, alpha=False)

            if page_count == 1:
                output_filename = f"{pdf_filename}.png"
            else:
                output_filename = f"{pdf_filename}_page{page_num}.png"

            output_path = os.path.join(output_dir, output_filename)
            with open(output_path, "wb") as img_file:
                img_file.write(_pixmap_to_png_bytes(pix))
            image_paths.append(output_path)
            print(f"   Converted PDF page {page_num} -> {output_filename}")
    finally:
        doc.close()

    return image_paths