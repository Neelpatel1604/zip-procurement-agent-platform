"""Seed SQLite with recipes, vendors, contracts, and golden set cases."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.models import Contract, GoldenSet, Recipe, Vendor  # noqa: E402
from app.db.session import SessionLocal, init_db  # noqa: E402
from app.engine.recipes import list_recipes  # noqa: E402


VENDORS = [
    {"name": "Acme Corporation", "domain": "acme.com", "category": "Software"},
    {"name": "Acme Corp", "domain": "acme.com", "category": "Software"},
    {"name": "CloudSync Analytics", "domain": "cloudsync.io", "category": "Analytics"},
    {"name": "Cloud Sync Analytics Inc", "domain": "cloudsync.io", "category": "Analytics"},
    {"name": "DataPipe Systems", "domain": "datapipe.example", "category": "Data"},
    {"name": "BrightForge Labs", "domain": "brightforge.dev", "category": "Engineering"},
    {"name": "Northwind Software", "domain": "northwind.software", "category": "Software"},
    {"name": "RenewAll SaaS", "domain": "renewall.io", "category": "SaaS"},
    {"name": "Renew All Software", "domain": "renewall.io", "category": "SaaS"},
    {"name": "Zephyr Payroll", "domain": "zephyrpayroll.com", "category": "HR"},
    {"name": "Orbit Facilities", "domain": "orbitfacilities.com", "category": "Facilities"},
]

CONTRACTS = [
    {
        "vendor_name": "CloudSync Analytics",
        "file_path": "msa-cloudsync-risky.md",
        "effective_date": date(2024, 1, 15),
        "renewal_date": date(2026, 1, 15),
        "terms_summary": "Unlimited liability; customer-heavy indemnity; 120-day non-renewal notice.",
    },
    {
        "vendor_name": "DataPipe Systems",
        "file_path": "dpa-datapipe-weak.md",
        "effective_date": date(2024, 6, 1),
        "renewal_date": date(2026, 6, 1),
        "terms_summary": "Weak subprocessor controls; slow breach notice; limited audit rights.",
    },
    {
        "vendor_name": "BrightForge Labs",
        "file_path": "nda-brightforge.md",
        "effective_date": date(2025, 3, 1),
        "renewal_date": date(2028, 3, 1),
        "terms_summary": "Standard mutual NDA; low commercial risk.",
    },
    {
        "vendor_name": "Northwind Software",
        "file_path": "msa-northwind-clean.md",
        "effective_date": date(2024, 9, 1),
        "renewal_date": date(2025, 9, 1),
        "terms_summary": "Capped liability; balanced indemnity; 30-day non-renewal.",
    },
    {
        "vendor_name": "RenewAll SaaS",
        "file_path": "msa-renewall-autorenew.md",
        "effective_date": date(2023, 5, 1),
        "renewal_date": date(2026, 5, 1),
        "terms_summary": "36-month auto-renewal; 180-day notice; no convenience termination in initial term.",
    },
    {
        "vendor_name": "Acme Corporation",
        "file_path": "msa-acme-standard.md",
        "effective_date": date(2024, 2, 1),
        "renewal_date": date(2026, 2, 1),
        "terms_summary": "Medium risk MSA; notes Acme Corp alias on acme.com.",
    },
]

GOLDEN = [
    {
        "recipe_id": "duplicate_vendor_check",
        "input_text": "New vendor request: name='Acme Corp LLC', domain='acme.com'. Should we onboard?",
        "rubric": "Must detect existing Acme entities on acme.com and recommend block.",
        "expected_answer": "block",
        "source": "hand_written",
    },
    {
        "recipe_id": "duplicate_vendor_check",
        "input_text": "Onboard vendor: name='Cloud Sync', domain='cloudsync.io'.",
        "rubric": "Must find CloudSync Analytics on same domain and recommend block or merge_review; prefer block if name is clearly similar.",
        "expected_answer": "block",
        "source": "hand_written",
    },
    {
        "recipe_id": "duplicate_vendor_check",
        "input_text": "Onboard vendor: name='Pinecone Robotics', domain='pinecone-robots.test'.",
        "rubric": "No matching vendor; recommend allow.",
        "expected_answer": "allow",
        "source": "hand_written",
    },
    {
        "recipe_id": "duplicate_vendor_check",
        "input_text": "Vendor name='Zephyr Payroll Services' domain='otherpayroll.test' — check duplicates by name similarity only.",
        "rubric": "Similar name to Zephyr Payroll but different domain → merge_review.",
        "expected_answer": "merge_review",
        "source": "hand_written",
    },
    {
        "recipe_id": "msa_risk_review",
        "input_text": "Review MSA risk for CloudSync Analytics, especially liability and auto-renewal.",
        "rubric": (
            "Grade 1-5 on grounding, risk coverage (liability/indemnity/renewal), severity calibration, "
            "actionability, and consistency with retrieved trace. Overall score 0-1."
        ),
        "expected_answer": None,
        "source": "hand_written",
    },
    {
        "recipe_id": "msa_risk_review",
        "input_text": "Assess privacy/DPA risks for DataPipe Systems subprocessors and breach notification.",
        "rubric": (
            "Must surface weak subprocessor objection rights and breach notice vagueness if present in retrieval. "
            "Penalize hallucinated clauses. Score grounding and actionability heavily."
        ),
        "expected_answer": None,
        "source": "hand_written",
    },
    {
        "recipe_id": "msa_risk_review",
        "input_text": "Is the Northwind Software MSA generally low risk? Summarize remaining concerns.",
        "rubric": (
            "Should recognize capped liability and balanced terms as lower risk while still noting any residual items. "
            "Ground claims in retrieved text."
        ),
        "expected_answer": None,
        "source": "hand_written",
    },
]


def seed() -> None:
    init_db()
    session = SessionLocal()
    try:
        # Recipes from JSON files
        session.query(Recipe).delete()
        for r in list_recipes():
            session.add(
                Recipe(
                    id=r["id"],
                    name=r["name"],
                    model=r["model"],
                    tools=json.dumps(r["tools"]),
                    output_format=r["output_format"],
                    system_prompt=r["system_prompt"],
                )
            )

        session.query(Contract).delete()
        session.query(Vendor).delete()
        session.commit()

        name_to_id: dict[str, int] = {}
        for v in VENDORS:
            row = Vendor(**v)
            session.add(row)
            session.flush()
            name_to_id[v["name"]] = row.id

        for c in CONTRACTS:
            session.add(
                Contract(
                    vendor_id=name_to_id[c["vendor_name"]],
                    file_path=c["file_path"],
                    effective_date=c["effective_date"],
                    renewal_date=c["renewal_date"],
                    terms_summary=c["terms_summary"],
                )
            )

        # Keep correction-sourced rows if re-seeding? For demo freshness, reset all golden.
        session.query(GoldenSet).delete()
        for g in GOLDEN:
            session.add(GoldenSet(**g))

        session.commit()
        print(f"Seeded {len(VENDORS)} vendors, {len(CONTRACTS)} contracts, {len(GOLDEN)} golden cases, {len(list_recipes())} recipes.")
    finally:
        session.close()


if __name__ == "__main__":
    seed()
