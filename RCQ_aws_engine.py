# RCQ_aws_engine.py
import re
import boto3
from RCQ_config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
    textract_client = None
else:
    textract_client = boto3.client(
        'textract',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION
    )


def extract_with_aws(image_path):
    """
    Uses AWS Textract's analyze_expense (purpose-built for receipts).
    Returns a dictionary with store_name, date, total, subtotal.
    """
    if textract_client is None:
        raise RuntimeError("AWS credentials are not configured.")
    with open(image_path, 'rb') as document:
        image_bytes = document.read()

    response = textract_client.analyze_expense(Document={'Bytes': image_bytes})

    result = {
        'store_name': '',
        'date': '',
        'time': '',          # ← NEW
        'total': '',
        'subtotal': '',
    }

    field_mapping = {
        'store_name': ['VENDOR_NAME', 'RECEIVER_NAME', 'NAME'],
        'date': ['INVOICE_RECEIPT_DATE', 'ORDER_DATE', 'DELIVERY_DATE'],
        'time': ['RECEIPT_TIME', 'INVOICE_RECEIPT_TIME'],  # ← NEW
        'total': ['TOTAL', 'AMOUNT_PAID', 'AMOUNT_DUE'],
        'subtotal': ['SUBTOTAL'],
    }

    # Collect all summary fields into a lookup table
    all_fields = {}
    for doc in response.get('ExpenseDocuments', []):
        for field in doc.get('SummaryFields', []):
            field_type = field.get('Type', {}).get('Text', '')
            value = field.get('ValueDetection', {}).get('Text', '')
            confidence = field.get('ValueDetection', {}).get('Confidence', 0)
            if field_type and value:
                # Keep highest-confidence value if duplicated
                if field_type not in all_fields or confidence > all_fields[field_type][1]:
                    all_fields[field_type] = (value, confidence)

    # Pick our desired fields based on priority
    for our_key, aws_types in field_mapping.items():
        for aws_type in aws_types:
            if aws_type in all_fields:
                result[our_key] = all_fields[aws_type][0].strip()
                break

    return result

# Keywords that INDICATE the actual total amount (positive signal)
# Listed in priority order — earlier ones are more reliable
TOTAL_KEYWORDS = [
    # ===== Most specific first (highest priority) =====
    '應付總額', '應付金額', '應付款', '應收金額',
    '總計金額', '合計金額', '交易金額',
    '總計', '總額', '合計',   # Traditional Chinese
    '总计金额', '合计金额',
    '总计', '总额', '合计',   # Simplified Chinese
    '小計',                   # Comes late since it might be item subtotal
    '小计',

    # ===== Top-up specific (Octopus, etc.) =====
    '增值額', '增值金額', '充值金額',
    'top up amount', 'add value amount', 'reload amount',

    # ===== English patterns =====
    'total amount due', 'amount due', 'grand total',
    'total amount', 'total price',
    'total fee', 'service fee',

    # ===== Generic English (fallback, low priority) =====
    'total', 'subtotal',
    # NOTE: removed generic 'amount' and 'fee' from here since they were causing false matches
]

# Keywords that indicate PAYMENT, not the total
# Numbers near these should be IGNORED
PAYMENT_KEYWORDS = [
    # ===== Chinese =====
    '現金', '收現', '收款', '實收', '實付',
    '找零', '找錢', '零錢', '退款',
    '信用卡', '刷卡', '電子支付', '行動支付',
    '八達通', '易辦事', 'eps',
    '现金', '收现', '实收',
    # ===== English =====
    'cash', 'change', 'tendered', 'paid', 'payment', 'received',
    'credit card', 'debit', 'visa', 'mastercard', 'octopus',
]

# Lines containing these substrings are NEVER the grand total
# They're subtotals, balances, remaining values, quantities, etc.
SKIP_LINE_KEYWORDS = [
    # ===== Item-level subtotals (Chinese) =====
    '項目總計', '項目小計', '項目合計', '項目金額',
    '商品總計', '商品小計', '商品合計',
    # ===== Item-level subtotals (English) =====
    'item total', 'item subtotal', 'items total',
    'sub-total of items', 'subtotal of items',

    # ===== Balance / Remaining Value (Octopus, prepaid cards) =====
    '餘額', '餘值', '新餘值', '舊餘值', '結餘', '剩餘',
    'remaining value', 'remaining balance', 'balance',
    'previous balance', 'current balance', 'new balance',
    'old value', 'new value',

    # ===== Top-up / Deducted amounts =====
    '已付數額', '已付金額', '扣除金額', '扣款', '扣除',
    'deducted amount', 'amount deducted', 'debited amount',

    # ===== Quantity / distance / time (NOT money) =====
    'total km', 'total kilometers', 'total distance', 'distance',
    'total time', 'duration', 'trip time',
    '總公里', '總里程', '里程', '距離',
    'quantity', 'qty', 'count', 'pieces', 'pcs',

    # ===== Change / cash tendered =====
    '應找', '找回', '找續',
    'change due', 'amount tendered',
]

