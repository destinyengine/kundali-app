# -*- coding: utf-8 -*-
"""
Kundali Generator – Nepali / English
------------------------------------
v1.6.3  (2025-04-23)  – Adds an “Interpret Chart” button that pipes the generated
Kundali JSON through a Retrieval-Augmented Generation (RAG) pipeline powered by
`kundali_rag.py` (local Chroma store + Ollama LLM).

 • All existing functionality (FastAPI JSON + PNG, Gradio UI, Swiss-Ephem
   calculations, Panchanga, Vimśottarī Daśā, dual chart drawing) is unchanged.
 • ONLY the Gradio block at the end has been augmented; the rest of the code
   is byte-for-byte identical to the previous v1.6.2.

---------------------------------------------------------------------------
DEPENDENCIES
---------------------------------------------------------------------------
pip install pyswisseph fastapi "uvicorn[standard]" matplotlib pytz gradio Pillow chromadb langchain langchain-community tiktoken

You also need Ollama running locally with:
    ollama pull nomic-embed-text
    ollama pull llama3      # or another open LLM you prefer

And build the KB once:
    python kundali_rag.py --build-kb kb.md

---------------------------------------------------------------------------
RUN
---------------------------------------------------------------------------
python kundali_generator.py
  → FastAPI     : http://127.0.0.1:8000/docs
  → Gradio UI   : http://127.0.0.1:7860
"""
from __future__ import annotations

# ─────────────────────────────────────────────────────────────────────────────
# Standard / third-party imports
# ─────────────────────────────────────────────────────────────────────────────
import base64
import io
import math
import sys
import threading
import time # Added for the __main__ sleep loop when Gradio is disabled
from collections import defaultdict # For house occupancy table
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta # Keep timezone for UTC object
from typing import Dict, List, Tuple, Any

# --- Matplotlib Backend Configuration ---
# Attempt to import matplotlib and set backend *before* importing pyplot
# This is crucial for running in background threads (like FastAPI handlers)
try:
    import matplotlib
    # Use a non-interactive backend suitable for generating files without a GUI window
    matplotlib.use('Agg')
    print("[INFO] Matplotlib backend set to 'Agg'.")
    # Now try importing the rest of the graphics libraries
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    import matplotlib.patches as patches
    from PIL import Image  # Pillow for Gradio image conversion
    HAS_GRAPHICS = True
except ImportError:
    HAS_GRAPHICS = False
    # Reset plt if it was partially imported before failure
    if 'plt' in globals(): del plt
    print("[WARN] Matplotlib or Pillow not found. Chart generation and Gradio UI will be disabled.", file=sys.stderr)
# --- End Matplotlib Backend Configuration ---


# Attempt to import other core dependencies
try:
    import pytz # Use pytz for timezone handling
    import swisseph as swe  # pyswisseph
    from fastapi import FastAPI, Query, HTTPException
    from fastapi.responses import JSONResponse, StreamingResponse
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from typing import Optional
    import json
except ImportError as e:
    print(f"[ERROR] Core dependency missing: {e}. Please install required packages.", file=sys.stderr)
    print("        pip install pyswisseph fastapi pytz", file=sys.stderr)
    sys.exit(1)

# Load environment variables
try:
    from dotenv import load_dotenv
    import os
    load_dotenv()
    print("[INFO] Environment variables loaded from .env file.")
except ImportError:
    import os
    print("[WARN] python-dotenv not found. Using system environment variables only.")
except Exception as e:
    print(f"[WARN] Error loading environment variables: {e}")
    import os

# Attempt to import Gradio only if graphics are available
HAS_GRADIO = False
if HAS_GRAPHICS:
    try:
        import gradio as gr
        HAS_GRADIO = True
    except ImportError:
        print("[WARN] Gradio not found. UI will be disabled.", file=sys.stderr)

# 💡 NEW → RAG helper (requires chromadb + langchain + Ollama)
try:
    import kundali_rag
    HAS_RAG = True
    print("[INFO] kundali_rag module imported successfully.")
except ImportError:
    HAS_RAG = False
    print("[WARN] kundali_rag.py not found or its dependencies (chromadb, langchain, tiktoken) are missing.", file=sys.stderr)
    print("[WARN] Chart interpretation feature will be disabled.", file=sys.stderr)
except Exception as e_rag:
    HAS_RAG = False
    print(f"[ERROR] Error importing kundali_rag: {e_rag}", file=sys.stderr)
    print("[WARN] Chart interpretation feature will be disabled.", file=sys.stderr)


# ----------------------------------------------------------------------------
# Matplotlib Font Configuration for Devanagari (only if graphics available)
# ----------------------------------------------------------------------------
def configure_matplotlib_font():
    """Attempts to find and set a font supporting Devanagari for Matplotlib."""
    if not HAS_GRAPHICS:
        print("[INFO] Graphics libraries not found, skipping font configuration.")
        return

    devanagari_fonts = [ 'Noto Sans Devanagari', 'Mangal', 'Kohinoor Devanagari', 'Arial Unicode MS', 'Code2000', 'FreeSans', 'Devanagari MT', 'CDAC-GIST Surekh', 'JanaSanskrit', 'Sanskrit 2003' ]
    found_font = None
    try:
        font_files = fm.findSystemFonts(fontpaths=None, fontext='ttf')
        for font_name in devanagari_fonts:
            try:
                # Check if font is findable by name
                fm.findfont(fm.FontProperties(family=font_name), fallback_to_default=False)
                found_font = font_name
                print(f"[INFO] Matplotlib: Found system font '{found_font}' by name.")
                break
            except ValueError:
                # If not found by name, search system font files
                for font_file in font_files:
                    try:
                        # Basic check if font name is in the file path (case-insensitive)
                        if font_name.lower() in font_file.lower():
                            fm.fontManager.addfont(font_file) # Add the font file to manager
                            # Try finding it again now that it's added
                            try:
                                fm.findfont(fm.FontProperties(family=font_name), fallback_to_default=False)
                                found_font = font_name
                                print(f"[INFO] Matplotlib: Found font '{found_font}' by file path and added.")
                                break # Exit inner loop once found
                            except ValueError: continue # Font file added, but name doesn't match exactly? Try next file.
                    except Exception: continue # Ignore errors processing individual font files
                if found_font: break # Exit outer loop if found via file path

        # Set the font family in rcParams if found
        if found_font:
            print(f"[INFO] Matplotlib: Using font '{found_font}' for potential Devanagari support.")
            plt.rcParams['font.family'] = found_font
        else:
            print("[WARN] Matplotlib: No suitable Devanagari font found. Nepali characters in charts may not render correctly.")
            plt.rcParams['font.family'] = plt.rcParamsDefault['font.family'] # Use default
        plt.rcParams['axes.unicode_minus'] = False # Ensure minus signs render correctly
    except Exception as e:
        print(f"[WARN] Error during Matplotlib font configuration: {e}. Using default fonts.", file=sys.stderr)
        # Ensure plt exists before accessing rcParams (it should if HAS_GRAPHICS is True)
        if 'plt' in globals():
             plt.rcParams['font.family'] = plt.rcParamsDefault['font.family']
             plt.rcParams['axes.unicode_minus'] = False


if HAS_GRAPHICS:
    configure_matplotlib_font()

# ----------------------------------------------------------------------------
# Calendar conversion helpers
# ----------------------------------------------------------------------------
try: import nepali_datetime as ndt; print("[INFO] Using nepali-datetime."); HAS_NEPALI_DATETIME = True; HAS_NEPALI_DATETIME_FALLBACK = False
except ImportError:
    # HAS_NEPALI_DATETIME = False
    # try: import bikram_sambat as ndt_fallback; print("[WARN] Using bikram-sambat fallback."); HAS_NEPALI_DATETIME_FALLBACK = True
    # except ImportError: 
    ndt, ndt_fallback = None, None; 
    HAS_NEPALI_DATETIME_FALLBACK = False; print("[ERROR] BS conversion disabled. Install 'nepali-datetime' or 'bikram-sambat'.", file=sys.stderr)

def bs_to_gregorian(bs_year: int, bs_month: int, bs_day: int) -> datetime.date | None:
    """Converts Bikram Sambat date to Gregorian date."""
    if HAS_NEPALI_DATETIME and ndt:
        try: return ndt.date(bs_year, bs_month, bs_day).to_datetime_date()
        except ValueError as e: print(f"[ERROR] Invalid BS date: {e}", file=sys.stderr); return None
    elif HAS_NEPALI_DATETIME_FALLBACK and ndt_fallback:
        try: return ndt_fallback.datetime(bs_year, bs_month, bs_day).to_gregorian().date()
        except ValueError as e: print(f"[ERROR] Invalid BS date fallback: {e}", file=sys.stderr); return None
    else: print("[ERROR] BS conversion lib missing.", file=sys.stderr); return None

# ----------------------------------------------------------------------------
# Localisation & Panchanga Mappings
# ----------------------------------------------------------------------------
NAKSHATRA_DETAILS = {
    # Index: (English Name, Gana, Yoni, Nadi, {lang: [Pada Syllables]})
    0: ("Ashwini", "Deva", "Ashwa", "Adya", {"en": ["Chu", "Che", "Cho", "La"], "ne": ["चु", "चे", "चो", "ला"]}),
    1: ("Bharani", "Manushya", "Gaja", "Madhya", {"en": ["Li", "Lu", "Le", "Lo"], "ne": ["ली", "लू", "ले", "लो"]}),
    2: ("Krittika", "Rakshasa", "Mesha", "Antya", {"en": ["A", "I", "U", "E"], "ne": ["अ", "ई", "उ", "ए"]}),
    3: ("Rohini", "Manushya", "Sarpa", "Antya", {"en": ["O", "Va", "Vi", "Vu"], "ne": ["ओ", "वा", "वी", "वू"]}),
    4: ("Mrigashirsha", "Deva", "Sarpa", "Madhya", {"en": ["Ve", "Vo", "Ka", "Ki"], "ne": ["वे", "वो", "का", "की"]}),
    5: ("Ardra", "Manushya", "Shwana", "Adya", {"en": ["Ku", "Gha", "Nga", "Chha"], "ne": ["कु", "घ", "ङ", "छ"]}),
    6: ("Punarvasu", "Deva", "Marjara", "Adya", {"en": ["Ke", "Ko", "Ha", "Hi"], "ne": ["के", "को", "हा", "ही"]}),
    7: ("Pushya", "Deva", "Mesha", "Madhya", {"en": ["Hu", "He", "Ho", "Da"], "ne": ["हु", "हे", "हो", "डा"]}),
    8: ("Ashlesha", "Rakshasa", "Marjara", "Antya", {"en": ["Di", "Du", "De", "Do"], "ne": ["डी", "डू", "डे", "डो"]}),
    9: ("Magha", "Rakshasa", "Mushaka", "Antya", {"en": ["Ma", "Mi", "Mu", "Me"], "ne": ["मा", "मी", "मू", "मे"]}),
    10: ("Purva Phalguni", "Manushya", "Mushaka", "Madhya", {"en": ["Mo", "Ta", "Ti", "Tu"], "ne": ["मो", "टा", "टी", "टू"]}),
    11: ("Uttara Phalguni", "Manushya", "Go", "Adya", {"en": ["Te", "To", "Pa", "Pi"], "ne": ["टे", "टो", "पा", "पी"]}),
    12: ("Hasta", "Deva", "Mahisha", "Adya", {"en": ["Pu", "Sha", "Na", "Tha"], "ne": ["पू", "ष", "ण", "ठ"]}),
    13: ("Chitra", "Rakshasa", "Vyaghra", "Madhya", {"en": ["Pe", "Po", "Ra", "Ri"], "ne": ["पे", "पो", "रा", "री"]}),
    14: ("Swati", "Deva", "Mahisha", "Antya", {"en": ["Ru", "Re", "Ro", "Ta"], "ne": ["रू", "रे", "रो", "ता"]}),
    15: ("Vishakha", "Rakshasa", "Vyaghra", "Antya", {"en": ["Ti", "Tu", "Te", "To"], "ne": ["ती", "तू", "ते", "तो"]}),
    16: ("Anuradha", "Deva", "Mriga", "Madhya", {"en": ["Na", "Ni", "Nu", "Ne"], "ne": ["ना", "नी", "नू", "ने"]}),
    17: ("Jyeshtha", "Rakshasa", "Mriga", "Adya", {"en": ["No", "Ya", "Yi", "Yu"], "ne": ["नो", "या", "यी", "यू"]}),
    18: ("Mula", "Rakshasa", "Shwana", "Adya", {"en": ["Ye", "Yo", "Bha", "Bhi"], "ne": ["ये", "यो", "भा", "भी"]}),
    19: ("Purva Ashadha", "Manushya", "Vanara", "Madhya", {"en": ["Bhu", "Dha", "Pha", "Dha"], "ne": ["भू", "ध", "फ", "ढ"]}),
    20: ("Uttara Ashadha", "Manushya", "Nakula", "Antya", {"en": ["Bhe", "Bho", "Ja", "Ji"], "ne": ["भे", "भो", "जा", "जी"]}),
    21: ("Shravana", "Deva", "Vanara", "Antya", {"en": ["Khi", "Khu", "Khe", "Kho"], "ne": ["खी", "खू", "खे", "खो"]}),
    22: ("Dhanishta", "Rakshasa", "Simha", "Madhya", {"en": ["Ga", "Gi", "Gu", "Ge"], "ne": ["गा", "गी", "गू", "गे"]}),
    23: ("Shatabhisha", "Rakshasa", "Ashwa", "Adya", {"en": ["Go", "Sa", "Si", "Su"], "ne": ["गो", "सा", "सी", "सू"]}),
    24: ("Purva Bhadrapada", "Manushya", "Simha", "Adya", {"en": ["Se", "So", "Da", "Di"], "ne": ["से", "सो", "दा", "दी"]}),
    25: ("Uttara Bhadrapada", "Manushya", "Go", "Madhya", {"en": ["Du", "Tha", "Jha", "Na"], "ne": ["दू", "थ", "झ", "ञ"]}),
    26: ("Revati", "Deva", "Gaja", "Antya", {"en": ["De", "Do", "Cha", "Chi"], "ne": ["दे", "दो", "चा", "ची"]}),
}
RASHI_DETAILS = {
    # Index: (English Name, Varna)
    0: ("Aries", "Kshatriya"), 1: ("Taurus", "Vaishya"), 2: ("Gemini", "Shudra"),
    3: ("Cancer", "Brahmin"), 4: ("Leo", "Kshatriya"), 5: ("Virgo", "Vaishya"),
    6: ("Libra", "Shudra"), 7: ("Scorpio", "Brahmin"), 8: ("Sagittarius", "Kshatriya"),
    9: ("Capricorn", "Vaishya"), 10: ("Aquarius", "Shudra"), 11: ("Pisces", "Brahmin"),
}
TITHI_NAMES = {
    "en": ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima", "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Amavasya"],
    "ne": ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा", "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "अमावस्या"]
}
PAKSHA_NAMES = {"en": ["Shukla", "Krishna"], "ne": ["शुक्ल", "कृष्ण"]}
YOGA_NAMES = {
    "en": ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarman", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"],
    "ne": ["विष्कम्भ", "प्रीति", "आयुष्मान्", "सौभाग्य", "शोभन", "अतिगण्ड", "सुकर्मन्", "धृति", "शूल", "गण्ड", "वृद्धि", "ध्रुव", "व्याघात", "हर्षण", "वज्र", "सिद्धि", "व्यतीपात", "वरीयस्", "परिघ", "शिव", "सिद्ध", "साध्य", "शुभ", "शुक्ल", "ब्रह्मन्", "इन्द्र", "वैधृति"]
}
# Karana names list (60 entries for the full cycle, corresponding to karana_index 0-59)
# Order: Kintughna(0), Bava(1), Balava(2), Kaulava(3), Taitila(4), Garaja(5), Vanija(6), Vishti(7), Bava(8)...
# Fixed Karanas are at specific points in the cycle.
KARANA_NAMES = {
    "en": ["Kintughna"] + ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"] * 8 + ["Shakuni", "Chatushpada", "Naga"], # 1 + 7*8 + 3 = 60
    "ne": ["किन्तुघ्न"] + ["बव", "बालव", "कौलव", "तैतिल", "गर", "वणिज", "विष्टि"] * 8 + ["शकुनि", "चतुष्पाद", "नाग"] # 1 + 56 + 3 = 60
}


