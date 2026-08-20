import json

from app.engine.recipes import load_recipe


def test_load_duplicate_recipe():
    r = load_recipe("duplicate_vendor_check")
    assert r["id"] == "duplicate_vendor_check"
    assert "api_data" in r["tools"]


def test_load_msa_recipe():
    r = load_recipe("msa_risk_review")
    assert "document_retrieval" in r["tools"]


def test_deterministic_extract():
    from app.eval.harness import deterministic_score

    score, _, breakdown = deterministic_score(
        "block",
        '{"recommendation": "block", "matched_vendors": []}',
    )
    assert score == 1.0
    assert breakdown["got"] == "block"