def _extract_number_from_text(text):
    """Pulls the largest positive number out of a text string."""
    matches = re.findall(r'([\d,]+\.\d{1,2}|\d{1,3}(?:,\d{3})+|\d+)', text)
    numbers = []
    for m in matches:
        clean = m.replace(',', '')
        try:
            num = float(clean)
            if num > 0:
                numbers.append((num, m))
        except ValueError:
            pass
    if not numbers:
        return ''
    # Return the largest match (handles cases like "小計 NT$ 280" cleanly)
    numbers.sort(key=lambda x: x[0], reverse=True)
    return numbers[0][1]

def extract_total_by_keyword(image_path):
    """
    AWS-based line-scanner for total keywords.
    Skips subtotal/balance/quantity lines using SKIP_LINE_KEYWORDS.
    """
    if textract_client is None:
        return ''

    with open(image_path, 'rb') as document:
        image_bytes = document.read()

    response = textract_client.detect_document_text(Document={'Bytes': image_bytes})

    lines = []
    for block in response['Blocks']:
        if block['BlockType'] == 'LINE':
            text = block.get('Text', '').strip()
            if text:
                bbox = block['Geometry']['BoundingBox']
                lines.append({
                    'text': text,
                    'lower': text.lower(),
                    'top': bbox['Top'],
                })
    lines.sort(key=lambda l: l['top'])

    for keyword in TOTAL_KEYWORDS:
        matches = []

        for i, line in enumerate(lines):
            # Skip payment lines
            if any(pk in line['lower'] for pk in PAYMENT_KEYWORDS):
                continue

            # NEW: Skip lines with subtotal/balance/quantity indicators
            if any(sk.lower() in line['lower'] for sk in SKIP_LINE_KEYWORDS):
                continue

            idx = line['lower'].find(keyword.lower())
            if idx == -1:
                continue

            # Take text AFTER the keyword (not before, to avoid random prefixes)
            after_keyword = line['text'][idx + len(keyword):]
            number = _extract_first_number(after_keyword)
            if number:
                # Reject if immediately followed by a non-monetary unit
                unit_pattern = re.compile(
                    re.escape(number) + r'\s*(km|kg|pcs|pc|件|個|公里|分鐘|小時|min|hr)',
                    re.IGNORECASE
                )
                if unit_pattern.search(after_keyword):
                    continue
                matches.append((line['text'], number))
                continue

            if i + 1 < len(lines):
                next_line = lines[i + 1]
                if any(pk in next_line['lower'] for pk in PAYMENT_KEYWORDS):
                    continue
                if any(sk.lower() in next_line['lower'] for sk in SKIP_LINE_KEYWORDS):
                    continue
                number = _extract_first_number(next_line['text'])
                if number:
                    unit_pattern = re.compile(
                        re.escape(number) + r'\s*(km|kg|pcs|pc|件|個|公里|分鐘|小時|min|hr)',
                        re.IGNORECASE
                    )
                    if unit_pattern.search(next_line['text']):
                        continue
                    matches.append((next_line['text'], number))

        if matches:
            line, number = matches[-1]  # prefer last match (grand totals are at bottom)
            print(f"   Keyword match: '{keyword}' on line '{line}' -> {number}")
            return number

    return ''

def extract_total_from_text(full_text):
    """
    Scans GCP's full OCR text for total-keywords. Two improvements over the basic version:
      1. Skips lines that are clearly subtotals or line items
      2. When multiple lines match, prefers the LAST one (grand totals at bottom)
      3. Rejects numbers followed by units (km, kg, pcs, etc.)
    """
    if not full_text:
        return ''

    raw_lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()]

    for keyword in TOTAL_KEYWORDS:
        matches = []

        for i, line in enumerate(raw_lines):
            line_lower = line.lower()

            # Skip payment lines
            if any(pk in line_lower for pk in PAYMENT_KEYWORDS):
                continue

            # Skip lines that are clearly subtotals / balances / non-monetary
            if any(sk.lower() in line_lower for sk in SKIP_LINE_KEYWORDS):
                continue

            idx = line_lower.find(keyword.lower())
            if idx == -1:
                continue

            after_keyword = line[idx + len(keyword):]
            number = _extract_first_number(after_keyword)
            if number:
                # NEW: Reject if the number is immediately followed by a non-monetary unit
                unit_pattern = re.compile(
                    re.escape(number) + r'\s*(km|kg|pcs|pc|件|個|公里|分鐘|小時|min|hr)',
                    re.IGNORECASE
                )
                if unit_pattern.search(after_keyword):
                    continue  # skip — it's a quantity, not money
                matches.append((line, number))
                continue

            if i + 1 < len(raw_lines):
                next_line = raw_lines[i + 1]
                if any(pk in next_line.lower() for pk in PAYMENT_KEYWORDS):
                    continue
                if any(sk.lower() in next_line.lower() for sk in SKIP_LINE_KEYWORDS):
                    continue
                number = _extract_first_number(next_line)
                if number:
                    unit_pattern = re.compile(
                        re.escape(number) + r'\s*(km|kg|pcs|pc|件|個|公里|分鐘|小時|min|hr)',
                        re.IGNORECASE
                    )
                    if unit_pattern.search(next_line):
                        continue
                    matches.append((next_line, number))

        if matches:
            line, number = matches[-1]
            print(f"   GCP-text match: '{keyword}' on '{line}' -> {number}")
            return number

    return ''

