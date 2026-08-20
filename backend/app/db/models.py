"""SQLAlchemy models matching PRD §8."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    tools: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array
    output_format: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)

    contracts: Mapped[list[Contract]] = relationship(back_populates="vendor")


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    renewal_date: Mapped[date] = mapped_column(Date, nullable=False)
    terms_summary: Mapped[str] = mapped_column(Text, nullable=False)

    vendor: Mapped[Vendor] = relationship(back_populates="contracts")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipe_id: Mapped[str] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    trace_json: Mapped[str] = mapped_column(Text, nullable=False)
    output_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class GoldenSet(Base):
    __tablename__ = "golden_set"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipe_id: Mapped[str] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    rubric: Mapped[str] = mapped_column(Text, nullable=False)
    expected_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False)  # hand_written | correction


class EvalScore(Base):
    __tablename__ = "eval_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    golden_set_id: Mapped[int] = mapped_column(ForeignKey("golden_set.id"), nullable=False)
    run_id: Mapped[int] = mapped_column(ForeignKey("agent_runs.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    metric_breakdown: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
