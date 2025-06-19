"""
A *self‑contained* module that

1. **Builds / loads** a Chroma vector‑store from an astrology knowledge‑base file
   (any markdown / txt / json – one big text is fine).
2. Provides **`interpret_kundali()`** – give it the raw Kundali JSON produced by
   *kundali_generator.py* and it will
   – retrieve the most relevant KB passages
   – ask a local LLM (served by **Ollama**) to draft a detailed interpretation.
3. Ships a tiny **Gradio helper** (`make_interpret_ui`) so you can drop an
   *Interpret Chart* button into the existing Blocks in one line.

---------------------------------------------------------------------------
QUICK START
---------------------------------------------------------------------------
# 0)  Dependencies
pip install chromadb langchain langchain-community tiktoken ollama

# 1)  Pull / run the models in Ollama (once):
ollama pull nomic-embed-text:latest
ollama pull gemma2:9b          # Example model, use your preferred one like gemma:7b, llama3:8b etc.

# 2)  Build the vector‑store **once** (replace knowledgebase.json with your own knowledge base):
python kundali_rag.py --build-kb knowledgebase.json --embed-model nomic-embed-text:latest

# 3)  Call the helper from anywhere (example – CLI demo):
python kundali_rag.py --interpret sample_kundali.json --llm-model gemma2:9b --embed-model nomic-embed-text:latest
"""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
import logging  # Use standard logging
from pathlib import Path
from typing import Any, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="[%(levelname)s] %(message)s", stream=sys.stdout
)
# Suppress noisy logs from libraries if needed
# logging.getLogger("httpx").setLevel(logging.WARNING)
# logging.getLogger("chromadb").setLevel(logging.WARNING)
# logging.getLogger("ollama").setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Optional / graceful imports
# ---------------------------------------------------------------------------
try:
    from langchain_chroma import Chroma

    logging.info("Using langchain_chroma.")
except ImportError:
    logging.warning(
        "langchain-chroma not found, falling back to langchain_community.vectorstores.Chroma."
    )
    try:
        from langchain_community.vectorstores import Chroma
    except ImportError:
        logging.error(
            "Neither langchain_chroma nor langchain_community.vectorstores.Chroma could be imported. Install langchain-chroma or langchain-community."
        )
        sys.exit(1)

try:
    # Prefer updated ollama integrations if available
    from langchain_ollama.embeddings import OllamaEmbeddings
    from langchain_ollama.llms import OllamaLLM as Ollama

    logging.info("Using langchain_ollama integrations.")
except ImportError:
    logging.warning("langchain_ollama not found, falling back to langchain_community.")
    try:
        from langchain_community.embeddings import OllamaEmbeddings
        from langchain_community.llms import Ollama
    except ImportError:
        logging.error(
            "Neither langchain_ollama nor langchain_community llm/embeddings could be imported. Install langchain-ollama or langchain-community."
        )
        sys.exit(1)

# Ensure core langchain components are available
try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain.prompts import PromptTemplate, FewShotPromptTemplate
    from langchain.chains import RetrievalQA
    from langchain.docstore.document import Document