PANCHANG_KEYS = {
    "en": {"rashi": "Rashi", "tithi": "Tithi", "paksha": "Paksha", "nakshatra": "Nakshatra", "pada": "Pada", "yoga": "Yoga", "karana": "Karana", "varna": "Varna", "gana": "Gana", "yoni": "Yoni", "nadi": "Nadi", "akshar": "Akshar", "as_marker": "(As)"},
    "ne": {"rashi": "राशि", "tithi": "तिथि", "paksha": "पक्ष", "nakshatra": "नक्षत्र", "pada": "पद", "yoga": "योग", "karana": "करण", "varna": "वर्ण", "gana": "गण", "yoni": "योनि", "nadi": "नाडी", "akshar": "अक्षर", "as_marker": "(ल)"}
}
DEVANAGARI_NUMERALS = {1: '१', 2: '२', 3: '३', 4: '४', 5: '५', 6: '६', 7: '७', 8: '८', 9: '९', 10: '१०', 11: '११', 12: '१२'}

# --- Localization Data ---
EN = {
    "planets": ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"],
    "planet_short": ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"],
    "signs": ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"],
    "nakshatras": [name[0] for name in NAKSHATRA_DETAILS.values()], # English Nakshatra names
    "lagna": "Lagna", "lagna_short": "As",
    "chart_title_rasi": "Birth Chart (Rasi)", "chart_title_navamsa": "Navamsa Chart (D9)",
    "Gana": {"Deva": "Deva", "Manushya": "Manushya", "Rakshasa": "Rakshasa"},
    "Yoni": {"Ashwa": "Horse", "Gaja": "Elephant", "Mesha": "Ram", "Sarpa": "Serpent", "Shwana": "Dog", "Marjara": "Cat", "Mushaka": "Rat", "Go": "Cow", "Mahisha": "Buffalo", "Vyaghra": "Tiger", "Mriga": "Deer", "Vanara": "Monkey", "Nakula": "Mongoose", "Simha": "Lion"},
    "Nadi": {"Adya": "Adi (Vata)", "Madhya": "Madhya (Pitta)", "Antya": "Antya (Kapha)"},
    "Varna": {"Brahmin": "Brahmin", "Kshatriya": "Kshatriya", "Vaishya": "Vaishya", "Shudra": "Shudra"},
    "Tithi": TITHI_NAMES["en"], "Paksha": PAKSHA_NAMES["en"], "Yoga": YOGA_NAMES["en"], "Karana": KARANA_NAMES["en"],
    "PanchangKeys": PANCHANG_KEYS["en"]
}
NE = {
    "planets": ["सूर्य", "चन्द्र", "मङ्गल", "बुध", "बृहस्पति", "शुक्र", "शनि", "राहु", "केतु"],
    "planet_short": ["सू", "च", "मं", "बु", "बृ", "शु", "श", "रा", "के"],
    "signs": ["मेष", "वृष", "मिथुन", "कर्कट", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुम्भ", "मीन"],
    "nakshatras": ["अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा", "पुनर्वसु", "पुष्य", "आश्लेषा", "मघा", "पूर्वफल्गुनी", "उत्तरफल्गुनी", "हस्त", "चित्रा", "स्वाती", "विशाखा", "अनुराधा", "ज्येष्ठा", "मूल", "पूर्वाषाढा", "उत्तराषाढा", "श्रवण", "धनिष्ठा", "शतभिषा", "पूर्व भाद्रपदा", "उत्तर भाद्रपदा", "रेवती"],
    "lagna": "लग्न", "lagna_short": "ल",
    "chart_title_rasi": "जन्म कुण्डली (राशि)", "chart_title_navamsa": "नवमांश कुण्डली (D९)",
    "Gana": {"Deva": "देव", "Manushya": "मनुष्य", "Rakshasa": "राक्षस"},
    "Yoni": {"Ashwa": "अश्व", "Gaja": "गज", "Mesha": "मेष", "Sarpa": "सर्प", "Shwana": "श्वान", "Marjara": "मार्जार", "Mushaka": "मूषक", "Go": "गो", "Mahisha": "महिष", "Vyaghra": "व्याघ्र", "Mriga": "मृग", "Vanara": "वानर", "Nakula": "नकुल", "Simha": "सिंह"},
    "Nadi": {"Adya": "आद्य (वात)", "Madhya": "मध्य (पित्त)", "Antya": "अन्त्य (कफ)"},
    "Varna": {"Brahmin": "ब्राह्मण", "Kshatriya": "क्षत्रिय", "Vaishya": "वैश्य", "Shudra": "शूद्र"},
    "Tithi": TITHI_NAMES["ne"], "Paksha": PAKSHA_NAMES["ne"], "Yoga": YOGA_NAMES["ne"], "Karana": KARANA_NAMES["ne"],
    "PanchangKeys": PANCHANG_KEYS["ne"]
}
LABELS = {"en": EN, "ne": NE}

# ----------------------------------------------------------------------------
# Constants for Calculations
# ----------------------------------------------------------------------------
DASHA_SEQUENCE = ["ketu", "venus", "sun", "moon", "mars", "rahu", "jupiter", "saturn", "mercury"]
DASHA_YEARS = { "sun": 6, "moon": 10, "mars": 7, "rahu": 18, "jupiter": 16, "saturn": 19, "mercury": 17, "ketu": 7, "venus": 20 }
NAKSHATRA_LORD = DASHA_SEQUENCE * 3 # Assigns lords to Nakshatras 0-26 cyclically
SIDEREAL_SIGNS = 12
NAKSHATRAS = 27
NAKSHATRA_ARC = 360.0 / NAKSHATRAS # 13 degrees 20 minutes
SIGN_ARC = 360.0 / SIDEREAL_SIGNS # 30 degrees
NAVAMSA_ARC = SIGN_ARC / 9.0 # 3 degrees 20 minutes
NAKSHATRA_PADA_ARC = NAKSHATRA_ARC / 4.0 # 3 degrees 20 minutes

PLANET_CODES = {
    "sun": swe.SUN, "moon": swe.MOON, "mars": swe.MARS, "mercury": swe.MERCURY,
    "jupiter": swe.JUPITER, "venus": swe.VENUS, "saturn": swe.SATURN,
    "rahu": swe.MEAN_NODE, # Using Mean Node for Rahu/Ketu
    # Ketu is calculated as 180 degrees opposite Rahu
}
# Map English planet names (as used in EN dict) to their 0-based index
PLANET_NAME_TO_INDEX = {name: i for i, name in enumerate(EN["planets"])}
# Set of internal names used for calculation loops
INTERNAL_PLANET_NAMES = set(list(PLANET_CODES.keys()) + ['ketu'])

# ----------------------------------------------------------------------------
# Data Classes
# ----------------------------------------------------------------------------
@dataclass
class PlanetPosition:
    """Represents the calculated position of a celestial body."""
    name: str # Internal name (e.g., "sun", "moon")
    longitude: float # Sidereal longitude (0-360)
    sign_index: int # 0-based index (0=Aries)
    nakshatra_index: int # 0-based index (0=Ashwini)
    nakshatra_pada: int # 1-based pada (1-4)
    navamsa_sign_index: int # 0-based navamsa sign index

    # Fields populated during localization
    display_name: str = "" # Localized full name (e.g., "Sun", "सूर्य")
    short_name: str = "" # Localized short name (e.g., "Su", "सू")
    sign_name: str = "" # Localized sign name (e.g., "Aries", "मेष")
    nakshatra_name: str = "" # Localized nakshatra name (e.g., "Ashwini", "अश्विनी")
    navamsa_sign_name: str = "" # Localized navamsa sign name

    def to_dict(self) -> Dict[str, Any]:
        """Converts the object to a dictionary for JSON serialization."""
        return {
            "planet": self.display_name,
            "planet_short": self.short_name,
            "sign": self.sign_name,
            "sign_index": self.sign_index,
            "longitude_within_sign": round(self.longitude % SIGN_ARC, 4),
            "longitude_full": round(self.longitude, 4),
            "nakshatra": self.nakshatra_name,
            "nakshatra_index": self.nakshatra_index,
            "pada": self.nakshatra_pada,
            "navamsa_sign": self.navamsa_sign_name,
            "navamsa_sign_index": self.navamsa_sign_index,
        }

@dataclass
class DashaPeriod:
    """Represents a Vimshottari Dasha (Mahadasha or Antardasha) period."""
    planet: str # Internal planet name (e.g., "sun")
    start: datetime # UTC start datetime
    end: datetime # UTC end datetime

    # Fields populated during localization or calculation
    display_name: str = "" # Localized planet name
    antardashas: List["DashaPeriod"] | None = field(default_factory=list) # List of sub-periods

    def serialize(self) -> Dict[str, Any]:
        """Serializes the Dasha period and its sub-periods."""
        # Recursively serialize antardashas if they exist
        serialized_antardashas = [a.serialize() for a in self.antardashas] if self.antardashas else []
        return {
            "planet": self.display_name,
            "start": self.start.isoformat(), # Use ISO format for dates
            "end": self.end.isoformat(),
            "antardashas": serialized_antardashas,
        }

@dataclass
class PanchangaDetails:
    """Holds the calculated Panchanga elements for the birth time."""
    # Raw calculated indices/keys
    tithi_index: int = 0 # 0-14 (within Paksha)
    paksha_key: str = "Shukla" # "Shukla" or "Krishna"
    yoga_index: int = 0 # 0-26
    karana_index: int = 0 # 0-59 (index into the full Karana cycle list)
    moon_nakshatra_index: int = 0 # 0-26 (Moon's Nakshatra)
    moon_nakshatra_pada: int = 0 # 1-4 (Moon's Pada)
    moon_sign_index: int = 0 # 0-11 (Moon's Rashi/Sign)
    gana_key: str = "Deva" # "Deva", "Manushya", "Rakshasa"
    nadi_key: str = "Adya" # "Adya", "Madhya", "Antya"
    yoni_key: str = "Ashwa" # Animal name key
    varna_key: str = "Kshatriya" # "Brahmin", "Kshatriya", etc.
    akshar_syllable: str = "Chu" # The calculated birth syllable based on Moon Pada

    # Fields populated during localization
    tithi_name: str = ""
    paksha_name: str = ""
    yoga_name: str = ""
    karana_name: str = ""
    gana_name: str = ""
    nadi_name: str = ""
    yoni_name: str = ""
    varna_name: str = ""
    akshar_name: str = "" # Localized name (often same as syllable)

    def to_dict(self) -> Dict[str, Any]:
        """Converts Panchanga details to a dictionary."""
        return {
            "tithi": self.tithi_name,
            "paksha": self.paksha_name,
            "yoga": self.yoga_name,
            "karana": self.karana_name,
            "gana": self.gana_name,
            "nadi": self.nadi_name,
            "yoni": self.yoni_name,
            "varna": self.varna_name,
            "akshar": self.akshar_name,
            # Optionally include raw indices if needed by frontend
            "tithi_index_in_paksha": self.tithi_index,
            "yoga_index": self.yoga_index,
            "karana_index_in_cycle": self.karana_index,
        }

@dataclass
class KundaliResult:
    """Stores the complete result of a Kundali calculation."""
    # Core Lagna details
    lagna_longitude: float
    lagna_sign_index: int
    lagna_nakshatra_index: int
    lagna_nakshatra_pada: int
    navamsa_lagna_sign_index: int

    # Lists of calculated objects
    planets: List[PlanetPosition]
    dashas: List[DashaPeriod]
    panchanga: PanchangaDetails | None = None # Panchanga might fail

    # Fields populated during localization
    lagna_sign_name: str = ""
    lagna_nakshatra_name: str = ""
    navamsa_lagna_sign_name: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Converts the entire Kundali result to a dictionary."""
        return {
            "lagna": {
                "longitude_full": round(self.lagna_longitude, 4),
                "longitude_within_sign": round(self.lagna_longitude % SIGN_ARC, 4),
                "sign_index": self.lagna_sign_index,
                "sign": self.lagna_sign_name,
                "nakshatra_index": self.lagna_nakshatra_index,
                "nakshatra": self.lagna_nakshatra_name,
                "pada": self.lagna_nakshatra_pada,
            },
            "navamsa_lagna": {
                "sign_index": self.navamsa_lagna_sign_index,
                "sign": self.navamsa_lagna_sign_name,
            },
            "panchanga": self.panchanga.to_dict() if self.panchanga else None,
            "planets": [p.to_dict() for p in self.planets],
            "dashas": [d.serialize() for d in self.dashas],
        }

# ----------------------------------------------------------------------------
# Swiss Ephemeris Setup
# ----------------------------------------------------------------------------
try:
    # Use Lahiri Ayanamsa (most common in India/Nepal)
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    print(f"[INFO] Ayanamsa mode set: {swe.get_ayanamsa_name(swe.SIDM_LAHIRI)}")
    # Set ephemeris file path (optional, searches default paths if not set)
    # swe.set_ephe_path('/path/to/your/ephemeris/files')
except Exception as e:
    print(f"[ERROR] Failed to set sidereal mode: {e}", file=sys.stderr)
    print("[ERROR] Ensure Swiss Ephemeris files (e.g., sepl*.se1) are accessible.", file=sys.stderr)
    print("[ERROR] Download from https://www.astro.com/ftp/swisseph/ephe/", file=sys.stderr)
    sys.exit(1)

# ----------------------------------------------------------------------------
# Core Calculation Functions
# ----------------------------------------------------------------------------
def _validate_inputs(date_str: str, time_str: str, lat: float, lon: float, tz_name: str) -> Tuple[str | None, str | None]:
    """Validates the format and range of user inputs."""
    try:
        # Validate date format strictly
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None, "Invalid date format (use YYYY-MM-DD)."
    try:
        # Validate time format strictly
        datetime.strptime(time_str, "%H:%M")
    except ValueError:
        return None, "Invalid time format (use HH:MM)."

    # Validate geographic coordinates
    if not -90 <= lat <= 90:
        return None, "Invalid latitude (must be between -90 and 90)."
    if not -180 <= lon <= 180:
        return None, "Invalid longitude (must be between -180 and 180)."

    # Validate timezone name
    try:
        pytz.timezone(tz_name) # Check if timezone name is valid
    except pytz.UnknownTimeZoneError:
        return None, f"Invalid or unknown timezone name: '{tz_name}'. Use IANA format (e.g., 'Asia/Kathmandu', 'America/New_York')."
    except Exception as e:
        # Catch other potential errors during timezone validation
        return None, f"Error validating timezone '{tz_name}': {e}"

    # If all checks pass, return combined local datetime string and no error
    return f"{date_str} {time_str}", None

def _get_utc_datetime(local_dt_str: str, tz_name: str) -> datetime | None:
    """Converts local date/time string and timezone name to a timezone-aware UTC datetime object."""
    try:
        # Parse the local datetime string into a naive datetime object
        naive_dt = datetime.strptime(local_dt_str, "%Y-%m-%d %H:%M")
        # Get the timezone object from the IANA name
        local_tz = pytz.timezone(tz_name)
        # Localize the naive datetime object.
        # is_dst=None tells pytz to raise AmbiguousTimeError or NonExistentTimeError
        # if the time is ambiguous (during DST transitions) or invalid.
        local_dt_aware = local_tz.localize(naive_dt, is_dst=None)
        # Convert the localized datetime to UTC
        utc_dt = local_dt_aware.astimezone(pytz.utc)
        return utc_dt
    except (pytz.UnknownTimeZoneError, pytz.AmbiguousTimeError, pytz.NonExistentTimeError, ValueError) as e:
        # Handle specific timezone and datetime parsing errors
        print(f"[ERROR] Timezone/DateTime conversion error for '{local_dt_str}' in '{tz_name}': {e}", file=sys.stderr)
        return None
    except Exception as e:
        # Catch any other unexpected errors during conversion
        print(f"[ERROR] Unexpected error during UTC conversion: {e}", file=sys.stderr)
        return None

def _calculate_julian_day_utc(utc_dt: datetime) -> float:
    """Calculates the Julian Day number for a given UTC datetime."""
    # Convert time components (hour, minute, second, microsecond) into a fraction of a day
    # This is required for the swe.julday function.
    decimal_hour = utc_dt.hour + utc_dt.minute / 60.0 + utc_dt.second / 3600.0 + utc_dt.microsecond / 3600e6
    # Calculate Julian Day using Swiss Ephemeris function
    # swe.julday expects Gregorian calendar date/time
    return swe.julday(utc_dt.year, utc_dt.month, utc_dt.day, decimal_hour)

def _calculate_sidereal_longitude(jd_ut: float, swe_body: int) -> float | None:
    """Calculates the sidereal longitude of a planet/node using the configured Ayanamsa."""
    # Flags for calculation: FLG_SPEED requests longitude and speed.
    # Other flags like FLG_SIDEREAL could be used, but calculating tropical
    # and subtracting ayanamsa manually gives more control and clarity.
    flags = swe.FLG_SPEED
    calc_res = None # Initialize result variable

    try:
        # Calculate the TROPICAL position first using swe.calc_ut
        # calc_ut returns a tuple: (longitude, latitude, distance, long_speed, lat_speed, dist_speed) and an error flag
        calc_res, flag = swe.calc_ut(jd_ut, swe_body, flags)

        # Check for errors from Swiss Ephemeris calculation
        if flag < 0:
            print(f"[WARN] swe.calc_ut returned error flag {flag} for body {swe_body} (Tropical calculation).", file=sys.stderr)
            # Depending on the error, might still proceed or return None

        # Ensure the result structure is as expected (tuple/list with at least one element)
        if isinstance(calc_res, (tuple, list)) and len(calc_res) >= 1:
            tropical_longitude = calc_res[0] # First element is longitude

            # Verify that the longitude is a float
            if isinstance(tropical_longitude, float):
                # Get the Ayanamsa value for the given Julian Day using the configured mode (Lahiri)
                ayanamsa = swe.get_ayanamsa_ut(jd_ut)

                # Calculate Sidereal Longitude: Tropical Longitude - Ayanamsa
                # Use modulo 360.0 to keep the result within the 0-360 degree range.
                sidereal_longitude = (tropical_longitude - ayanamsa) % 360.0
                return sidereal_longitude
            else:
                # Log error if longitude is not a float
                print(f"[ERROR] Tropical longitude is not a float for body {swe_body}. Type: {type(tropical_longitude)}", file=sys.stderr)
        else:
            # Log error if the result structure is unexpected
            print(f"[ERROR] Unexpected result structure from swe.calc_ut for body {swe_body}: {calc_res}", file=sys.stderr)

    except ValueError as ve:
        # Handle potential errors during unpacking if swe.calc_ut return format changes
        print(f"[ERROR] Value error unpacking swe.calc_ut result for body {swe_body}: {ve}.", file=sys.stderr)
    except Exception as e:
        # Catch any other unexpected exceptions during calculation
        print(f"[ERROR] Exception calculating sidereal longitude for body {swe_body}: {e}", file=sys.stderr)

    # Return None if any error occurred
    return None

def _calculate_ascendant(jd_ut: float, lat: float, lon: float) -> float | None:
    """Calculates the sidereal longitude of the Ascendant (Lagna)."""
    try:
        # Calculate tropical house cusps using swe.houses_ex
        # 'P' specifies the Placidus house system (common). Other options: 'K' (Koch), 'R' (Regiomontanus), 'W' (Whole Sign - cusp = 0 deg of sign) etc.
        # flags=0 uses default geocentric calculation.
        # Returns: tuple(house_cusps[1..12]), tuple(ascmc[1..10])
        # ascmc contains: [Ascendant, MC, ARMC, Vertex, Equatorial Asc., Co-Asc. (Koch), Co-Asc. (Munkasey), Polar Asc.]
        _, ascmc = swe.houses_ex(jd_ut, lat, lon, b'P', flags=0)

        # Check if the result structure is valid
        if isinstance(ascmc, (tuple, list)) and len(ascmc) >= 1:
            tropical_ascendant = ascmc[0] # The first element is the Ascendant longitude

            # Verify the Ascendant longitude is a float
            if isinstance(tropical_ascendant, float):
                # Get the Ayanamsa value
                ayanamsa = swe.get_ayanamsa_ut(jd_ut)
                # Calculate Sidereal Ascendant: Tropical Ascendant - Ayanamsa
                sidereal_ascendant = (tropical_ascendant - ayanamsa) % 360.0
                return sidereal_ascendant
            else:
                print(f"[ERROR] Tropical Ascendant is not a float: {ascmc[0]}", file=sys.stderr)
        else:
            print(f"[ERROR] Unexpected result structure from swe.houses_ex: {ascmc}", file=sys.stderr)

    except Exception as e:
        print(f"[ERROR] Exception calculating Ascendant: {e}", file=sys.stderr)

    # Return None on failure
    return None

# --- Helper functions for deriving indices from longitude ---
def _get_sign_index(longitude: float) -> int:
    """Calculates the 0-based sign index (0=Aries, 11=Pisces) from sidereal longitude."""
    # Ensure longitude is within 0-360 range
    norm_lon = longitude % 360.0
    # Divide by sign arc (30 degrees) and take floor to get 0-11 index
    return math.floor(norm_lon / SIGN_ARC)

def _get_nakshatra_index(longitude: float) -> int:
    """Calculates the 0-based Nakshatra index (0=Ashwini, 26=Revati) from sidereal longitude."""
    # Ensure longitude is within 0-360 range
    norm_lon = longitude % 360.0
    # Divide by Nakshatra arc (13.33... degrees) and take floor to get 0-26 index
    return math.floor(norm_lon / NAKSHATRA_ARC)

def _get_nakshatra_pada(longitude: float) -> int:
    """Calculates the Nakshatra Pada (1-4) from sidereal longitude."""
    # Ensure longitude is within 0-360 range
    norm_lon = longitude % 360.0
    # Find position within the current Nakshatra (0 to 13.33... degrees)
    position_within_nakshatra = norm_lon % NAKSHATRA_ARC
    # Calculate the zero-based pada index (0-3)
    # Avoid division by zero if NAKSHATRA_PADA_ARC is somehow zero
    if NAKSHATRA_PADA_ARC == 0: return 1
    pada_index_zero_based = math.floor(position_within_nakshatra / NAKSHATRA_PADA_ARC)
    # Clamp index between 0 and 3 (safety check) and add 1 for 1-based Pada
    return min(max(pada_index_zero_based, 0), 3) + 1

def _get_navamsa_sign_index(longitude: float) -> int:
    """
    Calculates the 0-based Navamsa sign index using the standard Parashara method.
    Ref: https://vedicastrology.wikidot.com/navamsa-calculation
    """
    # Normalize longitude to 0-360 degrees
    lon_norm = longitude % 360.0
    # Find the Rasi sign index (0-11)
    sign_index = math.floor(lon_norm / SIGN_ARC)
    # Find the position within the sign (0-30 degrees)
    degree_in_sign = lon_norm % SIGN_ARC
    # Find the Navamsa number within the sign (0-8), each Navamsa is 3°20'
    navamsa_num = math.floor(degree_in_sign / NAVAMSA_ARC)

    # Determine the starting sign for Navamsa counting based on Rasi sign type:
    # Movable (Chara) signs: Aries(0), Cancer(3), Libra(6), Capricorn(9) -> Start counting from the sign itself.
    # Fixed (Sthira) signs: Taurus(1), Leo(4), Scorpio(7), Aquarius(10) -> Start counting from the 9th sign from it.
    # Dual (Dvisvabhava) signs: Gemini(2), Virgo(5), Sagittarius(8), Pisces(11) -> Start counting from the 5th sign from it.
    if sign_index in [0, 3, 6, 9]: # Movable
        start_sign_index = sign_index
    elif sign_index in [1, 4, 7, 10]: # Fixed
        start_sign_index = (sign_index + 8) % 12 # Adding 8 gives the 9th sign (0-based)
    else: # Dual (sign_index in [2, 5, 8, 11])
        start_sign_index = (sign_index + 4) % 12 # Adding 4 gives the 5th sign (0-based)

    # Calculate the final Navamsa sign index by adding the navamsa_num to the start_sign_index
    navamsa_sign_index = (start_sign_index + navamsa_num) % 12
    return navamsa_sign_index

def _calculate_panchanga(jd_ut: float, moon_lon: float, sun_lon: float, moon_sign_idx: int, moon_nak_idx: int, moon_pada: int, lang: str) -> PanchangaDetails | None:
    """Calculates Tithi, Yoga, Karana and looks up Nakshatra/Rashi based details."""
    try:
        # --- Tithi Calculation ---
        # Tithi is the angular distance between Moon and Sun in 12-degree segments.
        tithi_elongation = (moon_lon - sun_lon) % 360.0
        # Calculate the Tithi index (0-29)
        tithi_index_full = math.floor(tithi_elongation / 12.0)
        # Validate index (should always be 0-29, but safety check)
        if not 0 <= tithi_index_full <= 29:
            print(f"[WARN] Calculated Tithi index {tithi_index_full} is out of range [0, 29]. Modulo correcting.", file=sys.stderr)
            tithi_index_full = tithi_index_full % 30
        # Determine Paksha (waxing/waning phase)
        paksha_key = "Krishna" if tithi_index_full >= 15 else "Shukla"
        # Determine Tithi number within the Paksha (0=Pratipada, 14=Purnima/Amavasya)
        tithi_num_within_paksha = tithi_index_full % 15

        # --- Yoga Calculation ---
        # Yoga is based on the sum of Sun and Moon longitudes in 13°20' (NAKSHATRA_ARC) segments.
        yoga_sum_longitude = (sun_lon + moon_lon) % 360.0
        # Calculate Yoga index (0-26)
        yoga_index = math.floor(yoga_sum_longitude / NAKSHATRA_ARC)
        # Validate index
        if not 0 <= yoga_index <= 26:
            print(f"[WARN] Calculated Yoga index {yoga_index} is out of range [0, 26]. Modulo correcting.", file=sys.stderr)
            yoga_index = yoga_index % 27

        # --- Karana Calculation ---
        # Karana is half a Tithi (6 degrees of Moon-Sun elongation). There are 60 Karanas in a lunar month cycle.
        karana_num_in_month = math.floor(tithi_elongation / 6.0) # 0 to 59
        # Use modulo 60 to get the index (0-59) into the KARANA_NAMES list
        karana_index_cycle = karana_num_in_month % 60
        if not 0 <= karana_index_cycle <= 59:
             print(f"[WARN] Calculated Karana cycle index {karana_index_cycle} is out of range [0, 59]. Modulo correcting.", file=sys.stderr)
             karana_index_cycle = karana_index_cycle % 60

        # --- Nakshatra-based Details (Gana, Yoni, Nadi, Akshar) ---
        # Use Moon's Nakshatra index
        if not 0 <= moon_nak_idx < len(NAKSHATRA_DETAILS):
            print(f"[ERROR] Invalid Moon Nakshatra index {moon_nak_idx} for Panchanga lookup.", file=sys.stderr); return None
        _, gana_key, yoni_key, nadi_key, akshar_map = NAKSHATRA_DETAILS[moon_nak_idx]

        # Akshar (Birth Syllable) - based on Moon's Nakshatra Pada
        if not 1 <= moon_pada <= 4:
            print(f"[ERROR] Invalid Moon Nakshatra Pada {moon_pada} for Akshar lookup.", file=sys.stderr); return None
        # Get the language-specific syllable map, fallback to English if lang invalid
        akshar_lang_map = akshar_map.get(lang, akshar_map.get("en", ["?", "?", "?", "?"])) # Provide default list
        if not isinstance(akshar_lang_map, list) or len(akshar_lang_map) != 4:
            print(f"[ERROR] Invalid Akshar map structure for Nakshatra {moon_nak_idx}, Lang {lang}.", file=sys.stderr); return None
        akshar_syllable = akshar_lang_map[moon_pada - 1] # Get syllable for the 1-based Pada

        # --- Rashi-based Details (Varna) ---
        # Use Moon's Sign index
        if not 0 <= moon_sign_idx < len(RASHI_DETAILS):
            print(f"[ERROR] Invalid Moon Sign index {moon_sign_idx} for Varna lookup.", file=sys.stderr); return None
        _, varna_key = RASHI_DETAILS[moon_sign_idx]

        print(f"[DEBUG] Panchanga Raw Indices: TithiNum={tithi_num_within_paksha}, Paksha={paksha_key}, Yoga={yoga_index}, KaranaCycleIdx={karana_index_cycle}, Gana={gana_key}, Yoni={yoni_key}, Nadi={nadi_key}, Varna={varna_key}, Akshar={akshar_syllable}")

        # Create and return the PanchangaDetails object
        return PanchangaDetails(
            tithi_index=tithi_num_within_paksha, paksha_key=paksha_key,
            yoga_index=yoga_index, karana_index=karana_index_cycle, # Store the 0-59 index
            moon_nakshatra_index=moon_nak_idx, moon_nakshatra_pada=moon_pada, moon_sign_index=moon_sign_idx,
            gana_key=gana_key, nadi_key=nadi_key, yoni_key=yoni_key, varna_key=varna_key,
            akshar_syllable=akshar_syllable, akshar_name=akshar_syllable # Store syllable here too for consistency
        )
    except Exception as e:
        print(f"[ERROR] Unexpected exception during Panchanga calculation: {e}", file=sys.stderr)
        import traceback; traceback.print_exc()
        return None

def _compute_vimshottari(moon_longitude: float, birth_utc: datetime) -> List[DashaPeriod]:
    """Computes the Vimshottari Dasha sequence starting from birth."""
    # 1. Find the Nakshatra containing the Moon at birth
    nak_idx = _get_nakshatra_index(moon_longitude)
    if not 0 <= nak_idx < len(NAKSHATRA_LORD):
        print(f"[ERROR] Invalid Nakshatra index {nak_idx} for Dasha calculation.", file=sys.stderr); return []

    # 2. Determine the Dasha lord ruling at the time of birth
    first_lord = NAKSHATRA_LORD[nak_idx]
    total_lord_dasha_years = DASHA_YEARS[first_lord] # Full duration of this lord's Mahadasha

    # 3. Calculate the portion of the first Dasha remaining at birth
    # Moon's position within its Nakshatra (0 to NAKSHATRA_ARC degrees)
    moon_pos_in_nak = moon_longitude % 360.0 % NAKSHATRA_ARC
    # Fraction of the Nakshatra traversed by the Moon
    fraction_traversed = (moon_pos_in_nak / NAKSHATRA_ARC) if NAKSHATRA_ARC != 0 else 0
    # Years of the first Dasha already elapsed before birth
    elapsed_years = total_lord_dasha_years * fraction_traversed
    # Years remaining in the first Dasha after birth
    remaining_years = total_lord_dasha_years - elapsed_years
    if remaining_years < 0: remaining_years = 0 # Ensure non-negative duration

    # 4. Calculate Dasha start and end dates
    days_per_year = 365.2425 # Average Gregorian year length for duration calculation
    dasha_periods = [] # List to store Mahadasha periods
    current_start_date = birth_utc # The first Dasha starts at birth

    # Find the index of the first Dasha lord in the standard sequence
    try:
        start_sequence_index = DASHA_SEQUENCE.index(first_lord)
    except ValueError:
        print(f"[ERROR] Dasha lord '{first_lord}' not found in sequence.", file=sys.stderr); return []

    # --- Calculate the first Mahadasha (potentially partial) ---
    first_dasha_duration_days = remaining_years * days_per_year
    first_dasha_end_date = current_start_date + timedelta(days=first_dasha_duration_days)

    # Calculate Antardashas for the *entire* duration of the first Mahadasha lord
    # The start date for these calculations needs to be the hypothetical start of the full MD
    hypothetical_full_first_dasha_start = birth_utc - timedelta(days=elapsed_years * days_per_year)
    full_first_lord_antardashas = _compute_antardashas(first_lord, total_lord_dasha_years, days_per_year, hypothetical_full_first_dasha_start)

    # Filter these Antardashas to only include the portion *after* the birth time
    remaining_antardashas_for_first_md = []
    for ad in full_first_lord_antardashas:
        # Find the overlap between the Antardasha period [ad.start, ad.end]
        # and the remaining Mahadasha period [birth_utc, first_dasha_end_date]
        overlap_start = max(birth_utc, ad.start)
        overlap_end = min(first_dasha_end_date, ad.end)

        # Only add the Antardasha if there is a valid overlap period
        if overlap_end > overlap_start:
            remaining_antardashas_for_first_md.append(DashaPeriod(
                planet=ad.planet,
                start=overlap_start,
                end=overlap_end,
                antardashas=None # We don't calculate sub-sub-periods (Pratyantardasha) here
            ))

    # Add the first Mahadasha (potentially partial) with its filtered Antardashas
    dasha_periods.append(DashaPeriod(
        planet=first_lord,
        start=current_start_date,
        end=first_dasha_end_date,
        antardashas=remaining_antardashas_for_first_md
    ))

    # --- Calculate subsequent full Mahadashas ---
    current_start_date = first_dasha_end_date # Start next MD when the first one ends
    total_years_covered = remaining_years # Keep track of total duration covered

    # Loop through the remaining lords in the sequence to cover ~120 years
    for i in range(1, len(DASHA_SEQUENCE) * 2): # Loop more than once if needed for 120 yrs
        if total_years_covered >= 120: break # Stop after covering roughly 120 years

        # Get the next lord in the sequence cyclically
        current_sequence_index = (start_sequence_index + i) % len(DASHA_SEQUENCE)
        current_lord = DASHA_SEQUENCE[current_sequence_index]
        lord_dasha_years = DASHA_YEARS[current_lord]
        lord_dasha_duration_days = lord_dasha_years * days_per_year

        # Calculate the end date for this Mahadasha
        end_date = current_start_date + timedelta(days=lord_dasha_duration_days)

        # Calculate Antardashas for this full Mahadasha
        antardashas = _compute_antardashas(current_lord, lord_dasha_years, days_per_year, current_start_date)

        # Add the full Mahadasha period with its Antardashas
        dasha_periods.append(DashaPeriod(
            planet=current_lord,
            start=current_start_date,
            end=end_date,
            antardashas=antardashas
        ))

        # Update for the next iteration
        current_start_date = end_date
        total_years_covered += lord_dasha_years

    return dasha_periods

def _compute_antardashas(maha_lord: str, md_years: float, days_per_year: float, md_actual_start_date: datetime) -> List[DashaPeriod]:
    """Calculates the Antardasha (sub-periods) for a given Mahadasha."""
    antardasha_periods = []
    try:
        # Find the starting index of the Mahadasha lord in the sequence
        start_index = DASHA_SEQUENCE.index(maha_lord)
    except ValueError:
        print(f"[ERROR] Mahadasha lord '{maha_lord}' not found in sequence for Antardasha.", file=sys.stderr); return []

    current_antardasha_start_date = md_actual_start_date
    total_vimshottari_years = sum(DASHA_YEARS.values()) # Should be 120

    # Iterate through the Dasha sequence starting from the Mahadasha lord
    for i in range(len(DASHA_SEQUENCE)):
        antardasha_lord_index = (start_index + i) % len(DASHA_SEQUENCE)
        antardasha_lord = DASHA_SEQUENCE[antardasha_lord_index]
        antardasha_lord_base_years = DASHA_YEARS[antardasha_lord]

        # Calculate the duration of this Antardasha within the Mahadasha
        # Formula: Antardasha Duration = (Mahadasha Years * Antardasha Lord Base Years) / Total Vimshottari Years
        antardasha_duration_years = (md_years * antardasha_lord_base_years) / total_vimshottari_years
        antardasha_duration_days = antardasha_duration_years * days_per_year

        if antardasha_duration_days < 0: antardasha_duration_days = 0 # Ensure non-negative

        # Calculate the end date of this Antardasha
        antardasha_end_date = current_antardasha_start_date + timedelta(days=antardasha_duration_days)

        # Add the Antardasha period if its duration is positive (avoid zero-duration periods)
        if antardasha_end_date > current_antardasha_start_date:
            antardasha_periods.append(DashaPeriod(
                planet=antardasha_lord,
                start=current_antardasha_start_date,
                end=antardasha_end_date,
                antardashas=None # No sub-sub-periods (Pratyantardasha) calculated here
            ))

        # Update the start date for the next Antardasha
        current_antardasha_start_date = antardasha_end_date

    return antardasha_periods

def compute_kundali_data(jd_ut: float, lat: float, lon: float, lang: str) -> Tuple[KundaliResult | None, str | None]:
    """Computes Lagna, Planets, and Panchanga details for the given time and location."""
    print("[DEBUG] Calculating Ascendant (Lagna)...")
    lagna_lon = _calculate_ascendant(jd_ut, lat, lon)
    if lagna_lon is None:
        return None, "Failed to calculate Ascendant (Lagna)."
    print(f"[DEBUG] Calculated Sidereal Ascendant Longitude: {lagna_lon:.4f}")

    # Calculate Lagna details (Sign, Nakshatra, Pada, Navamsa Sign) from its longitude
    try:
        lagna_sign_index = _get_sign_index(lagna_lon)
        lagna_nakshatra_index = _get_nakshatra_index(lagna_lon)
        lagna_nakshatra_pada = _get_nakshatra_pada(lagna_lon)
        navamsa_lagna_sign_index = _get_navamsa_sign_index(lagna_lon)
        print(f"[DEBUG] Lagna Details: Sign Index={lagna_sign_index}, Nak Index={lagna_nakshatra_index}, Pada={lagna_nakshatra_pada}, Navamsa Lagna Index={navamsa_lagna_sign_index}")
    except Exception as e:
        print(f"[ERROR] Failed to calculate Lagna details (Sign/Nak/Pada/Navamsa): {e}", file=sys.stderr)
        return None, f"Failed to calculate Lagna details: {e}"

    # Calculate planetary positions
    planets_data: List[PlanetPosition] = []
    calculated_planets = set() # Keep track of which planets were calculated
    planet_longitudes = {} # Store longitudes for Panchanga calculation

    # Define the list of planets/nodes to calculate (Sun to Saturn + Rahu)
    planets_to_calculate = list(PLANET_CODES.keys())

    for planet_name in planets_to_calculate:
        print(f"[DEBUG] Calculating sidereal longitude for {planet_name.capitalize()}...")
        swe_code = PLANET_CODES[planet_name]
        planet_lon = _calculate_sidereal_longitude(jd_ut, swe_code)

        # Handle calculation failure for a planet
        if planet_lon is None:
            # Decide whether to fail entirely or continue with missing data
            # For now, fail entirely as positions are fundamental
            return None, f"Failed to calculate sidereal longitude for {planet_name.capitalize()}."

        print(f"[DEBUG] Sidereal Longitude {planet_name.capitalize()}: {planet_lon:.4f}")
        planet_longitudes[planet_name] = planet_lon # Store for later use (Panchanga)

        # Calculate derived details for the planet (Sign, Nak, Pada, Navamsa Sign)
        try:
            sign_idx = _get_sign_index(planet_lon)
            nak_idx = _get_nakshatra_index(planet_lon)
            pada = _get_nakshatra_pada(planet_lon)
            nav_sign_idx = _get_navamsa_sign_index(planet_lon)
            print(f"[DEBUG] Indices {planet_name.capitalize()}: Sign={sign_idx}, Nak={nak_idx}, Pada={pada}, Navamsa Sign={nav_sign_idx}")

            # Create PlanetPosition object
            planet_obj = PlanetPosition(
                name=planet_name, longitude=planet_lon, sign_index=sign_idx,
                nakshatra_index=nak_idx, nakshatra_pada=pada, navamsa_sign_index=nav_sign_idx
            )
            planets_data.append(planet_obj)
            calculated_planets.add(planet_name)
        except Exception as e:
            print(f"[ERROR] Failed processing details for {planet_name.capitalize()}: {e}", file=sys.stderr)
            return None, f"Failed processing details for {planet_name.capitalize()}: {e}"

        # Calculate Ketu position (180 degrees opposite Rahu)
        if planet_name == "rahu":
            print(f"[DEBUG] Calculating Ketu based on Rahu ({planet_lon:.4f})...")
            ketu_lon = (planet_lon + 180.0) % 360.0
            planet_longitudes["ketu"] = ketu_lon # Store Ketu's longitude
            print(f"[DEBUG] Sidereal Longitude Ketu: {ketu_lon:.4f}")
            try:
                # Calculate details for Ketu
                ketu_sign_idx = _get_sign_index(ketu_lon)
                ketu_nak_idx = _get_nakshatra_index(ketu_lon)
                ketu_pada = _get_nakshatra_pada(ketu_lon)
                ketu_nav_sign_idx = _get_navamsa_sign_index(ketu_lon)
                print(f"[DEBUG] Indices Ketu: Sign={ketu_sign_idx}, Nak={ketu_nak_idx}, Pada={ketu_pada}, Navamsa Sign={ketu_nav_sign_idx}")

                # Create Ketu's PlanetPosition object
                ketu_obj = PlanetPosition(
                    name="ketu", longitude=ketu_lon, sign_index=ketu_sign_idx,
                    nakshatra_index=ketu_nak_idx, nakshatra_pada=ketu_pada, navamsa_sign_index=ketu_nav_sign_idx
                )
                planets_data.append(ketu_obj)
                calculated_planets.add("ketu")
            except Exception as e:
                print(f"[ERROR] Failed processing details for Ketu: {e}", file=sys.stderr)
                return None, f"Failed processing details for Ketu: {e}"

    # Verify all expected planets/nodes (Sun-Saturn, Rahu, Ketu) were calculated
    expected_internal_names = INTERNAL_PLANET_NAMES
    if calculated_planets != expected_internal_names:
        missing = expected_internal_names - calculated_planets
        print(f"[WARN] Calculation incomplete. Missing planets/nodes: {missing}", file=sys.stderr)
        # Decide if this is a fatal error or acceptable
        return None, f"Calculation incomplete. Missing: {missing}"

    # Calculate Panchanga details using Sun and Moon positions
    print("[DEBUG] Calculating Panchanga details...")
    # Find the Moon's position object from the results
    moon_pos_obj = next((p for p in planets_data if p.name == "moon"), None)
    sun_lon_val = planet_longitudes.get("sun") # Get Sun's longitude stored earlier

    panchanga_details = None
    if moon_pos_obj and sun_lon_val is not None:
        # Call the Panchanga calculation function
        panchanga_details = _calculate_panchanga(
            jd_ut, moon_pos_obj.longitude, sun_lon_val,
            moon_pos_obj.sign_index, moon_pos_obj.nakshatra_index, moon_pos_obj.nakshatra_pada,
            lang # Pass language for Akshar lookup
        )
        if panchanga_details is None:
            # Log warning if Panchanga calculation failed, but don't stop the whole process
            print("[WARN] Panchanga calculation function returned None.", file=sys.stderr)
            # Continue without Panchanga rather than failing the whole request
    else:
        # Log warning if Sun or Moon data was missing for Panchanga calculation
        print("[WARN] Could not calculate Panchanga (Sun or Moon longitude/position object missing).", file=sys.stderr)

    # Assemble the final KundaliResult object (Dashas will be added later)
    kundali_result = KundaliResult(
        lagna_longitude=lagna_lon,
        lagna_sign_index=lagna_sign_index,
        lagna_nakshatra_index=lagna_nakshatra_index,
        lagna_nakshatra_pada=lagna_nakshatra_pada,
        navamsa_lagna_sign_index=navamsa_lagna_sign_index,
        planets=planets_data,
        panchanga=panchanga_details,
        dashas=[] # Initialize Dashas list (will be populated by _process_request)
    )

    print("[DEBUG] Core Kundali data computation successful (excluding Dashas).")
    return kundali_result, None # Return the result object and no error message

def localize_kundali_data(kundali: KundaliResult, lang: str):
    """Adds localized names (Signs, Planets, Nakshatras, Panchanga items) to the KundaliResult object."""
    # Ensure language code is valid ('en' or 'ne'), default to 'en'
    lang = lang if lang in LABELS else "en"
    lang_labels = LABELS[lang] # Get the dictionary for the selected language

    # --- Localize Lagna details ---
    try:
        kundali.lagna_sign_name = lang_labels["signs"][kundali.lagna_sign_index]
        kundali.lagna_nakshatra_name = lang_labels["nakshatras"][kundali.lagna_nakshatra_index]
        kundali.navamsa_lagna_sign_name = lang_labels["signs"][kundali.navamsa_lagna_sign_index]
    except IndexError as e:
        # Handle cases where indices might be out of bounds for the label lists
        print(f"[WARN] Index error localizing Lagna details (Sign/Nak/NavLagna): {e}", file=sys.stderr)
        # Set default error strings to prevent crashes later if data is used directly
        kundali.lagna_sign_name = kundali.lagna_sign_name or "Error"
        kundali.lagna_nakshatra_name = kundali.lagna_nakshatra_name or "Error"
        kundali.navamsa_lagna_sign_name = kundali.navamsa_lagna_sign_name or "Error"
    except KeyError as e:
         print(f"[WARN] Key error localizing Lagna details: {e}", file=sys.stderr)


    # --- Localize Panchanga details (if available) ---
    if kundali.panchanga:
        p = kundali.panchanga
        try:
            # Tithi: Combine index within paksha and paksha key to get full index (0-29)
            tithi_base_index = p.tithi_index + (15 if p.paksha_key == "Krishna" else 0)
            p.tithi_name = lang_labels["Tithi"][tithi_base_index] if 0 <= tithi_base_index < len(lang_labels["Tithi"]) else "Error"

            # Paksha
            paksha_idx = 1 if p.paksha_key == "Krishna" else 0
            p.paksha_name = lang_labels["Paksha"][paksha_idx] if 0 <= paksha_idx < len(lang_labels["Paksha"]) else "Error"

            # Yoga
            p.yoga_name = lang_labels["Yoga"][p.yoga_index] if 0 <= p.yoga_index < len(lang_labels["Yoga"]) else "Error"

            # Karana (using the 0-59 cycle index)
            p.karana_name = lang_labels["Karana"][p.karana_index] if 0 <= p.karana_index < len(lang_labels["Karana"]) else "Error"

            # Gana, Nadi, Yoni, Varna (use .get for safe lookup with fallback to the key itself)
            p.gana_name = lang_labels.get("Gana", {}).get(p.gana_key, p.gana_key)
            p.nadi_name = lang_labels.get("Nadi", {}).get(p.nadi_key, p.nadi_key)
            p.yoni_name = lang_labels.get("Yoni", {}).get(p.yoni_key, p.yoni_key)
            p.varna_name = lang_labels.get("Varna", {}).get(p.varna_key, p.varna_key)

            # Akshar name is already set correctly during calculation based on lang
            p.akshar_name = p.akshar_syllable # Assign the syllable as the name

        except (IndexError, KeyError) as e:
            # Handle potential errors during Panchanga localization
            print(f"[WARN] Index/Key error localizing Panchanga details: {e}", file=sys.stderr)
            # Avoid setting individual fields to "Error" here; let defaults/keys persist or be handled in UI/output formatting

    # --- Localize Planet details ---
    for p in kundali.planets:
        # Map internal name (e.g., "sun") to English display name ("Sun") for index lookup
        planet_display_en = p.name.capitalize()
        if p.name == 'rahu': planet_display_en = 'Rahu'
        if p.name == 'ketu': planet_display_en = 'Ketu'

        planet_index = None
        try:
            # Find the index of this planet in the standard English list
            planet_index = EN["planets"].index(planet_display_en)
        except ValueError:
            # Handle case where internal name doesn't match expected English name
            print(f"[WARN] Could not find index for planet '{planet_display_en}' (internal name: '{p.name}') during localization.", file=sys.stderr)
            p.display_name = p.name # Fallback to internal name
            p.short_name = p.name[:2].upper() # Fallback short name

        # If index was found, get localized names
        if planet_index is not None:
            try:
                p.display_name = lang_labels["planets"][planet_index]
                p.short_name = lang_labels["planet_short"][planet_index]
            except IndexError:
                # Handle case where language labels might be missing an entry
                print(f"[WARN] Index error localizing planet name/short name for index {planet_index} ({p.name}).", file=sys.stderr)
                p.display_name = p.display_name or p.name # Keep fallback if already set
                p.short_name = p.short_name or p.name[:2].upper()

        # Localize Sign, Nakshatra, Navamsa Sign names for the planet using indices
        try:
            p.sign_name = lang_labels["signs"][p.sign_index] if 0 <= p.sign_index < len(lang_labels["signs"]) else "Error"
            p.nakshatra_name = lang_labels["nakshatras"][p.nakshatra_index] if 0 <= p.nakshatra_index < len(lang_labels["nakshatras"]) else "Error"
            p.navamsa_sign_name = lang_labels["signs"][p.navamsa_sign_index] if 0 <= p.navamsa_sign_index < len(lang_labels["signs"]) else "Error"
        except IndexError as e:
            print(f"[WARN] Index error localizing Sign/Nak/NavSign for planet {p.name}: {e}", file=sys.stderr)
            # Set defaults on error
            p.sign_name = p.sign_name or "Error"
            p.nakshatra_name = p.nakshatra_name or "Error"
            p.navamsa_sign_name = p.navamsa_sign_name or "Error"
        except KeyError as e:
             print(f"[WARN] Key error localizing Sign/Nak/NavSign for planet {p.name}: {e}", file=sys.stderr)


    # --- Localize Dasha/Antardasha planet names ---
    for d in kundali.dashas:
        # Localize Mahadasha lord name
        md_planet_en = d.planet.capitalize()
        if d.planet == 'rahu': md_planet_en = 'Rahu'
        if d.planet == 'ketu': md_planet_en = 'Ketu'
        md_planet_index = None
        try: md_planet_index = EN["planets"].index(md_planet_en)
        except ValueError: d.display_name = d.planet.capitalize() # Fallback
        if md_planet_index is not None:
            try: d.display_name = lang_labels["planets"][md_planet_index]
            except IndexError: d.display_name = d.display_name or d.planet.capitalize() # Keep fallback

        # Localize Antardasha lord names if they exist
        if d.antardashas:
            for ad in d.antardashas:
                ad_planet_en = ad.planet.capitalize()
                if ad.planet == 'rahu': ad_planet_en = 'Rahu'
                if ad.planet == 'ketu': ad_planet_en = 'Ketu'
                ad_planet_index = None
                try: ad_planet_index = EN["planets"].index(ad_planet_en)
                except ValueError: ad.display_name = ad.planet.capitalize() # Fallback
                if ad_planet_index is not None:
                    try: ad.display_name = lang_labels["planets"][ad_planet_index]
                    except IndexError: ad.display_name = ad.display_name or ad.planet.capitalize() # Keep fallback

# ----------------------------------------------------------------------------
# Chart Drawing (Displays SIGN Numbers) - Requires Matplotlib & Pillow
# ----------------------------------------------------------------------------

def _draw_single_chart(
    ax: plt.Axes,              # Matplotlib Axes object
    title: str,                # Chart title (e.g., "Rasi Chart")
    planets: List[PlanetPosition], # List of calculated planet positions
    chart_lagna_sign: int,     # 0-based index of the Lagna sign for this chart (Rasi or Navamsa)
    lang_labels: dict,         # Dictionary containing localized labels (EN or NE)
    lang_code: str,            # 'en' or 'ne' for number formatting
    is_navamsa: bool           # Flag indicating if this is the Navamsa chart
):
    """
    Helper function to draw one North Indian style chart (Rasi or Navamsa).
    Displays SIGN numbers (1-12) in houses.
    Uses adjusted coordinates for better separation of sign numbers and planets.
    """
    # 1. Setup Axes
    ax.set_title(title, fontsize=12, pad=10)
    ax.set_aspect('equal') # Ensure chart is square
    ax.axis('off')         # Hide axes lines and ticks

    # 2. Define Coordinate System (based on 0-10 range)
    size = 10.0
    center = size / 2.0 # = 5.0

    # 3. Draw Chart Frame (Outer square, diagonals, inner diamond)
    outer_square_coords = [(0, 0), (size, 0), (size, size), (0, size), (0, 0)]
    ax.add_patch(patches.Polygon(outer_square_coords, closed=True, edgecolor='black', facecolor='white', linewidth=1.5))
    ax.plot([0, size], [size, 0], color='black', linewidth=1) # Top-Left to Bottom-Right diagonal
    ax.plot([0, size], [0, size], color='black', linewidth=1) # Bottom-Left to Top-Right diagonal
    inner_diamond_coords = [(center, 0), (size, center), (center, size), (0, center), (center, 0)]
    ax.plot(*zip(*inner_diamond_coords), color='black', linewidth=1) # Inner diamond shape

    # 4. Define Coordinates for Sign Numbers and Planet Clusters
    # These coordinates are fine-tuned visually for placement within the 10x10 grid.
    # Format: { relative_house_num: (x, y) } where house 1 is top diamond, CCW.

    # Base scaling factor (can adjust overall spacing)
    outer_scale = 1.0

    # Offsets from the center (5.0) for SIGN NUMBERS
    num_offset_diamond_vertical = 2.8 * outer_scale   # Y offset for top/bottom diamonds
    num_offset_diamond_horizontal = 2.8 * outer_scale # X offset for left/right diamonds
    num_offset_corner_xy = 2.8 * outer_scale          # X/Y offset for corner triangles
    num_offset_tri_x = 3.5 * outer_scale              # X offset for side triangles
    num_offset_tri_y = 1.8 * outer_scale              # Y offset for side triangles

    # Offsets relative to SIGN NUMBER positions for PLANET CLUSTERS
    planet_y_offset_diamond = -0.8 # Nudge planets down from top/bottom sign numbers
    planet_x_offset_corner = 0.0   # Keep planets horizontally centered in corners
    planet_y_offset_corner = -0.6  # Nudge planets vertically from corner sign numbers
    planet_x_offset_tri = -0.6     # Nudge planets horizontally from side sign numbers
    planet_y_offset_tri = 0.0      # Keep planets vertically centered in side triangles

    # Calculate SIGN NUMBER POSITIONS (relative house 1=Top, CCW)
    SIGN_NUMBER_POS = {
        1: (center, center + num_offset_diamond_vertical),        # Top diamond
        2: (center - num_offset_corner_xy, center + num_offset_corner_xy), # Top-left corner
        3: (center - num_offset_tri_x, center + num_offset_tri_y),        # Upper-left triangle
        4: (center - num_offset_diamond_horizontal, center),       # Left diamond
        5: (center - num_offset_tri_x, center - num_offset_tri_y),        # Lower-left triangle
        6: (center - num_offset_corner_xy, center - num_offset_corner_xy), # Bottom-left corner
        7: (center, center - num_offset_diamond_vertical),        # Bottom diamond
        8: (center + num_offset_corner_xy, center - num_offset_corner_xy), # Bottom-right corner
        9: (center + num_offset_tri_x, center - num_offset_tri_y),        # Lower-right triangle
        10: (center + num_offset_diamond_horizontal, center),      # Right diamond
        11: (center + num_offset_tri_x, center + num_offset_tri_y),       # Upper-right triangle
        12: (center + num_offset_corner_xy, center + num_offset_corner_xy) # Top-right corner
    }

    # Calculate PLANET CLUSTER POSITIONS based on SIGN_NUMBER_POS and relative offsets
    PLANET_CLUSTER_POS = {}
    for house_num, (sign_x, sign_y) in SIGN_NUMBER_POS.items():
        if house_num in [1, 7]: # Top/Bottom Diamonds
            PLANET_CLUSTER_POS[house_num] = (sign_x, sign_y + planet_y_offset_diamond)
        elif house_num in [4, 10]: # Left/Right Diamonds
             # Apply horizontal offset for planets in side diamonds if needed, e.g., if sign num is large
            PLANET_CLUSTER_POS[house_num] = (sign_x, sign_y) # Default: centered vertically
        elif house_num in [2, 6, 8, 12]: # Corners
            # Adjust Y offset based on top/bottom half
            y_offset = planet_y_offset_corner if house_num in [2, 12] else -planet_y_offset_corner
            PLANET_CLUSTER_POS[house_num] = (sign_x + planet_x_offset_corner, sign_y + y_offset)
        elif house_num in [3, 5, 9, 11]: # Side Triangles
            # Adjust X offset based on left/right half
            x_offset = planet_x_offset_tri if house_num in [3, 5] else -planet_x_offset_tri
            PLANET_CLUSTER_POS[house_num] = (sign_x + x_offset, sign_y + planet_y_offset_tri)

    # 5. Draw SIGN Numbers in Houses
    for relative_house_num in range(1, 13):
        # Calculate the actual sign index (0-11) for this relative house
        sign_index_for_house = (chart_lagna_sign + relative_house_num - 1) % 12
        # Get the sign number (1-12)
        sign_number = sign_index_for_house + 1
        # Format the number based on language
        if lang_code == 'ne':
            display_numeral = DEVANAGARI_NUMERALS.get(sign_number, str(sign_number))
        else:
            display_numeral = str(sign_number)
        # Get coordinates and draw the text
        x, y = SIGN_NUMBER_POS[relative_house_num]
        ax.text(x, y, display_numeral, fontsize=11, fontweight='bold', ha='center', va='center', color='gray')

    # 6. Group Planets by Relative House
    planets_by_relative_house = defaultdict(list)
    for p in planets:
        # Determine the sign index to use (Rasi or Navamsa)
        planet_sign_index = p.navamsa_sign_index if is_navamsa else p.sign_index
        # Calculate the relative house (1-12) the planet falls into
        relative_house = ((planet_sign_index - chart_lagna_sign) % 12) + 1
        # Get the short name for the label
        planet_label = p.short_name if p.short_name else p.name[:2].upper()
        # Optional: Add parenthesis for Rahu/Ketu
        # if p.name in ("rahu", "ketu"): planet_label = f"({planet_label})"
        planets_by_relative_house[relative_house].append(planet_label)

    # 7. Add Lagna Marker ('As' or 'ल') to House 1 list
    as_marker = lang_labels.get("PanchangKeys", {}).get("as_marker", "(As)")
    lagna_relative_house = 1
    if planets_by_relative_house[lagna_relative_house]:
        # Insert marker at the beginning of the list for House 1
        planets_by_relative_house[lagna_relative_house].insert(0, as_marker)
    else:
        # If House 1 is empty, the marker is the only item
        planets_by_relative_house[lagna_relative_house] = [as_marker]

    # 8. Draw Planet Labels
    for relative_house, labels in planets_by_relative_house.items():
        if not labels: continue # Skip if house is empty

        # Get the calculated coordinates for the planet cluster in this house
        x, y = PLANET_CLUSTER_POS[relative_house]

        # Join labels with a space for horizontal layout
        display_text = " ".join(labels)

        # Dynamically adjust font size based on text length to prevent overlap
        base_fontsize = 9 # Start with a slightly smaller base size
        if len(display_text) > 8: base_fontsize = 8
        if len(display_text) > 12: base_fontsize = 7
        if len(display_text) > 16: base_fontsize = 6
        fontsize = max(base_fontsize, 6) # Ensure a minimum size

        # Draw the text block
        ax.text(x, y, display_text, fontsize=fontsize, color='black', ha='center', va='center', fontweight='normal')

    # 9. Set Plot Limits (add padding around the 0-10 drawing area)
    ax.set_xlim(-1, size + 1)
    ax.set_ylim(-1, size + 1)


def draw_chart(kundali_result: KundaliResult, lang: str = "en") -> io.BytesIO | None:
    """
    Renders Rasi and Navamsa charts side-by-side to a PNG BytesIO buffer.
    Returns None if graphics libraries are unavailable or an error occurs.
    """
    if not HAS_GRAPHICS:
        print("[ERROR] Cannot draw chart: Matplotlib or Pillow not installed.", file=sys.stderr)
        return None

    fig = None # Initialize fig to None to handle potential errors during setup
    try:
        # Validate language code
        lang_code = lang.lower() if lang.lower() in LABELS else "en"
        lang_labels = LABELS[lang_code]

        # Create figure and axes for two charts side-by-side
        # This is the line that was causing the crash in the background thread
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 5.5)) # Width, Height in inches

        # --- Draw Rasi Chart (Left) ---
        _draw_single_chart(
            ax=ax1,
            title=lang_labels["chart_title_rasi"],
            planets=kundali_result.planets,
            chart_lagna_sign=kundali_result.lagna_sign_index, # Use Rasi Lagna index
            lang_labels=lang_labels,
            lang_code=lang_code,
            is_navamsa=False # Indicate this is not the Navamsa chart
        )

        # --- Draw Navamsa Chart (Right) ---
        _draw_single_chart(
            ax=ax2,
            title=lang_labels["chart_title_navamsa"],
            planets=kundali_result.planets,
            chart_lagna_sign=kundali_result.navamsa_lagna_sign_index, # Use Navamsa Lagna index
            lang_labels=lang_labels,
            lang_code=lang_code,
            is_navamsa=True # Indicate this IS the Navamsa chart
        )

        # Adjust layout to prevent overlap and save to buffer
        plt.tight_layout(pad=2.0) # Add padding between charts and around edges
        buf = io.BytesIO() # Create an in-memory bytes buffer
        # Save the figure to the buffer as a PNG image
        # Using the 'Agg' backend allows savefig to work without a GUI window
        plt.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor='white') # Use white background
        plt.close(fig) # IMPORTANT: Close the plot to free memory
        buf.seek(0) # Rewind buffer to the beginning for reading
        return buf

    except Exception as e:
        print(f"[ERROR] Failed to draw dual chart: {e}", file=sys.stderr)
        import traceback; traceback.print_exc()
        # Ensure figure is closed even if an error occurs after its creation
        if fig is not None:
            plt.close(fig)
        return None

# ----------------------------------------------------------------------------
# FastAPI Application
# ----------------------------------------------------------------------------
app = FastAPI(
    title="Kundali Generator API",
    version="1.6.3", # Version bumped for RAG integration
    description="Generates Vedic charts (Rasi & Navamsa with sign numbers), Panchanga, and Dashas using Lahiri Ayanamsa."
)

# CORS Middleware for handling cross-origin requests (e.g., from a frontend app)
frontend_urls = os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_urls,  # Uses environment variable for frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper for processing API/UI requests ---
def _process_request(calendar: str, date_str: str, time_str: str, lat: float, lon: float, tz_name: str, lang: str) -> Tuple[KundaliResult | None, datetime | None, str | None]:
    """Internal function to handle core logic for both API and UI."""
    print(f"\n[INFO] Processing request: Cal={calendar}, Date={date_str}, Time={time_str}, Lat={lat}, Lon={lon}, TZ={tz_name}, Lang={lang}")

    # --- Normalize and Validate Inputs ---
    lang = lang.lower()
    if lang not in LABELS:
        print(f"[WARN] Invalid language code '{lang}', defaulting to 'en'.")
        lang = "en"

    original_date_str = date_str # Keep original for potential BS error messages

    # --- Date Conversion (if BS) ---
    if calendar == "bs":
        print("[DEBUG] Handling BS date conversion...")
        if not (HAS_NEPALI_DATETIME or HAS_NEPALI_DATETIME_FALLBACK):
            return None, None, "Bikram Sambat conversion library ('nepali-datetime' or 'bikram-sambat') not installed."
        try:
            # Basic validation of BS date components before conversion attempt
            y, m, d = map(int, date_str.split("-"))
            # Use a reasonable range; the library will perform exact validation.
            if not (1900 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 32):
                raise ValueError("BS date components out of reasonable range.")
            gregorian_date = bs_to_gregorian(y, m, d)
            if gregorian_date is None:
                # bs_to_gregorian prints specific error, return a general one here
                return None, None, f"Invalid or unsupported Bikram Sambat date: {original_date_str}."
            date_str = gregorian_date.strftime("%Y-%m-%d") # Update date_str to Gregorian for subsequent steps
            print(f"[INFO] Converted BS {original_date_str} to AD {date_str}")
        except ValueError as ve:
            return None, None, f"Invalid BS date format or value: '{original_date_str}'. Expected YYYY-MM-DD. Error: {ve}"
        except Exception as e:
            print(f"[ERROR] Unexpected error converting BS date {original_date_str}: {e}", file=sys.stderr)
            return None, None, f"Internal error converting BS date: {e}"

    # --- Validate all inputs (Date, Time, Lat, Lon, TZ) ---
    print(f"[DEBUG] Validating inputs: Date={date_str}, Time={time_str}, Lat={lat}, Lon={lon}, TZ={tz_name}")
    local_dt_str, error = _validate_inputs(date_str, time_str, lat, lon, tz_name)
    if error:
        print(f"[ERROR] Input validation failed: {error}")
        return None, None, error # Return validation error message

    print(f"[DEBUG] Input validation successful. Local DT string: {local_dt_str}")

    # --- Timezone Conversion to UTC ---
    print(f"[DEBUG] Getting UTC datetime for '{local_dt_str}' with timezone '{tz_name}'...")
    utc_dt = _get_utc_datetime(local_dt_str, tz_name)
    if utc_dt is None:
        # _get_utc_datetime prints specific error
        return None, None, f"Failed to process date/time/timezone combination for '{local_dt_str}' in '{tz_name}'."

    print(f"[DEBUG] UTC datetime obtained: {utc_dt.isoformat()}")

    # --- Core Calculations (Lagna, Planets, Panchanga) ---
    print(f"[DEBUG] Calculating Julian Day for {utc_dt.isoformat()}...")
    jd_ut = _calculate_julian_day_utc(utc_dt)
    print(f"[DEBUG] Julian Day (UT): {jd_ut}")

    print(f"[DEBUG] Computing Kundali data (Lagna, Planets, Panchanga) for JD={jd_ut}, Lat={lat}, Lon={lon}, Lang={lang}...")
    kundali_data, error = compute_kundali_data(jd_ut, lat, lon, lang)
    if error:
        print(f"[ERROR] Core Kundali data computation failed: {error}")
        return None, None, f"Calculation error: {error}"
    if not kundali_data: # Should not happen if error is None, but safety check
        print("[ERROR] compute_kundali_data returned None without an error message.")
        return None, None, "Unknown error during core data calculation."

    print("[DEBUG] Core Kundali data computation successful.")

    # --- Dasha Calculation ---
    print("[DEBUG] Computing Vimshottari Dashas...")
    moon_lon = None
    # Find Moon's longitude from the calculated planets list
    for p in kundali_data.planets:
        if p.name == "moon":
            moon_lon = p.longitude
            break

    if moon_lon is not None:
        print(f"[DEBUG] Found Moon longitude: {moon_lon:.4f}. Calculating Vimshottari...")
        try:
            # Calculate Dashas and add them to the KundaliResult object
            kundali_data.dashas = _compute_vimshottari(moon_lon, utc_dt)
            print(f"[DEBUG] Dasha calculation successful. Found {len(kundali_data.dashas)} Mahadashas.")
        except Exception as e:
            print(f"[ERROR] Exception during Dasha calculation: {e}", file=sys.stderr)
            kundali_data.dashas = [] # Assign empty list on error to avoid downstream issues
            # Optionally, could add a warning to the error message? For now, just log.
    else:
        print("[WARN] Could not compute Dashas (Moon position missing from results).", file=sys.stderr)
        kundali_data.dashas = [] # Ensure dashas list exists but is empty

    # --- Localization (Add display names) ---
    print(f"[DEBUG] Localizing data for language: {lang}...")
    localize_kundali_data(kundali_data, lang)
    print("[DEBUG] Localization complete.")

    print("[INFO] Request processing complete.")
    return kundali_data, utc_dt, None # Return data, utc time, and no error

# --- API Endpoints ---
@app.get("/kundali",
         response_class=JSONResponse,
         summary="Get Kundali Data as JSON",
         tags=["Kundali"])
async def get_kundali_json(
    calendar: str = Query("ad", enum=["ad", "bs"], description="Calendar system for input date ('ad' or 'bs')."),
    date: str = Query(..., description="Birth date in YYYY-MM-DD format (Gregorian or Bikram Sambat based on 'calendar'). Example: 1996-05-23"),
    time: str = Query(..., description="Birth time in HH:MM format (24-hour local time). Example: 06:45"),
    lat: float = Query(..., description="Latitude in decimal degrees (e.g., 27.7172)."),
    lon: float = Query(..., description="Longitude in decimal degrees (e.g., 85.3240)."),
    tz_name: str = Query(..., alias="tz", description="IANA timezone name (e.g., 'Asia/Kathmandu', 'America/New_York')."),
    lang: str = Query("en", enum=["en", "ne"], description="Language for output names ('en' or 'ne')."),
    chart_img: bool = Query(False, description="Include base64 encoded chart image in the JSON response (requires graphics libraries).")
):
    """
    Generates Kundali data (Lagna, Planets, Panchanga, Dashas) and returns it as JSON.
    Uses Lahiri Ayanamsa. Optionally includes a base64 encoded PNG image of the
    Rasi and Navamsa charts if graphics libraries are available and requested.
    """
    kundali_data, _, error = _process_request(calendar, date, time, lat, lon, tz_name, lang)

    # Handle processing errors
    if error:
        return JSONResponse(status_code=400, content={"error": error})
    if not kundali_data: # Should have an error string if this happens, but safety check
        return JSONResponse(status_code=500, content={"error": "Internal calculation error."})

    # Serialize the KundaliResult object to a dictionary
    try:
        response_data = kundali_data.to_dict()
    except Exception as e:
        print(f"[ERROR] Failed to serialize Kundali data to dictionary: {e}", file=sys.stderr)
        return JSONResponse(status_code=500, content={"error": "Failed to serialize result data."})

    # Add chart image if requested AND graphics libraries are available
    response_data["chart_base64"] = None # Default to null
    if chart_img:
        if HAS_GRAPHICS:
            print("[DEBUG] Generating chart image for JSON response...")
            img_buffer = draw_chart(kundali_data, lang.lower())
            if img_buffer:
                try:
                    # Encode the PNG image bytes as base64 string
                    img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
                    response_data["chart_base64"] = img_base64
                    print("[DEBUG] Chart image encoded successfully.")
                except Exception as e:
                    print(f"[ERROR] Failed to base64 encode chart image: {e}", file=sys.stderr)
                    # Keep chart_base64 as None to indicate failure
            else:
                print("[WARN] Chart generation function failed, chart_base64 will be null.")
        else:
             print("[WARN] Chart image requested but graphics libraries (Matplotlib/Pillow) are not available.")


    return JSONResponse(content=response_data)

@app.get("/chart.png",
         response_class=StreamingResponse,
         summary="Get Kundali Chart as PNG Image",
         tags=["Kundali"],
         responses={
             200: {"content": {"image/png": {}}, "description": "Successfully generated PNG chart."},
             400: {"description": "Invalid input parameters."},
             500: {"description": "Internal calculation or rendering error, or graphics libraries unavailable."}
         })
async def get_kundali_chart(
    calendar: str = Query("ad", enum=["ad", "bs"], description="Calendar system for input date ('ad' or 'bs')."),
    date: str = Query(..., description="Birth date in YYYY-MM-DD format."),
    time: str = Query(..., description="Birth time in HH:MM format (24-hour local time)."),
    lat: float = Query(..., description="Latitude in decimal degrees."),
    lon: float = Query(..., description="Longitude in decimal degrees."),
    tz_name: str = Query(..., alias="tz", description="IANA timezone name."),
    lang: str = Query("en", enum=["en", "ne"], description="Language for chart labels ('en' or 'ne').")
):
    """
    Generates and returns a PNG image containing the Rasi and Navamsa charts.
    Requires Matplotlib and Pillow to be installed. Returns an error if they are not.
    """
    # Check if graphics libraries are available upfront
    if not HAS_GRAPHICS:
         print("[ERROR] Chart endpoint called but graphics libraries are missing.")
         # Return a plain text error response with 501 Not Implemented
         error_msg = "Error: Chart generation unavailable. Server missing graphics libraries (Matplotlib/Pillow)."
         return StreamingResponse(io.BytesIO(error_msg.encode()), status_code=501, media_type="text/plain")

    # Process the request to get Kundali data
    kundali_data, _, error = _process_request(calendar, date, time, lat, lon, tz_name, lang)

    # Handle processing errors
    if error:
        print(f"[ERROR] Input error for chart request: {error}")
        # Return a 400 status code with a plain text error body
        return StreamingResponse(io.BytesIO(f"Error: {error}".encode()), status_code=400, media_type="text/plain")
    if not kundali_data:
        print("[ERROR] Internal calculation error for chart request.")
        return StreamingResponse(io.BytesIO(b"Error: Internal calculation error."), status_code=500, media_type="text/plain")

    # Generate the chart image
    print("[DEBUG] Generating chart image for PNG endpoint...")
    img_buffer = draw_chart(kundali_data, lang.lower())

    if img_buffer:
        print("[DEBUG] Chart image generated successfully.")
        # Stream the image buffer as a PNG response
        return StreamingResponse(img_buffer, media_type="image/png")
    else:
        # Handle failure during chart rendering
        print("[ERROR] Failed to render chart image.")
        return StreamingResponse(io.BytesIO(b"Error: Failed to render chart image."), status_code=500, media_type="text/plain")
    
    


# ============================================================================ #
# GRADIO SECTION (Modified for RAG integration)                                #
# ============================================================================ #

def gradio_interface_handler(
    calendar_ui: str, date_ui: str, time_ui: str, lat_ui: float, lon_ui: float,
    tz_name_ui: str, lang_ui: str, show_chart_ui: bool
) -> Tuple[str, Image.Image | None, str, str, str, Dict]: # 💡 Output: Summary MD, Image, Planets MD, Houses MD, Dasha MD, Kundali JSON Dict
    """
    Handles input from Gradio UI, calls backend processing, formats output for tabs,
    and returns the raw Kundali JSON data for the interpretation feature.
    """
    # Check if Gradio is available (should be if this function is called, but double-check)
    if not HAS_GRADIO or not HAS_GRAPHICS:
         return "**Error:** Gradio UI requires Gradio, Matplotlib, and Pillow libraries to be installed.", None, "", "", "", {}

    try:
        # Map Gradio inputs to backend parameters
        calendar = "bs" if "BS" in calendar_ui else "ad"
        lang = lang_ui.lower() # Use lowercase 'en' or 'ne' internally

        # Call the main processing function
        kundali_data, utc_dt, error = _process_request(calendar, date_ui, time_ui, lat_ui, lon_ui, tz_name_ui, lang)

        # Handle errors from processing
        if error:
            err_md = f"**Error:**\n```\n{error}\n```"
            return err_md, None, "", "", "", {} # Return error in first tab, clear others, empty dict for state
        if not kundali_data or not utc_dt: # Should not happen if error is None, but safety check
            err_md = "**Error:**\n```\nCalculation failed unexpectedly.\n```"
            return err_md, None, "", "", "", {}

        # --- Format successful results for Gradio tabs ---
        lang_labels = LABELS.get(lang, EN) # Get localized labels
        panchang_keys = lang_labels.get("PanchangKeys", PANCHANG_KEYS["en"]) # Localized keys for Panchanga items

        # Get full data dictionary once for easier access
        full_data_dict = kundali_data.to_dict()
        all_planets_dict = full_data_dict.get('planets', [])

        # Find Moon position for Rashi display in summary (needed if Panchanga fails but planets succeed)
        moon_short_name = lang_labels["planet_short"][PLANET_NAME_TO_INDEX["Moon"]] # Get localized short name for Moon
        moon_pos_dict = next((p for p in all_planets_dict if p.get('planet_short') == moon_short_name), None)

        # 1. Format Summary & Panchanga Tab (Markdown)
        summary_text = f"## Summary & Panchanga ({lang.upper()})\n\n"
        lagna_info = full_data_dict.get('lagna', {})
        nav_lagna_info = full_data_dict.get('navamsa_lagna', {})

        summary_text += f"**{lang_labels.get('lagna', 'Lagna')}:** {lagna_info.get('sign', 'N/A')} ({lagna_info.get('longitude_within_sign', 0.0):.2f}°)\n"
        summary_text += f"- Nakshatra: {lagna_info.get('nakshatra', 'N/A')} (Pada {lagna_info.get('pada', '?')})\n"
        summary_text += f"- Navamsa Lagna: {nav_lagna_info.get('sign', 'N/A')}\n\n"

        panchanga_info = full_data_dict.get('panchanga')
        if panchanga_info:
             # Display Moon Rashi (Sign) using localized key
             rashi_label = panchang_keys.get('rashi', 'Rashi')
             rashi_val = moon_pos_dict.get('sign', 'N/A') if moon_pos_dict else 'N/A' # Get Moon's sign name
             summary_text += f"**{rashi_label}:** {rashi_val}\n"

             # Display Tithi & Paksha
             tithi_label = panchang_keys.get('tithi', 'Tithi')
             tithi_val = panchanga_info.get('tithi', 'N/A')
             paksha_val = panchanga_info.get('paksha','N/A')
             summary_text += f"**{tithi_label}:** {tithi_val} ({paksha_val})\n"

             # Display Moon Nakshatra & Pada
             nak_label = panchang_keys.get('nakshatra', 'Nakshatra')
             pada_label = panchang_keys.get('pada', 'Pada')
             nak_val = moon_pos_dict.get('nakshatra', 'N/A') if moon_pos_dict else 'N/A' # Get Moon's Nakshatra name
             pada_val = moon_pos_dict.get('pada', '?') if moon_pos_dict else '?' # Get Moon's Pada
             summary_text += f"**{nak_label}:** {nak_val} ({pada_label} {pada_val})\n"

             # Display other Panchanga elements using localized keys
             akshar_label = panchang_keys.get('akshar', 'Akshar')
             akshar_val = panchanga_info.get('akshar', 'N/A') # Akshar name is directly in panchanga dict
             summary_text += f"**{akshar_label}:** {akshar_val}\n"
             summary_text += f"**{panchang_keys.get('yoga', 'Yoga')}:** {panchanga_info.get('yoga', 'N/A')}\n"
             summary_text += f"**{panchang_keys.get('karana', 'Karana')}:** {panchanga_info.get('karana', 'N/A')}\n"
             summary_text += f"**{panchang_keys.get('gana', 'Gana')}:** {panchanga_info.get('gana', 'N/A')}\n"
             summary_text += f"**{panchang_keys.get('yoni', 'Yoni')}:** {panchanga_info.get('yoni', 'N/A')}\n"
             summary_text += f"**{panchang_keys.get('nadi', 'Nadi')}:** {panchanga_info.get('nadi', 'N/A')}\n"
             summary_text += f"**{panchang_keys.get('varna', 'Varna')}:** {panchanga_info.get('varna', 'N/A')}\n"
        else:
             summary_text += "*Panchanga details could not be calculated.*\n"

        # 2. Format Planets Table Tab (Markdown)
        planets_text = f"## Planetary Positions ({lang.upper()})\n\n"
        if all_planets_dict:
            # Header row
            planets_text += "| Planet | Sign | Longitude | Nakshatra | Pada | Navamsa Sign |\n"
            planets_text += "|---|---|---|---|---|---|\n"
            # Data rows
            for p in all_planets_dict:
                lon_str = f"{p.get('longitude_within_sign', 0.0):.2f}°" # Format longitude within sign
                planets_text += (f"| {p.get('planet', '?')} ({p.get('planet_short', '?')}) "
                                 f"| {p.get('sign', '?')} "
                                 f"| {lon_str} "
                                 f"| {p.get('nakshatra', '?')} "
                                 f"| {p.get('pada', '?')} "
                                 f"| {p.get('navamsa_sign', '?')} |\n")
        else:
            planets_text += "*Planetary positions could not be calculated.*\n"

        # 3. Format House Positions Tab (Markdown) - Rasi Chart Based
        houses_text = f"## House Positions (Rasi Chart - {lang.upper()})\n\n"
        # Calculate house occupants based on Rasi positions
        house_occupants = defaultdict(list)
        if kundali_data.lagna_sign_index is not None: # Ensure lagna index is valid
            for p in all_planets_dict:
                # Use Rasi sign index for house calculation
                planet_sign_idx = p.get('sign_index', -1)
                if planet_sign_idx != -1:
                    # Calculate relative house number (1-12)
                    house_num = ((planet_sign_idx - kundali_data.lagna_sign_index) % 12) + 1
                    # Format planet string with degree
                    planet_str = f"{p.get('planet_short', '?')} ({p.get('longitude_within_sign', 0.0):.2f}°)"
                    house_occupants[house_num].append(planet_str)

            # Build Markdown table
            houses_text += "| House | Planets (Degree in Sign) |\n"
            houses_text += "|---|---|\n"
            for house_num in range(1, 13):
                planets_in_house = ", ".join(house_occupants[house_num]) if house_num in house_occupants else "-"
                houses_text += f"| {house_num} | {planets_in_house} |\n"
        else:
             houses_text += "*House positions could not be determined (Lagna calculation failed).*\n"


        # 4. Format Dasha Timeline Tab (Markdown)
        dasha_text = f"## Vimshottari Dasha ({lang.upper()})\n\n"
        dashas_list = full_data_dict.get('dashas', []) # Get the list of Mahadasha dicts
        if dashas_list:
            dasha_text += "**Mahadashas (Major Periods):**\n"
            # Iterate through all Mahadashas
            for i, d in enumerate(dashas_list):
                 start_dt_str = d.get('start', '')
                 end_dt_str = d.get('end', '')
                 # Format dates nicely (YYYY-MM-DD)
                 start_dt = datetime.fromisoformat(start_dt_str).strftime("%Y-%m-%d") if start_dt_str else '?'
                 end_dt = datetime.fromisoformat(end_dt_str).strftime("%Y-%m-%d") if end_dt_str else '?'
                 # Display Mahadasha line
                 dasha_text += f"- **{d.get('planet', '?')}**: {start_dt} to {end_dt}\n"

                 # Display Antardashas only for the *first* Mahadasha listed (usually the current/starting one)
                 # This keeps the UI cleaner; full details are in the JSON API response.
                 if i == 0 and d.get('antardashas'):
                     antardashas = d.get('antardashas', [])
                     dasha_text += "  *Antardashas (Sub-periods):*\n"
                     # Limit displayed Antardashas to avoid excessive length? (Optional)
                     # limit_antardashas = 10
                     for j, ad in enumerate(antardashas):
                         # if j >= limit_antardashas and len(antardashas) > limit_antardashas:
                         #     if j == limit_antardashas: dasha_text += f"       - ... ({len(antardashas) - limit_antardashas} more)\n"
                         #     continue # Stop after showing ellipsis

                         ad_start_str = ad.get('start', '')
                         ad_end_str = ad.get('end', '')
                         ad_start = datetime.fromisoformat(ad_start_str).strftime("%Y-%m-%d") if ad_start_str else '?'
                         ad_end = datetime.fromisoformat(ad_end_str).strftime("%Y-%m-%d") if ad_end_str else '?'
                         dasha_text += f"       - {ad.get('planet', '?')}: {ad_start} to {ad_end}\n"

        elif not moon_pos_dict: # Check if Moon position was available for calculation
            dasha_text += "*Dasha calculation skipped (Moon position missing).*\n"
        else: # Dasha calculation failed for other reasons
            dasha_text += "*Dasha calculation failed or unavailable.*\n"

        # 5. Generate Chart Image (PIL Image for Gradio)
        chart_image_pil = None
        chart_warning = ""
        if show_chart_ui:
            print("[DEBUG] Gradio: Generating chart image...")
            img_buffer = draw_chart(kundali_data, lang)
            if img_buffer:
                try:
                    img_buffer.seek(0) # Rewind buffer
                    chart_image_pil = Image.open(img_buffer) # Open image from buffer using Pillow
                    print("[DEBUG] Gradio: Chart image created successfully.")
                except Exception as img_err:
                    print(f"[ERROR] Gradio: Failed to open chart image buffer: {img_err}", file=sys.stderr)
                    chart_warning = "\n\n*(Warning: Error displaying chart image)*"
            else:
                print("[WARN] Gradio: Chart generation function failed.")
                chart_warning = "\n\n*(Warning: Failed to generate chart image)*"

        # Append any chart warning to one of the text outputs (e.g., Planets tab)
        if chart_warning:
            planets_text += chart_warning

        # Return all formatted outputs for the respective tabs AND the raw JSON data
        return summary_text, chart_image_pil, planets_text, houses_text, dasha_text, kundali_data.to_dict()

    except Exception as e:
        # Catch any unexpected errors in the Gradio handler itself
        print(f"[ERROR] Gradio handler unexpected error: {e}", file=sys.stderr)
        import traceback
        error_msg = f"**An unexpected error occurred in the UI handler:**\n```\n{traceback.format_exc()}\n```"
        # Return error message to the first tab, clear others, empty dict for state
        return error_msg, None, "", "", "", {}

# -----------------------------------------------------------------------------
def create_gradio_ui() -> gr.Blocks:
    """Constructs the Gradio Blocks interface with the new Interpret button."""
    print("[INFO] Creating Gradio UI definition...")
    # Define available timezones for dropdown (optional, can be long)
    # common_timezones = pytz.common_timezones

    with gr.Blocks(title="Kundali Generator", theme=gr.themes.Glass()) as interface:
        gr.Markdown("# Vedic Birth Chart Generator (Kundali)")
        gr.Markdown("Generate Sidereal (Lahiri Ayanamsa) Vedic charts (Rasi & Navamsa), Panchanga details, and Vimshottari Dashas. Optionally interpret the chart using RAG.")

        with gr.Row():
            # Input Column
            with gr.Column(scale=1):
                gr.Markdown("### Birth Details")
                with gr.Group(): # Group inputs visually
                    calendar_input = gr.Radio(
                        ["AD (Gregorian)", "BS (Bikram Sambat)"],
                        label="Calendar System",
                        value="AD (Gregorian)",
                        info="Select the calendar for the birth date input."
                    )
                    date_input = gr.Textbox(
                        label="Birth Date",
                        placeholder="YYYY-MM-DD",
                        value="1996-05-23", # Default example value
                        info="Enter date according to selected calendar."
                    )
                    time_input = gr.Textbox(
                        label="Birth Time (Local)",
                        placeholder="HH:MM (24-hr)",
                        value="06:45", # Default example value
                        info="Enter local time of birth."
                    )
                    lat_input = gr.Number(
                        label="Latitude (°)",
                        value=27.67, # Default example value (near Chitwan, Nepal)
                        info="Decimal degrees (e.g., 27.7172 for Kathmandu)."
                    )
                    lon_input = gr.Number(
                        label="Longitude (°)",
                        value=84.43, # Default example value (near Chitwan, Nepal)
                        info="Decimal degrees (e.g., 85.3240 for Kathmandu)."
                    )
                    tz_name_input = gr.Textbox(
                        label="Timezone Name",
                        placeholder="e.g., Asia/Kathmandu",
                        value="Asia/Kathmandu", # Default example value
                        info="Use standard IANA timezone names (case-sensitive)."
                        # Alternative: Dropdown (can be very long)
                        # tz_name_input = gr.Dropdown(label="Timezone", choices=common_timezones, value="Asia/Kathmandu", allow_custom_value=True)
                    )
                    lang_input = gr.Radio(
                        ["EN", "NE"],
                        label="Output Language",
                        value="EN",
                        info="Language for names and labels."
                    )
                    show_chart_input = gr.Checkbox(
                        label="Show Chart Image",
                        value=True,
                        info="Generate and display the chart image (requires graphics libraries)."
                    )
                submit_btn = gr.Button("Generate Kundali", variant="primary")

            # Output Column with Tabs
            with gr.Column(scale=2):
                gr.Markdown("### Results")
                with gr.Tabs():
                    with gr.TabItem("Summary & Panchanga"):
                        output_summary = gr.Markdown(value="*Enter details and click Generate.*")
                    with gr.TabItem("Planets Table"):
                        output_planets = gr.Markdown() # Placeholder for planets table
                    with gr.TabItem("House Positions"):
                        output_houses = gr.Markdown() # Placeholder for house positions table
                    with gr.TabItem("Dashas"):
                        output_dasha = gr.Markdown() # Placeholder for Dasha timeline
                    with gr.TabItem("Charts"):
                        output_image = gr.Image(
                            label="Rasi & Navamsa Charts",
                            type="pil", # Use PIL Image type for compatibility
                            interactive=False, # Image is output only
                            show_label=True,
                            visible=True # Start visible
                           )

        # 💡 NEW – RAG UI block (conditionally add if RAG module is available)
        kundali_state = gr.State({}) # Store the generated Kundali JSON dictionary
        interpret_md = gr.Markdown("*Interpretation will appear here.*", visible=HAS_RAG) # Output for interpretation
        interpret_btn = gr.Button("Interpret Chart (using RAG)", variant="secondary", visible=HAS_RAG)

        # Add a placeholder message if RAG is not available
        if not HAS_RAG:
            gr.Markdown("<p style='color:orange; font-weight:bold;'>Note: Interpretation feature disabled. Ensure `kundali_rag.py` and its dependencies (chromadb, langchain, tiktoken) are installed and Ollama is running.</p>")


        # ------------ Wiring ------------
        submit_btn.click(
            fn=gradio_interface_handler,
            inputs=[calendar_input, date_input, time_input, lat_input, lon_input, tz_name_input, lang_input, show_chart_input],
            # Outputs map to the variables defined in the Tabs structure AND the state
            outputs=[output_summary, output_image, output_planets, output_houses, output_dasha, kundali_state] # 💡 kundali_state added
        )

        # Wire the interpret button (only if RAG is available)
        if HAS_RAG:
            interpret_btn.click(
                fn=lambda kjson: kundali_rag.interpret_kundali(kjson), # Call the RAG function
                inputs=kundali_state, # Pass the stored Kundali JSON
                outputs=interpret_md, # Display the result in the interpretation markdown
                api_name="interpret_kundali" # Optional: name for API endpoint if Gradio API is used
            )

        # Add Footer / API Info
        gr.Markdown(f"""---
        ### API Access (if running locally)
        * **JSON:** `http://127.0.0.1:{fastapi_port}/kundali?date=...&time=...&lat=...&lon=...&tz=Asia/Kathmandu...`
        * **Chart:** `http://127.0.0.1:{fastapi_port}/chart.png?date=...&time=...&lat=...&lon=...&tz=Asia/Kathmandu...`
        **Note:** Uses Lahiri Ayanamsha. Requires Swiss Ephemeris files & `pytz`. Ensure ephemeris files are accessible by the script. Chart rendering uses Matplotlib & Pillow. RAG interpretation requires `kundali_rag.py`, `chromadb`, `langchain`, `tiktoken`, and a running Ollama instance.
        """)
        # Display warning if BS conversion library is missing
        if not (HAS_NEPALI_DATETIME or HAS_NEPALI_DATETIME_FALLBACK):
            gr.Markdown("<p style='color:red; font-weight:bold;'>Warning: Bikram Sambat (BS) date input is disabled. Please install 'nepali-datetime' or 'bikram-sambat'.</p>")
        # Display warning if graphics libraries are missing
        if not HAS_GRAPHICS:
             gr.Markdown("<p style='color:red; font-weight:bold;'>Warning: Chart generation and Gradio UI require 'matplotlib' and 'Pillow'. Chart features will be disabled.</p>")
        elif not HAS_GRADIO:
             gr.Markdown("<p style='color:red; font-weight:bold;'>Warning: Gradio UI requires the 'gradio' library. UI features will be disabled.</p>")


    print("[INFO] Gradio UI definition created.")
    return interface

# ============================================================================ #
# MAIN Execution                                                               #
# ============================================================================ #
# Define host and ports using environment variables
fastapi_host = os.getenv("FASTAPI_HOST", "127.0.0.1")
fastapi_port = int(os.getenv("FASTAPI_PORT", "8000"))
gradio_host = os.getenv("GRADIO_HOST", "127.0.0.1")
gradio_port = int(os.getenv("GRADIO_PORT", "7860"))

def run_fastapi():
    """Target function to run the FastAPI server using uvicorn."""
    try:
        import uvicorn
        print(f"[INFO] Starting FastAPI server on http://{fastapi_host}:{fastapi_port}")
        # Use reload=False for stability, log_level="info" or "warning"
        uvicorn.run(app, host=fastapi_host, port=fastapi_port, log_level="info", reload=False)
    except ImportError:
        print("[ERROR] 'uvicorn' is not installed. Cannot run FastAPI server.", file=sys.stderr)
        print("        Install it using: pip install 'uvicorn[standard]'", file=sys.stderr)
    except Exception as e:
        print(f"[ERROR] Failed to start FastAPI server: {e}", file=sys.stderr)

if __name__ == "__main__":
    # Start FastAPI in a separate thread
    # Use daemon=True so the thread exits automatically when the main program exits
    api_thread = threading.Thread(target=run_fastapi, daemon=True)
    api_thread.start()

    # Create and launch the Gradio interface in the main thread (if available)
    if HAS_GRADIO and HAS_GRAPHICS:
        gradio_interface = create_gradio_ui()
        print(f"[INFO] Launching Gradio UI on http://{gradio_host}:{gradio_port}")
        try:
            # share=False is recommended for security unless public access is needed
            gradio_interface.launch(server_name=gradio_host, server_port=gradio_port, share=False)
        except Exception as e:
            print(f"[ERROR] Failed to launch Gradio UI: {e}", file=sys.stderr)
        print("[INFO] Gradio UI closed.")
    else:
        print("[INFO] Gradio UI disabled due to missing dependencies (Gradio/Matplotlib/Pillow).")
        print("[INFO] API server might still be running in the background (Press Ctrl+C to stop).")
        # Keep the main thread alive if only the API is running,
        # otherwise it might exit immediately if Gradio isn't launched.
        try:
             # Keep main thread alive until interrupted (e.g., Ctrl+C)
             while api_thread.is_alive():
                 # Wait for the API thread, checking periodically
                 api_thread.join(timeout=1.0) # Use join with timeout
        except KeyboardInterrupt:
             print("\n[INFO] Received exit signal.")
        except Exception as main_e:
            print(f"[ERROR] Unexpected error in main loop: {main_e}", file=sys.stderr)


    print("[INFO] Exiting application.")
    # FastAPI thread will exit automatically as it's a daemon
