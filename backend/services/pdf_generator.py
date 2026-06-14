"""
pdf_generator.py — ReportLab authority report for P4/P5 incidents.

Generates a structured PDF containing:
  - Incident summary header
  - AI agent findings (all 5 agents)
  - Recommended actions
  - Approval chain

Returns the PDF as bytes so routes can stream it directly.
"""

import io
import logging
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

from models.incident_model import Incident

logger = logging.getLogger(__name__)

# ── Colours ─────────────────────────────────────────────────────────── #
RAILWAY_RED    = colors.HexColor("#dc2626")
RAILWAY_ORANGE = colors.HexColor("#ea580c")
RAILWAY_BLUE   = colors.HexColor("#1e40af")
RAILWAY_DARK   = colors.HexColor("#111827")
RAILWAY_LIGHT  = colors.HexColor("#f3f4f6")

PRIORITY_COLORS = {
    1: colors.HexColor("#16a34a"),   # green
    2: colors.HexColor("#65a30d"),   # lime
    3: colors.HexColor("#d97706"),   # amber
    4: colors.HexColor("#ea580c"),   # orange
    5: colors.HexColor("#dc2626"),   # red
}

PRIORITY_LABELS = {1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "VERY HIGH", 5: "CRITICAL"}


def _no_reportlab_fallback(incident: Incident) -> bytes:
    """Plain-text PDF-like bytes when ReportLab is not installed."""
    text = (
        f"RailSentinel Incident Report\n"
        f"{'='*50}\n"
        f"Incident ID   : {incident.id}\n"
        f"Train         : {incident.train_name} ({incident.train_id})\n"
        f"Priority      : P{incident.priority} — {incident.priority_label}\n"
        f"Anomaly       : {incident.anomaly_type}\n"
        f"Status        : {incident.status}\n"
        f"Created At    : {incident.created_at}\n\n"
        f"AI Recommendation:\n{incident.ai_recommendation}\n\n"
        f"Hindi Alert:\n{incident.hindi_alert}\n\n"
        f"Action Summary:\n{incident.action_summary}\n"
    )
    return text.encode("utf-8")


def generate_incident_pdf(incident: Incident) -> bytes:
    """
    Generate a full authority report PDF for an incident.
    Returns raw PDF bytes.
    Falls back to plain text if ReportLab is not installed.
    """
    if not REPORTLAB_AVAILABLE:
        logger.warning("[PDF] ReportLab not installed — returning plain text.")
        return _no_reportlab_fallback(incident)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # ── Header ──────────────────────────────────────────────────── #
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=RAILWAY_RED,
        spaceAfter=4,
    )
    sub_style = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.grey,
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        spaceAfter=6,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=2,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=RAILWAY_BLUE,
        spaceBefore=14,
        spaceAfter=6,
    )

    elements.append(Paragraph("🚆 RailSentinel — Authority Incident Report", title_style))
    elements.append(Paragraph(
        f"Indian Railways · Generated: {datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}",
        sub_style,
    ))
    elements.append(HRFlowable(width="100%", thickness=2, color=RAILWAY_RED))
    elements.append(Spacer(1, 0.4 * cm))

    # ── Priority Badge Table ─────────────────────────────────────── #
    priority_color = PRIORITY_COLORS.get(incident.priority, colors.grey)
    priority_label = PRIORITY_LABELS.get(incident.priority, "UNKNOWN")

    summary_data = [
        ["Incident ID",  f"#{incident.id}",
         "Priority",     f"P{incident.priority} — {priority_label}"],
        ["Train",        f"{incident.train_name or ''} ({incident.train_id})",
         "Status",       incident.status.upper()],
        ["Anomaly Type", incident.anomaly_type or "N/A",
         "Confidence",   f"{incident.confidence_percent or 'N/A'}%"],
        ["Near Station", incident.near_station or "N/A",
         "Created At",   str(incident.created_at)[:19]],
    ]

    summary_table = Table(summary_data, colWidths=[3.5*cm, 5.5*cm, 3.5*cm, 5.5*cm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (0, -1), RAILWAY_LIGHT),
        ("BACKGROUND",   (2, 0), (2, -1), RAILWAY_LIGHT),
        ("TEXTCOLOR",    (0, 0), (-1, -1), RAILWAY_DARK),
        ("FONTSIZE",     (0, 0), (-1, -1), 9),
        ("GRID",         (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        # Highlight priority cell
        ("BACKGROUND",   (3, 0), (3, 0), priority_color),
        ("TEXTCOLOR",    (3, 0), (3, 0), colors.white),
        ("FONTNAME",     (3, 0), (3, 0), "Helvetica-Bold"),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.4 * cm))

    # ── Description ─────────────────────────────────────────────── #
    if incident.description:
        elements.append(Paragraph("Anomaly Description", section_style))
        elements.append(Paragraph(incident.description, body_style))

    # ── AI Recommendation ────────────────────────────────────────── #
    if incident.ai_recommendation:
        elements.append(Paragraph("AI Recommendation", section_style))
        elements.append(Paragraph(incident.ai_recommendation, body_style))

    # ── Immediate Actions ────────────────────────────────────────── #
    if incident.action_summary:
        elements.append(Paragraph("Immediate Actions Required", section_style))
        elements.append(Paragraph(incident.action_summary, body_style))

    # ── Hindi Alert ──────────────────────────────────────────────── #
    if incident.hindi_alert:
        elements.append(Paragraph("Hindi Voice Alert (हिन्दी)", section_style))
        # ReportLab handles Unicode but needs a Unicode-capable font in production
        elements.append(Paragraph(incident.hindi_alert, body_style))

    # ── SMS Messages ─────────────────────────────────────────────── #
    elements.append(Paragraph("Dispatched SMS Alerts", section_style))
    sms_data = [
        ["Recipient",       "Message"],
        ["Station Master",  incident.sms_station_master or "—"],
        ["DRM",             incident.sms_drm or "—"],
        ["Loco Pilot",      incident.loco_pilot_message or "—"],
    ]
    sms_table = Table(sms_data, colWidths=[4*cm, 14*cm])
    sms_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), RAILWAY_BLUE),
        ("TEXTCOLOR",    (0, 0), (-1, 0), colors.white),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, -1), 8),
        ("GRID",         (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("WORDWRAP",     (0, 0), (-1, -1), True),
    ]))
    elements.append(sms_table)
    elements.append(Spacer(1, 0.6 * cm))

    # ── Footer ───────────────────────────────────────────────────── #
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
    elements.append(Paragraph(
        "This report is auto-generated by RailSentinel AI. "
        "Requires official approval before action. © FAR AWAY 2026",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