except ImportError:
    logging.error(
        "Core langchain components (text_splitter, prompts, chains, docstore) not found. Ensure langchain is installed."
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Defaults & constants
# ---------------------------------------------------------------------------
# Default model changed to match Quick Start recommendation
_STORE_DIR = Path("rag_store")  # Use Path object
_EMBED_MODEL = "nomic-embed-text:latest"  # Default embedding model
_LLM_MODEL = "gemma3:1b"  # Default LLM (change if needed)
_CHUNK = 512
_OVERLAP = 64
_RETRIEVER_K = 8  # Number of documents to retrieve

# ---------------------------------------------------------------------------
# Build / load helpers
# ---------------------------------------------------------------------------


def _build_vector_store(
    kb_path: str | Path,
    store_dir: str | Path = _STORE_DIR,
    embed_model: str = _EMBED_MODEL,
) -> None:
    """Split the KB into chunks → embed → persist to Chroma."""
    kb_path = Path(kb_path)
    store_dir = Path(store_dir)

    try:
        logging.info(f"Reading knowledge base file: {kb_path}")
        text = kb_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        logging.error(f"Knowledge base file not found: {kb_path}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Failed to read knowledge base file {kb_path}: {e}")
        sys.exit(1)

    logging.info(f"Splitting text into chunks (size={_CHUNK}, overlap={_OVERLAP})...")
    splitter = RecursiveCharacterTextSplitter(chunk_size=_CHUNK, chunk_overlap=_OVERLAP)
    docs = [Document(page_content=t) for t in splitter.split_text(text)]
    logging.info(f"Created {len(docs)} document chunks.")

    try:
        logging.info(f"Initializing embeddings with Ollama model: {embed_model}")
        # Specify base_url if Ollama runs elsewhere, e.g., http://host.docker.internal:11434
        # Consider adding timeout parameters if needed.
        embeddings = OllamaEmbeddings(model=embed_model)

        logging.info(f"Building Chroma vector store at: {store_dir}")
        # Ensure store directory exists (Chroma might create it, but good practice)
        store_dir.mkdir(parents=True, exist_ok=True)
        # Instantiate Chroma and add documents
        Chroma.from_documents(
            docs, embeddings, persist_directory=str(store_dir)
        )  # Pass path as string
        logging.info(
            f"Vector store '{store_dir}' built successfully with {len(docs)} chunks."
        )
    except Exception as e:
        logging.error(
            f"Failed to build vector store: {e}", exc_info=True
        )  # Log traceback
        logging.error(
            f"Ensure Ollama service is running and the embedding model '{embed_model}' is available (`ollama pull {embed_model}`)."
        )
        sys.exit(1)


def _load_vector_store(
    store_dir: str | Path = _STORE_DIR, embed_model: str = _EMBED_MODEL
) -> Chroma:
    """Loads an existing Chroma vector store."""
    store_dir = Path(store_dir)
    if not store_dir.exists() or not any(
        store_dir.iterdir()
    ):  # Check if dir exists and is not empty
        logging.error(f"Vector store directory '{store_dir}' not found or is empty.")
        raise FileNotFoundError(
            f"Vector store '{store_dir}' not found or empty – build it first with --build-kb <kb_file>."
        )
    try:
        logging.info(
            f"Loading vector store from: {store_dir} using embedding model: {embed_model}"
        )
        embeddings = OllamaEmbeddings(model=embed_model)
        # Pass path as string to Chroma constructor
        vectordb = Chroma(
            persist_directory=str(store_dir), embedding_function=embeddings
        )
        logging.info("Vector store loaded successfully.")
        return vectordb
    except Exception as e:
        logging.error(
            f"Failed to load vector store from {store_dir}: {e}", exc_info=True
        )
        logging.error(
            f"Ensure Ollama service is running and the embedding model '{embed_model}' is available."
        )
        sys.exit(1)


# ---------------------------------------------------------------------------
# Few‑shot examples (unchanged)
# ---------------------------------------------------------------------------
_EXAMPLES = [
    {
        "context": "Surya exalted in Mesha signifies courageous self-expression and natural authority. \nChandra in the 9th enhances devotion to dharma and love for learning.",
        "question": '{"lagna":"Karka","sun":{"sign":"Mesha","house":10}}',
        "interpretation": "🙏 Namaste dear friend! Your **Cancer Lagna (Karka)** blesses you with a gentle heart… *Hari Om Tat Sat* 🌺",
    },
    {
        "context": "Shani in the 7th can delay partnerships, while Rahu in the 11th brings unconventional gains.",
        "question": '{"lagna":"Mithuna","saturn":{"house":7},"rahu":{"house":11}}',
        "interpretation": "🙏 Namaste dear friend! With **Gemini Lagna (Mithuna)** you carry a lively intellect… *Hari Om Tat Sat* 🌺",
    },
]

_EXAMPLE_PROMPT = PromptTemplate(
    input_variables=["context", "question", "interpretation"],
    template=textwrap.dedent(
        """\
        --------------------------------------------------
        📚 *Illustrative Reference*
        {{context}}

        🔮 *Illustrative Kundali JSON*
        {{question}}

        🪄 *Illustrative Interpretation*
        {{interpretation}}
    """
    ),
    template_format="jinja2",
)

_PREFIX = """Om Gurave Namah 🙏
Below are a few examples so you can grasp the desired devotional tone and structure. After these examples, the client's chart details and relevant knowledge base passages will be provided. Your task is to synthesize these into a detailed, warm, and insightful interpretation based *only* on the provided reference passages."""

_SUFFIX = textwrap.dedent(
    """\
    --------------------------------------------------
    📚 **Reference Passages** (use only these for interpretation)
    {{context}}

    --------------------------------------------------
    🔮 **Client Kundali JSON** (interpret this chart based on the passages above)
    {{question}}

    --------------------------------------------------
    ✍️ **Your Detailed Interpretation**
    Please provide a comprehensive interpretation (aiming for significant detail, perhaps around 800-1200 words) in warm, devotional, and encouraging English. Structure your analysis logically, covering aspects like:
    * The core nature indicated by the Lagna (Ascendant) sign and its lord's placement.
    * The influence of planets (Grahas) based on their sign, house, aspects, and any significant yogas mentioned or implied in the reference passages.
    * Insights from Nakshatras if relevant information is present in the context.
    * Mention potential strengths and challenges indicated.
    * Suggest general remedial measures if appropriate, keeping a positive tone.
    * Maintain a respectful and spiritual perspective throughout.

    Conclude the interpretation with heartfelt blessings and the phrase **"Hari Om Tat Sat"** 🌺
    """
)

# Note: example_separator needed for FewShotPromptTemplate
_PROMPT: FewShotPromptTemplate = FewShotPromptTemplate(
    examples=_EXAMPLES,
    example_prompt=_EXAMPLE_PROMPT,
    prefix=_PREFIX,
    suffix=_SUFFIX,
    input_variables=["context", "question"],  # These are filled by RetrievalQA
    example_separator="\n---\n",
    template_format="jinja2",
)

# ---------------------------------------------------------------------------
# Core helper – interpret_kundali (REVISED to fix formatting error)
# ---------------------------------------------------------------------------


def interpret_kundali(
    kundali_json: Dict[str, Any] | str,
    store_dir: str | Path = _STORE_DIR,
    embed_model: str = _EMBED_MODEL,
    llm_model: str = _LLM_MODEL,
    k: int = _RETRIEVER_K,
    ollama_base_url: str | None = None,  # Optional: Specify Ollama URL
    llm_temperature: float = 0.7,  # Optional: Control creativity
) -> str:
    """
    Retrieves relevant passages from the vector store and uses an LLM
    to generate a devotional, detailed interpretation for the given Kundali JSON.
    """
    logging.info(
        f"Interpreting Kundali using LLM: {llm_model} via Ollama (Base URL: {ollama_base_url or 'default'})"
    )
    logging.info(f"Retrieving top {k} passages from vector store: {store_dir}")

    # 1. Ensure Kundali data is a valid JSON string
    try:
        if isinstance(kundali_json, str):
            # Validate if it's already a string
            json.loads(kundali_json)
            kundali_str = kundali_json
        elif isinstance(kundali_json, dict):
            # Convert dict to JSON string
            # Use compact JSON for prompt
            kundali_str = json.dumps(
                kundali_json, indent=None
            )  # Use compact JSON for prompt
        else:
            raise TypeError("Input must be a JSON string or a dictionary.")

        logging.debug(f"Validated Kundali JSON for interpretation:\n{kundali_str}")

    except (json.JSONDecodeError, TypeError) as e:
        logging.error(f"Invalid Kundali input: {e}\nInput provided: {kundali_json}")
        return "[ERROR] Could not interpret due to invalid Kundali JSON input."
    except Exception as e:
        logging.error(f"Error processing Kundali input: {e}", exc_info=True)
        return f"[ERROR] Could not interpret due to an input error: {e}"

    # ---> FIX: Removed the manual escaping of braces <---
    # kundali_str_escaped = kundali_str.replace('{', '{{').replace('}', '}}')
    # Pass the raw kundali_str to the chain's invoke method.
    # LangChain's PromptTemplate and RetrievalQA should handle substitution correctly.

    try:
        # 2. Load vector store and create retriever
        vectordb = _load_vector_store(store_dir, embed_model)
        retriever = vectordb.as_retriever(
            search_type="mmr",  # Maximal Marginal Relevance for diverse results
            search_kwargs={"k": k, "fetch_k": k * 5},  # Fetch more initially for MMR
        )
        logging.info(f"Retriever configured (type=MMR, k={k}, fetch_k={k*5})")

        # 3. Initialise LLM connection
        llm_kwargs = {"model": llm_model, "temperature": llm_temperature}
        if ollama_base_url:
            llm_kwargs["base_url"] = ollama_base_url
        logging.info(f"Initializing Ollama LLM with kwargs: {llm_kwargs}")
        llm = Ollama(**llm_kwargs)

        # 4. Create RetrievalQA chain
        # Chain type "stuff" puts all retrieved docs into the context.
        rag_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=retriever,
            chain_type_kwargs={"prompt": _PROMPT},
            return_source_documents=False,  # Don't return source docs in final output
            verbose=False,  # Set to True for more detailed LangChain logs
        )
        logging.info("RetrievalQA chain created.")

        # 5. Run the chain using invoke
        logging.info("Invoking RAG chain with Kundali JSON query...")
        # ---> FIX: Pass the *original* JSON string as the query <---
        # The key 'query' here maps to the '{question}' variable in the prompt template.
        result = rag_chain.invoke({"query": kundali_str})
        logging.info("RAG chain invocation finished.")

        # Extract the actual answer string from the result dictionary
        if isinstance(result, dict) and "result" in result:
            final_interpretation = result["result"]
            # Optional: Clean up potential LLM artifacts if needed (e.g., extra quotes)
            # final_interpretation = final_interpretation.strip().strip('"')
            logging.info("Successfully extracted interpretation from RAG result.")
            return final_interpretation.strip()
        else:
            # Log unexpected output format from the chain
            logging.warning(f"Unexpected RAG chain output format: {type(result)}")
            logging.warning(f"Output content: {result}")
            # Return the raw output as a string in case of unexpected format
            return f"[WARN] Received unexpected output format from interpretation chain: {result}"

    except FileNotFoundError as e:
        logging.error(f"{e}")
        return f"[ERROR] Interpretation failed: {e}"
    except ImportError as e:
        logging.error(f"Missing library for interpretation: {e}")
        return f"[ERROR] Interpretation failed due to missing library: {e}"
    except Exception as e:
        logging.error(
            f"An error occurred during interpretation: {e}", exc_info=True
        )  # Log traceback
        return f"[ERROR] Interpretation failed due to an unexpected error: {e}. Ensure Ollama is running, the model '{llm_model}' is available, and the vector store '{store_dir}' is valid."