def _extract_first_number(text):
    """Pulls the FIRST number out of a text string (not the largest)."""
    if not text:
        return ''
    # Matches "1,234.56", "1,234", "234.56", or "234"
    match = re.search(r'(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)', text)
    return match.group(1) if match else ''

# ============================================================
# Receipt categorization (keyword-based)
# ============================================================

CATEGORY_KEYWORDS = {
    'Convenience Store': [
        # Match these BEFORE 'Food' because some chains (FamilyMart) sell food too
        '7-eleven', '7-11', 'seven eleven', 'seven-eleven',
        'familymart', 'family mart', '全家',
        'circle k', 'circle-k', 'ok便利店', 'ok mart',
        '便利店', '便利商店', '7仔',
    ],
    'Refuel': [
        'shell', 'caltex', 'esso', 'sinopec', 'chevron', 'mobil',
        'petrol', 'gasoline', 'diesel', 'fuel',
        '加油', '加油站', '汽油', '柴油',
        '中油', '台塑', '中華石油',
    ],
    'Accommodation': [
        'hotel', 'hostel', 'inn', 'motel', 'resort', 'lodge', 'guesthouse',
        'airbnb', 'booking.com', 'agoda', 'expedia', 'trivago',
        'hilton', 'marriott', 'sheraton', 'hyatt', 'shangri-la',
        'holiday inn', 'mandarin oriental',
        '酒店', '飯店', '旅館', '民宿', '住宿',
    ],
    'Travel': [
        'taxi', 'uber', 'lyft', 'grab', 'didi',
        '計程車', '的士', '出租車',
        'mtr', '港鐵', '捷運', '地鐵', 'metro', 'subway',
        'bus', '巴士', '公車', '客運',
        'airline', 'airways', 'flight',
        'cathay', 'eva air', 'china airlines', 'singapore airlines',
        '國泰', '長榮', '華航',
        'high speed rail', 'hsr', '高鐵', '台鐵', 'railway', '鐵路',
    ],
    'Food': [
        'restaurant', 'cafe', 'coffee', 'bistro', 'diner', 'eatery',
        'starbucks', 'pacific coffee', 'costa', 'tim hortons',
        'mcdonald', 'kfc', 'burger king', 'subway', 'pizza hut', 'domino',
        '餐廳', '餐廰', '飯店', '茶餐廳', '酒樓', '快餐',
        '咖啡', '茶餐', '飲品店', '甜品',
        '麥當勞', '肯德基', '必勝客',
        '餐飲', '餐費', '美食',
        '燒臘', '火鍋', '日本料理', '韓國料理', '泰國菜',
    ],
    'Parking': [
        # English
        'parking', 'car park', 'carpark', 'parking lot', 'parking fee',
        # Traditional Chinese (HK/Taiwan)
        '停車', '泊車', '停車場', '泊車場', '停車費', '泊車費',
        # Simplified Chinese
        '停车', '泊车', '停车场', '停车费',
        # Common HK/TW operators
        'wilson parking', 'wilson', '威信停車',
        'parkn shop park', 'imperial parking',
    ],
}

# Order matters — check Convenience Store and Refuel first because
# they can be confused with Food/Other otherwise
CATEGORY_PRIORITY = ['Convenience Store', 'Refuel', 'Accommodation', 'Parking', 'Travel', 'Food']

# Taiwan uniform invoice (統一發票) — strong single-match signals
TAIWAN_RECEIPT_STRONG_KEYWORDS = [
    '統一發票', '電子發票', '證明聯', '隨機碼',
    '營業人統一編號', '統一編號',
    '新台幣', 'nt$', 'twd',
]

# Supporting TW invoice fields — two or more needed without a strong signal
TAIWAN_RECEIPT_SUPPORTING_KEYWORDS = [
    '發票號碼', '賣方', '買方', '統編', '載具',
]

