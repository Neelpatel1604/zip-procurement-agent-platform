from app.db.session import SessionLocal, init_db
from app.tools.registry import make_api_data_tool


def test_api_data_rejects_writes():
    init_db()
    session = SessionLocal()
    try:
        tool = make_api_data_tool(session)
        out = tool["handler"](sql="DELETE FROM vendors")
        assert "error" in out.lower() or '"error"' in out
    finally:
        session.close()


def test_api_data_selects_vendors():
    init_db()
    session = SessionLocal()
    try:
        tool = make_api_data_tool(session)
        out = tool["handler"](sql="SELECT id, name, domain FROM vendors LIMIT 3")
        assert "rows" in out
    finally:
        session.close()