# ---------------------------------------------------------------------------
# Gradio helper & CLI (Unchanged, but uses revised interpreter)
# ---------------------------------------------------------------------------


def make_interpret_ui(gr, Blocks):
    """Creates Gradio UI elements for the interpretation feature."""
    logging.info("Setting up Gradio UI components for RAG interpretation...")
    # Use gr.State to hold the JSON data between generation and interpretation
    kundali_state = gr.State({})
    # Use gr.Markdown to display the interpretation result
    md_output = gr.Markdown(
        "*(Interpretation will appear here after clicking the button)*"
    )
    # Button to trigger the interpretation
    interpret_button = gr.Button("Interpret Chart (RAG)")

    # Define the button's click action
    def gradio_interpret_action(kundali_data_dict):
        if not kundali_data_dict:
            logging.warning(
                "Gradio: Interpretation requested but no Kundali data found in state."
            )
            return "*(Please generate a chart first to enable interpretation)*"
        logging.info("Gradio: Interpretation requested.")
        # Call the main interpretation logic
        # Pass the dictionary directly; interpret_kundali handles conversion/validation
        interpretation_result = interpret_kundali(kundali_data_dict)
        logging.info("Gradio: Interpretation received.")
        return interpretation_result  # Return result to be displayed in md_output

    # Connect the button click to the action function
    interpret_button.click(
        fn=gradio_interpret_action,
        inputs=[kundali_state],  # Pass the Kundali data from the state
        outputs=[md_output],  # Display the result in the Markdown component
    )

    # Return the components needed by the main Gradio app
    # The main app will need to:
    # 1. Store the generated Kundali JSON *dictionary* into `kundali_state`
    # 2. Include `interpret_button` and `md_output` in the layout
    return kundali_state, interpret_button, md_output


