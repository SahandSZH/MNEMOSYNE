"""Initial backend baseline with session and clock drawing tables.

Revision ID: 20260307_0001
Revises:
Create Date: 2026-03-07 15:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260307_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "patients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_patients_id", "patients", ["id"], unique=False)
    op.create_index("ix_patients_doctor_id", "patients", ["doctor_id"], unique=False)

    op.create_table(
        "assessments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("recall_score", sa.Integer(), nullable=False),
        sa.Column("drawing_score", sa.Integer(), nullable=False),
        sa.Column("fluency_score", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assessments_id", "assessments", ["id"], unique=False)
    op.create_index("ix_assessments_patient_id", "assessments", ["patient_id"], unique=False)

    op.create_table(
        "assessment_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_index("ix_assessment_sessions_id", "assessment_sessions", ["id"], unique=False)
    op.create_index(
        "ix_assessment_sessions_assessment_id",
        "assessment_sessions",
        ["assessment_id"],
        unique=False,
    )
    op.create_index(
        "ix_assessment_sessions_session_id",
        "assessment_sessions",
        ["session_id"],
        unique=False,
    )

    op.create_table(
        "clock_drawing_submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("image_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("analyzed_score", sa.Integer(), nullable=True),
        sa.Column("analysis_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id"),
    )
    op.create_index(
        "ix_clock_drawing_submissions_id",
        "clock_drawing_submissions",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_clock_drawing_submissions_assessment_id",
        "clock_drawing_submissions",
        ["assessment_id"],
        unique=False,
    )

    op.create_table(
        "speech_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("speech_rate", sa.Float(), nullable=False),
        sa.Column(
            "vocabulary_diversity",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id"),
    )
    op.create_index("ix_speech_metrics_id", "speech_metrics", ["id"], unique=False)
    op.create_index(
        "ix_speech_metrics_assessment_id",
        "speech_metrics",
        ["assessment_id"],
        unique=False,
    )

    op.create_table(
        "facial_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("face_presence_score", sa.Float(), nullable=False),
        sa.Column("blink_rate", sa.Integer(), nullable=False),
        sa.Column("eye_focus_score", sa.Float(), nullable=False),
        sa.Column("expression_variability", sa.Float(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id"),
    )
    op.create_index("ix_facial_metrics_id", "facial_metrics", ["id"], unique=False)
    op.create_index(
        "ix_facial_metrics_assessment_id",
        "facial_metrics",
        ["assessment_id"],
        unique=False,
    )

    op.create_table(
        "ai_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("risk_level", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id"),
    )
    op.create_index("ix_ai_reports_id", "ai_reports", ["id"], unique=False)
    op.create_index("ix_ai_reports_assessment_id", "ai_reports", ["assessment_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_reports_assessment_id", table_name="ai_reports")
    op.drop_index("ix_ai_reports_id", table_name="ai_reports")
    op.drop_table("ai_reports")

    op.drop_index("ix_facial_metrics_assessment_id", table_name="facial_metrics")
    op.drop_index("ix_facial_metrics_id", table_name="facial_metrics")
    op.drop_table("facial_metrics")

    op.drop_index("ix_speech_metrics_assessment_id", table_name="speech_metrics")
    op.drop_index("ix_speech_metrics_id", table_name="speech_metrics")
    op.drop_table("speech_metrics")

    op.drop_index(
        "ix_clock_drawing_submissions_assessment_id",
        table_name="clock_drawing_submissions",
    )
    op.drop_index("ix_clock_drawing_submissions_id", table_name="clock_drawing_submissions")
    op.drop_table("clock_drawing_submissions")

    op.drop_index("ix_assessment_sessions_session_id", table_name="assessment_sessions")
    op.drop_index("ix_assessment_sessions_assessment_id", table_name="assessment_sessions")
    op.drop_index("ix_assessment_sessions_id", table_name="assessment_sessions")
    op.drop_table("assessment_sessions")

    op.drop_index("ix_assessments_patient_id", table_name="assessments")
    op.drop_index("ix_assessments_id", table_name="assessments")
    op.drop_table("assessments")

    op.drop_index("ix_patients_doctor_id", table_name="patients")
    op.drop_index("ix_patients_id", table_name="patients")
    op.drop_table("patients")
