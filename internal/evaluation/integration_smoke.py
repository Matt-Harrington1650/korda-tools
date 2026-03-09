#!/usr/bin/env python3
"""In-process KORDA-RAG smoke run without starting HTTP listeners."""

from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from typing import Any

KORDA_RAG_SRC = r"C:\code\KORDA-RAG\src"
if KORDA_RAG_SRC not in sys.path:
    sys.path.insert(0, KORDA_RAG_SRC)

from nvidia_rag.ingestor_server.main import Mode, NvidiaRAGIngestor
from nvidia_rag.rag_server.main import NvidiaRAG
from nvidia_rag.utils.vdb.vdb_base import VDBRag


def listening_ports_snapshot() -> set[int]:
    """Collect local listening TCP ports for before/after comparison."""
    output = subprocess.check_output(
        ["netstat", "-ano"],
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    ports: set[int] = set()
    for line in output.splitlines():
        if "LISTENING" not in line:
            continue
        parts = line.split()
        if len(parts) < 4:
            continue
        local = parts[1]
        if ":" not in local:
            continue
        port = local.rsplit(":", 1)[-1]
        if port.isdigit():
            ports.add(int(port))
    return ports


class SmokeVDB(VDBRag):
    """Minimal in-memory VDB implementation for no-server library smoke."""

    def __init__(self) -> None:
        self._collection_name = "smoke_collection"

    @property
    def collection_name(self) -> str:
        return self._collection_name

    async def check_health(self) -> dict[str, Any]:
        return {"status": "healthy"}

    def create_collection(
        self,
        collection_name: str,
        dimension: int = 2048,
        collection_type: str = "text",
    ) -> None:
        self._collection_name = collection_name

    def check_collection_exists(self, collection_name: str) -> bool:
        return True

    def get_collection(self) -> list[dict[str, Any]]:
        return [{"name": self._collection_name}]

    def delete_collections(self, collection_names: list[str]) -> None:
        return None

    def get_documents(self, collection_name: str) -> list[dict[str, Any]]:
        return []

    def delete_documents(
        self,
        collection_name: str,
        source_values: list[str],
        result_dict: dict[str, list[str]] | None = None,
    ) -> bool:
        return True

    def create_metadata_schema_collection(self) -> None:
        return None

    def add_metadata_schema(
        self, collection_name: str, metadata_schema: list[dict[str, Any]]
    ) -> None:
        return None

    def get_metadata_schema(self, collection_name: str) -> list[dict[str, Any]]:
        return []

    def get_catalog_metadata(self, collection_name: str) -> dict[str, Any]:
        return {}

    def update_catalog_metadata(
        self, collection_name: str, updates: dict[str, Any]
    ) -> None:
        return None

    def get_document_catalog_metadata(
        self, collection_name: str, document_name: str
    ) -> dict[str, Any]:
        return {}

    def update_document_catalog_metadata(
        self, collection_name: str, document_name: str, updates: dict[str, Any]
    ) -> None:
        return None

    def get_langchain_vectorstore(self, collection_name: str):
        return None

    def retrieval_langchain(
        self,
        query: str,
        collection_name: str,
        top_k: int = 10,
        filter_expr: str | list[dict[str, Any]] = "",
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        return []

    def retrieval_image_langchain(
        self,
        query: str,
        collection_name: str,
        vectorstore: Any = None,
        top_k: int = 10,
        reranker_top_k: int = 10,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        return []


async def run_smoke() -> dict[str, Any]:
    before_ports = listening_ports_snapshot()
    vdb = SmokeVDB()

    rag = NvidiaRAG(vdb_op=vdb)
    rag_health = await rag.health(check_dependencies=False)

    search_status = "ok"
    search_error = None
    citations_count = 0
    try:
        citations = await rag.search(
            query="smoke query",
            collection_names=[vdb.collection_name],
            enable_query_rewriting=False,
            enable_reranker=False,
            enable_filter_generator=False,
            vdb_top_k=1,
            reranker_top_k=1,
            enable_citations=True,
        )
        citations_count = len(getattr(citations, "citations", []) or [])
    except Exception as exc:  # pragma: no cover - evidence path
        search_status = "error"
        search_error = str(exc)
        citations_count = -1

    ingestor = NvidiaRAGIngestor(vdb_op=vdb, mode=Mode.LIBRARY)
    ingestor_health = await ingestor.health(check_dependencies=False)

    ingest_status = "ok"
    ingest_error = None
    ingest_response: dict[str, Any] | None = None
    try:
        ingest_response = await ingestor.upload_documents(filepaths=[], blocking=True)
    except Exception as exc:  # pragma: no cover - evidence path
        ingest_status = "error"
        ingest_error = str(exc)

    after_ports = listening_ports_snapshot()

    return {
        "before_port_count": len(before_ports),
        "after_port_count": len(after_ports),
        "new_listening_ports": sorted(after_ports - before_ports),
        "rag_health": str(rag_health),
        "search_status": search_status,
        "search_error": search_error,
        "search_citations_count": citations_count,
        "ingestor_health": str(ingestor_health),
        "ingest_status": ingest_status,
        "ingest_error": ingest_error,
        "ingest_response": ingest_response,
    }


if __name__ == "__main__":
    result = asyncio.run(run_smoke())
    print(json.dumps(result, indent=2, default=str))