# --- Main execution block for CLI ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Kundali RAG: Build KB vector store or Interpret Kundali JSON.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,  # Show defaults in help
    )
    parser.add_argument(
        "--build-kb",
        metavar="KB_FILE",
        help="Path to the knowledge base file (Markdown, TXT) to build/rebuild the vector store.",
    )
    parser.add_argument(
        "--interpret",
        metavar="JSON_FILE",
        help="Path to the Kundali JSON file to interpret using RAG.",
    )
    parser.add_argument(
        "--store-dir",
        default=str(_STORE_DIR),  # Pass default as string
        help="Directory for the Chroma vector store.",
    )
    parser.add_argument(
        "--embed-model",
        default=_EMBED_MODEL,
        help="Ollama embedding model name (must be pulled in Ollama).",
    )
    parser.add_argument(
        "--llm-model",
        default=_LLM_MODEL,
        help="Ollama LLM model name for interpretation (must be pulled in Ollama).",
    )
    parser.add_argument(
        "-k",
        "--retriever-k",
        type=int,
        default=_RETRIEVER_K,
        help="Number of relevant documents to retrieve from the vector store.",
    )
    parser.add_argument(
        "--ollama-url",
        default=None,
        help="Optional: Base URL for Ollama service if not default (http://localhost:11434).",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.7,
        help="Temperature setting for the LLM interpretation (controls creativity).",
    )
    parser.add_argument(
        "--debug", action="store_true", help="Enable DEBUG level logging."
    )

    args = parser.parse_args()

    # Set logging level based on debug flag
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logging.debug("DEBUG logging enabled.")

    store_path = Path(args.store_dir)  # Convert store path string to Path object

    if args.build_kb:
        logging.info("--- Building Knowledge Base Vector Store ---")
        _build_vector_store(
            args.build_kb, store_dir=store_path, embed_model=args.embed_model
        )
        logging.info("--------------------------------------------")
    elif args.interpret:
        logging.info("--- Interpreting Kundali Chart ---")
        try:
            json_path = Path(args.interpret)
            logging.info(f"Loading Kundali data from: {json_path}")
            data_str = json_path.read_text(encoding="utf-8")
            # Basic validation before passing to interpreter
            try:
                json.loads(data_str)
            except json.JSONDecodeError as json_err:
                logging.error(f"Invalid JSON format in file: {json_path} - {json_err}")
                sys.exit(1)

            interpretation = interpret_kundali(
                data_str,  # Pass the raw JSON string
                store_dir=store_path,
                embed_model=args.embed_model,
                llm_model=args.llm_model,
                k=args.retriever_k,
                ollama_base_url=args.ollama_url,
                llm_temperature=args.temperature,
            )
            print("\n--- Interpretation ---")
            print(interpretation)
            print("----------------------")
        except FileNotFoundError:
            logging.error(f"Interpretation file not found: {args.interpret}")
        except Exception as e:
            logging.error(
                f"An unexpected error occurred during interpretation: {e}",
                exc_info=True,
            )
    else:
        print("No action specified. Use --build-kb KB_FILE or --interpret JSON_FILE.")
        print("Example build: python kundali_rag.py --build-kb knowledgebase.json")
        print(
            "Example interpret: python kundali_rag.py --interpret sample.json --llm-model gemma2:9b"
        )
        parser.print_help()