# Two letters + eight digits, e.g. AB-12345678 or AB12345678
TAIWAN_INVOICE_NUMBER_PATTERN = re.compile(r'[A-Za-z]{2}-?\d{8}')


def is_taiwan_receipt(store_name, full_text):
    """
    Detects Taiwan uniform-invoice receipts from OCR text.
    HK and other regions should not match unless they carry TW invoice markers.
    """
    combined = f"{store_name or ''}\n{full_text or ''}"
    text_lower = combined.lower()

    if TAIWAN_INVOICE_NUMBER_PATTERN.search(combined):
        return True

    for keyword in TAIWAN_RECEIPT_STRONG_KEYWORDS:
        if keyword.lower() in text_lower:
            return True

    supporting_hits = sum(
        1 for keyword in TAIWAN_RECEIPT_SUPPORTING_KEYWORDS
        if keyword in combined
    )
    return supporting_hits >= 2


def categorize_receipt(store_name, full_text):
    """
    Returns one of: 'Food', 'Travel', 'Travel Expense', 'Accommodation',
                    'Refuel', 'Convenience Store', 'Parking', 'Other'

    'Travel' is a standalone category (taxi, MTR, flights, etc.).
    Taiwan receipts that would be 'Convenience Store' or 'Other' are
    reclassified as 'Travel Expense'.
    """
    name_lower = (store_name or '').lower()
    text_lower = (full_text or '').lower()

    # Strong food override: if any of these appear in the STORE NAME,
    # the receipt is definitely Food regardless of other matches
    strong_food_indicators = [
        '餐飲', '餐廳', '餐廰', '飲食', '美食',
        '茶餐廳', '酒樓', '火鍋', '燒臘',
        'restaurant', 'cafe', 'bistro', 'eatery', 'diner',
    ]
    for indicator in strong_food_indicators:
        if indicator.lower() in name_lower:
            return 'Food'

    # Score-based matching for everything else
    scores = {cat: 0 for cat in CATEGORY_PRIORITY}

    for category in CATEGORY_PRIORITY:
        for keyword in CATEGORY_KEYWORDS[category]:
            kw_lower = keyword.lower()
            if kw_lower in name_lower:
                scores[category] += 3
            if kw_lower in text_lower:
                scores[category] += 1

    best_category = max(scores, key=lambda cat: scores[cat])
    if scores[best_category] > 0:
        category = best_category
    else:
        category = 'Other'

    # TW receipts that land in Convenience Store or Other are travel expenses
    if category in ('Convenience Store', 'Other') and is_taiwan_receipt(store_name, full_text):
        return 'Travel Expense'

    return category

def extract_amount_by_currency(full_text):
    """
    Last-resort amount detector: finds currency-prefixed numbers.
    Skips lines that contain balance/remaining/quantity keywords.
    """
    if not full_text:
        return ''

    pattern = r'(?:NT|HK|USD?|RMB|JPY)?\s*\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,5}(?:\.\d{1,2})?)(?!\d)'

    amounts = []
    for line in full_text.splitlines():
        line_lower = line.lower()

        # Skip lines with balance/remaining/subtotal keywords
        if any(sk.lower() in line_lower for sk in SKIP_LINE_KEYWORDS):
            continue
        # Skip payment lines
        if any(pk in line_lower for pk in PAYMENT_KEYWORDS):
            continue

        for m in re.findall(pattern, line, re.IGNORECASE):
            try:
                val = float(m.replace(',', ''))
                if 1 <= val <= 99999:
                    amounts.append((val, m))
            except ValueError:
                pass

    if not amounts:
        return ''

    amounts.sort(key=lambda x: x[0], reverse=True)
    print(f"   Currency-pattern match: found {len(amounts)} amount(s), picked ${amounts[0][1]}")
    return amounts[0][1]

# Known vendors we can detect by keyword when API store-name extraction fails
KNOWN_VENDORS = [
    ('Taiwan High Speed Rail', ['台灣高鐵', 'taiwan high speed rail', 'thsrc', '高鐵']),
    ('Taiwan Railways', ['台鐵', 'taiwan railways', 'tra']),
    ('MTR Hong Kong', ['港鐵', 'mtr hong kong']),
    ('FamilyMart', ['familymart', 'family mart', '全家便利']),
    ('7-Eleven', ['7-eleven', 'seven eleven', '7-11']),
]


def detect_known_vendor(full_text):
    """
    When AWS/GCP can't extract a store name, scan the OCR text for
    keywords of known vendors (train companies, chain stores, etc).
    Returns the friendly vendor name, or '' if nothing matches.
    """
    if not full_text:
        return ''
    text_lower = full_text.lower()
    for vendor_name, keywords in KNOWN_VENDORS:
        for kw in keywords:
            if kw.lower() in text_lower:
                return vendor_name
    return ''