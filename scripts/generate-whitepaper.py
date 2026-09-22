#!/usr/bin/env python3
"""Generate the MORPH technical white paper as a polished, offline PDF."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


NAVY = colors.HexColor("#181B58")
BLUE = colors.HexColor("#1863DC")
GREEN = colors.HexColor("#61CE70")
CORAL = colors.HexColor("#F36161")
INK = colors.HexColor("#14183A")
MUTED = colors.HexColor("#59617B")
PAPER = colors.HexColor("#FAFBFE")
ALT = colors.HexColor("#F0F2F8")
LINE = colors.HexColor("#DDE3F2")
WHITE = colors.white


def register_fonts() -> tuple[str, str, str]:
    """Use bundled system fonts when present, with built-in fallbacks."""
    candidates = [
        (
            Path("C:/Windows/Fonts/aptos.ttf"),
            Path("C:/Windows/Fonts/aptosbd.ttf"),
            Path("C:/Windows/Fonts/aptosmono.ttf"),
        ),
        (
            Path("C:/Windows/Fonts/segoeui.ttf"),
            Path("C:/Windows/Fonts/segoeuib.ttf"),
            Path("C:/Windows/Fonts/consola.ttf"),
        ),
    ]
    for regular, bold, mono in candidates:
        if regular.exists() and bold.exists() and mono.exists():
            pdfmetrics.registerFont(TTFont("MorphSans", str(regular)))
            pdfmetrics.registerFont(TTFont("MorphSansBold", str(bold)))
            pdfmetrics.registerFont(TTFont("MorphMono", str(mono)))
            return "MorphSans", "MorphSansBold", "MorphMono"
    return "Helvetica", "Helvetica-Bold", "Courier"


BODY_FONT, BOLD_FONT, MONO_FONT = register_fonts()


class NumberedCanvasMixin:
    pass


class WhitePaperDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, **kwargs):
        super().__init__(filename, **kwargs)
        self._section_index = 0

    def beforeDocument(self) -> None:
        self._section_index = 0

    def afterFlowable(self, flowable: Flowable) -> None:
        if not isinstance(flowable, Paragraph):
            return
        style_name = flowable.style.name
        if style_name not in {"Heading1", "Heading2"}:
            return
        level = 0 if style_name == "Heading1" else 1
        text = flowable.getPlainText()
        key = f"section-{self._section_index}"
        self._section_index += 1
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=False)
        self.notify("TOCEntry", (level, text, self.page, key))


def draw_brand_ribbon(canvas, width: float, y: float, height: float) -> None:
    segments = (
        (NAVY, 0.00, 0.27),
        (BLUE, 0.27, 0.57),
        (GREEN, 0.57, 0.80),
        (CORAL, 0.80, 1.00),
    )
    for color, start, end in segments:
        canvas.setFillColor(color)
        canvas.rect(start * width, y, (end - start) * width + 1, height, stroke=0, fill=1)


def draw_cover(canvas, doc: BaseDocTemplate, logo_path: Path | None) -> None:
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)

    canvas.setFillColor(colors.HexColor("#E8EDFF"))
    canvas.circle(width * 0.83, height * 0.88, 150, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#DDF9F0"))
    canvas.circle(width * 0.92, height * 0.72, 105, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#FFE8E3"))
    canvas.circle(width * 0.10, height * 0.07, 120, stroke=0, fill=1)
    draw_brand_ribbon(canvas, width, height - 16, 16)

    if logo_path and logo_path.exists():
        try:
            image = Image(str(logo_path), width=1.42 * inch, height=1.42 * inch, kind="proportional")
            image.drawOn(canvas, 0.70 * inch, height - 2.13 * inch)
        except Exception:
            pass

    canvas.setFillColor(NAVY)
    canvas.setFont(BOLD_FONT, 17)
    canvas.drawString(0.75 * inch, height - 2.48 * inch, "MORPH")
    canvas.setFont(BODY_FONT, 9.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.75 * inch, height - 2.73 * inch, "MODEL OPTIMIZED REPRESENTATION FOR PROMPT HANDOFFS")

    canvas.setFillColor(INK)
    canvas.setFont(BOLD_FONT, 29)
    canvas.drawString(0.75 * inch, height - 3.65 * inch, "A lossless representation")
    canvas.drawString(0.75 * inch, height - 4.08 * inch, "compiler for model context")

    canvas.setFont(BODY_FONT, 13)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.76 * inch, height - 4.64 * inch, "Design, implementation, and offline evaluation")
    canvas.drawString(0.76 * inch, height - 4.90 * inch, "of reversible prompt layout selection")

    badge_y = height - 5.65 * inch
    badges = (
        ("Lossless", NAVY, 0.75),
        ("Tokenizer measured", BLUE, 1.83),
        ("Offline first", GREEN, 3.72),
        ("Evidence gated", CORAL, 4.93),
    )
    for label, color, x in badges:
        label_width = canvas.stringWidth(label, BOLD_FONT, 8.8) + 22
        canvas.setFillColor(color)
        canvas.roundRect(x * inch, badge_y, label_width, 22, 11, stroke=0, fill=1)
        canvas.setFillColor(WHITE if color != GREEN else NAVY)
        canvas.setFont(BOLD_FONT, 8.8)
        canvas.drawCentredString(x * inch + label_width / 2, badge_y + 7, label)

    canvas.setFillColor(INK)
    canvas.setFont(BOLD_FONT, 10)
    canvas.drawString(0.75 * inch, 1.18 * inch, "Engineering white paper")
    canvas.setFont(BODY_FONT, 9.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.75 * inch, 0.93 * inch, "Specification version 0.1.0")
    canvas.drawString(0.75 * inch, 0.72 * inch, "Prepared September 22, 2026")
    canvas.drawRightString(width - 0.75 * inch, 0.72 * inch, "Measured local release evidence")
    canvas.restoreState()


def draw_content_page(canvas, doc: BaseDocTemplate) -> None:
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    draw_brand_ribbon(canvas, width, height - 6, 6)
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, height - 0.53 * inch, width - doc.rightMargin, height - 0.53 * inch)
    canvas.setFillColor(NAVY)
    canvas.setFont(BOLD_FONT, 8.4)
    canvas.drawString(doc.leftMargin, height - 0.39 * inch, "MORPH WHITE PAPER")
    canvas.setFillColor(MUTED)
    canvas.setFont(BODY_FONT, 8.2)
    canvas.drawRightString(width - doc.rightMargin, height - 0.39 * inch, "morph-artifact/1  |  morph-context/1")
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, 0.55 * inch, width - doc.rightMargin, 0.55 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont(BODY_FONT, 8.2)
    canvas.drawString(doc.leftMargin, 0.33 * inch, "Preservation, token measurement, and model quality are separate claims")
    canvas.drawRightString(width - doc.rightMargin, 0.33 * inch, str(doc.page))
    canvas.restoreState()


def make_styles():
    sample = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "Title",
            parent=sample["Title"],
            fontName=BOLD_FONT,
            fontSize=24,
            leading=29,
            textColor=NAVY,
            alignment=TA_LEFT,
            spaceAfter=12,
        ),
        "Subtitle": ParagraphStyle(
            "Subtitle",
            parent=sample["Normal"],
            fontName=BODY_FONT,
            fontSize=12,
            leading=17,
            textColor=MUTED,
            spaceAfter=16,
        ),
        "Heading1": ParagraphStyle(
            "Heading1",
            parent=sample["Heading1"],
            fontName=BOLD_FONT,
            fontSize=17,
            leading=21,
            textColor=NAVY,
            spaceBefore=14,
            spaceAfter=8,
            keepWithNext=True,
        ),
        "Heading2": ParagraphStyle(
            "Heading2",
            parent=sample["Heading2"],
            fontName=BOLD_FONT,
            fontSize=12.5,
            leading=16,
            textColor=BLUE,
            spaceBefore=11,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "Heading3": ParagraphStyle(
            "Heading3",
            parent=sample["Heading3"],
            fontName=BOLD_FONT,
            fontSize=10.5,
            leading=13.5,
            textColor=INK,
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName=BODY_FONT,
            fontSize=9.4,
            leading=13.6,
            textColor=INK,
            spaceAfter=7,
            allowWidows=0,
            allowOrphans=0,
        ),
        "Small": ParagraphStyle(
            "Small",
            parent=sample["BodyText"],
            fontName=BODY_FONT,
            fontSize=8.2,
            leading=11.3,
            textColor=MUTED,
            spaceAfter=5,
        ),
        "Bullet": ParagraphStyle(
            "Bullet",
            parent=sample["BodyText"],
            fontName=BODY_FONT,
            fontSize=9.2,
            leading=13.2,
            textColor=INK,
            leftIndent=2,
        ),
        "Code": ParagraphStyle(
            "Code",
            parent=sample["Code"],
            fontName=MONO_FONT,
            fontSize=7.4,
            leading=10.3,
            textColor=colors.HexColor("#E8EDFF"),
            backColor=colors.HexColor("#0D1030"),
            borderPadding=(8, 9, 8, 9),
            borderRadius=7,
            spaceBefore=4,
            spaceAfter=8,
        ),
        "Quote": ParagraphStyle(
            "Quote",
            parent=sample["BodyText"],
            fontName=BODY_FONT,
            fontSize=10,
            leading=14,
            textColor=NAVY,
            leftIndent=12,
            rightIndent=6,
            borderColor=CORAL,
            borderWidth=0,
            borderLeftWidth=3,
            borderPadding=9,
            backColor=colors.HexColor("#FFF3F0"),
            spaceAfter=9,
        ),
        "TableHeader": ParagraphStyle(
            "TableHeader",
            parent=sample["Normal"],
            fontName=BOLD_FONT,
            fontSize=7.6,
            leading=9.6,
            textColor=WHITE,
        ),
        "TableCell": ParagraphStyle(
            "TableCell",
            parent=sample["Normal"],
            fontName=BODY_FONT,
            fontSize=7.4,
            leading=9.5,
            textColor=INK,
        ),
        "TOCTitle": ParagraphStyle(
            "TOCTitle",
            parent=sample["Heading1"],
            fontName=BOLD_FONT,
            fontSize=20,
            leading=24,
            textColor=NAVY,
            spaceAfter=16,
        ),
    }


def inline_markup(text: str) -> str:
    escaped = html.escape(text.strip())
    escaped = re.sub(r"`([^`]+)`", r'<font name="%s" color="#1863DC">\1</font>' % MONO_FONT, escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<link href="\2" color="#1863DC">\1</link>', escaped)
    return escaped


def parse_table(lines: list[str], styles: dict[str, ParagraphStyle], available_width: float) -> Table:
    rows: list[list[Paragraph]] = []
    for index, line in enumerate(lines):
        if index == 1 and re.fullmatch(r"\|?\s*:?-+.*", line.strip()):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        style = styles["TableHeader"] if not rows else styles["TableCell"]
        rows.append([Paragraph(inline_markup(cell), style) for cell in cells])
    column_count = max(len(row) for row in rows)
    normalized = [row + [Paragraph("", styles["TableCell"])] * (column_count - len(row)) for row in rows]
    widths = [available_width / column_count] * column_count
    table = Table(normalized, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, ALT]),
            ]
        )
    )
    return table


def markdown_story(markdown: str, styles: dict[str, ParagraphStyle], available_width: float) -> list[Flowable]:
    lines = markdown.splitlines()
    story: list[Flowable] = []
    paragraph_lines: list[str] = []
    list_items: list[str] = []
    list_ordered = False
    code_lines: list[str] = []
    in_code = False
    first_h1_skipped = False
    subtitle_skipped = False

    def flush_paragraph() -> None:
        if paragraph_lines:
            text = " ".join(part.strip() for part in paragraph_lines)
            story.append(Paragraph(inline_markup(text), styles["Body"]))
            paragraph_lines.clear()

    def flush_list() -> None:
        nonlocal list_ordered
        if list_items:
            bullets = [ListItem(Paragraph(inline_markup(item), styles["Bullet"]), leftIndent=12) for item in list_items]
            list_kwargs = {
                "bulletType": "1" if list_ordered else "bullet",
                "leftIndent": 18,
                "bulletFontName": BOLD_FONT,
                "bulletFontSize": 7,
                "bulletColor": BLUE,
                "spaceAfter": 7,
            }
            if list_ordered:
                list_kwargs["start"] = "1"
            story.append(ListFlowable(bullets, **list_kwargs))
            list_items.clear()
            list_ordered = False

    index = 0
    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()
        if stripped.startswith("```"):
            flush_paragraph()
            flush_list()
            if in_code:
                code_text = "<br/>".join(html.escape(line).replace(" ", "&nbsp;") for line in code_lines)
                story.append(Paragraph(code_text or " ", styles["Code"]))
                code_lines.clear()
                in_code = False
            else:
                in_code = True
            index += 1
            continue
        if in_code:
            code_lines.append(raw)
            index += 1
            continue
        if stripped.startswith("|") and index + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-", lines[index + 1]):
            flush_paragraph()
            flush_list()
            table_lines = [raw, lines[index + 1]]
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index])
                index += 1
            story.append(parse_table(table_lines, styles, available_width))
            story.append(Spacer(1, 8))
            continue
        heading = re.match(r"^(#{1,3})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            flush_list()
            level = len(heading.group(1))
            heading_text = heading.group(2).strip()
            if level == 1 and not first_h1_skipped:
                first_h1_skipped = True
                index += 1
                continue
            if level == 2 and not subtitle_skipped:
                subtitle_skipped = True
                index += 1
                continue
            display_level = max(1, level - 1)
            style = styles[f"Heading{display_level}"]
            story.append(Paragraph(inline_markup(heading_text), style))
            index += 1
            continue
        unordered = re.match(r"^[-*]\s+(.+)$", stripped)
        ordered = re.match(r"^\d+[.)]\s+(.+)$", stripped)
        if unordered or ordered:
            flush_paragraph()
            is_ordered = ordered is not None
            if list_items and list_ordered != is_ordered:
                flush_list()
            list_ordered = is_ordered
            list_items.append((ordered or unordered).group(1))
            index += 1
            continue
        if stripped.startswith(">"):
            flush_paragraph()
            flush_list()
            story.append(Paragraph(inline_markup(stripped[1:].strip()), styles["Quote"]))
            index += 1
            continue
        if stripped in {"---", "***"}:
            flush_paragraph()
            flush_list()
            story.append(Spacer(1, 3))
            story.append(HRFlowable(width="100%", thickness=0.7, color=LINE, spaceBefore=3, spaceAfter=8))
            index += 1
            continue
        if not stripped:
            flush_paragraph()
            flush_list()
        else:
            paragraph_lines.append(stripped)
        index += 1
    flush_paragraph()
    flush_list()
    if code_lines:
        code_text = "<br/>".join(html.escape(line).replace(" ", "&nbsp;") for line in code_lines)
        story.append(Paragraph(code_text or " ", styles["Code"]))
    return story


def build_pdf(source: Path, output: Path, logo_path: Path | None) -> None:
    markdown = source.read_text(encoding="utf-8")
    if "\u2014" in markdown or "\u2013" in markdown:
        raise ValueError("White-paper source contains an em dash or en dash")
    output.parent.mkdir(parents=True, exist_ok=True)
    styles = make_styles()
    doc = WhitePaperDocTemplate(
        str(output),
        pagesize=letter,
        leftMargin=0.72 * inch,
        rightMargin=0.72 * inch,
        topMargin=0.70 * inch,
        bottomMargin=0.70 * inch,
        title="MORPH: A Lossless Representation Compiler for Model Context",
        author="MORPH project maintainers",
        subject="Engineering white paper for the MORPH local release",
        creator="MORPH local build",
    )
    content_frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="content",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    cover_frame = Frame(0, 0, letter[0], letter[1], id="cover", showBoundary=0)
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=lambda c, d: draw_cover(c, d, logo_path)),
            PageTemplate(id="content", frames=[content_frame], onPage=draw_content_page),
        ]
    )

    story: list[Flowable] = [
        Spacer(1, 9.6 * inch),
        NextPageTemplate("content"),
        PageBreak(),
        Paragraph("Contents", styles["TOCTitle"]),
    ]
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(
            "TOCLevel1",
            fontName=BOLD_FONT,
            fontSize=9.5,
            leading=15,
            leftIndent=0,
            firstLineIndent=0,
            textColor=NAVY,
            spaceBefore=3,
        ),
        ParagraphStyle(
            "TOCLevel2",
            fontName=BODY_FONT,
            fontSize=8.5,
            leading=12,
            leftIndent=16,
            firstLineIndent=0,
            textColor=MUTED,
        ),
    ]
    story.extend([toc, PageBreak()])
    story.extend(markdown_story(markdown, styles, doc.width))
    doc.multiBuild(story)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("docs/white-paper.md"))
    parser.add_argument("--output", type=Path, default=Path("output/pdf/MORPH_White_Paper_v0.1.pdf"))
    parser.add_argument("--logo", type=Path, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_pdf(args.source, args.output, args.logo)
    print(args.output.resolve())


if __name__ == "__main__":
    main()
