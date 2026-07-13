# RCQ_pdf_handler.py
import io
import os
import re


def _safe_filename(name):
    """Remove characters that are invalid on Windows file paths."""
    return re.sub(r'[<>:"/\\|?*]', '_', name)


def _pdf_to_images(pdf_path):
    """
    Convert a PDF file to a list of PIL Images (one per page).
    Uses pdf2image (poppler) on Streamlit Cloud; optional PyMuPDF fallback locally.
    """
    try:
        from pdf2image import convert_from_path
        return convert_from_path(pdf_path, dpi=200, fmt='png')
    except Exception as pdf2image_err:
        print(f"   pdf2image failed ({pdf2image_err}); trying PyMuPDF fallback...")
        try:
            import fitz
            from PIL import Image

            doc = fitz.open(pdf_path)
            images = []
            for page in doc:
                pix = page.get_pixmap(dpi=200)
                images.append(Image.open(io.BytesIO(pix.tobytes("png"))))
            doc.close()
            return images
        except Exception as fitz_err:
            raise RuntimeError(
                f"PDF conversion failed: pdf2image={pdf2image_err}; pymupdf={fitz_err}"
            ) from fitz_err


def expand_pdf_to_pages(filename, pdf_path, output_dir):
    """
    Convert a PDF into one PNG per page for receipt processing.
    APIs receive PNG images only — avoids native PDF/grpc crashes on Linux hosts.
    Returns a list of (display_name, path) tuples.
    """
    output_dir = os.path.abspath(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.abspath(pdf_path)
    base_name = _safe_filename(os.path.splitext(filename)[0])

    try:
        images = _pdf_to_images(pdf_path)
    except Exception as e:
        print(f"   Could not convert PDF {pdf_path}: {e}")
        return []

    if not images:
        print(f"   PDF produced no pages: {filename}")
        return []

    page_count = len(images)
    if page_count > 1:
        print(f"\nConverting PDF to {page_count} PNG pages: {filename}")

    entries = []
    for page_index, image in enumerate(images, start=1):
        if page_count == 1:
            page_filename = f"{base_name}.png"
            display = filename
        else:
            page_filename = f"{base_name}_page{page_index}.png"
            display = f"{filename} (page {page_index})"

        page_path = os.path.join(output_dir, page_filename)
        image.save(page_path, "PNG")
        entries.append((display, page_path))
        if page_count > 1:
            print(f"   Page {page_index} -> {page_filename}")

    return entries
