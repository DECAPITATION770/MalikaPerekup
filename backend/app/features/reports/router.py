"""HTTP endpoints for reports — dashboard tiles and period summaries."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from pydantic import BaseModel

from app.core.deps import CurrentShop, CurrentUser, DbSession
from app.features.exchange import service as exchange_service
from app.features.exchange.schemas import ExchangeRateHint
from app.features.reports import delivery, export_table, service
from app.features.reports.export import build_period_xlsx
from app.features.reports.schemas import (
    BreakdownReport,
    InventoryValueReport,
    PeriodReport,
    TodayDashboard,
)

_XLSX_MEDIA = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/today", response_model=TodayDashboard)
async def today(shop: CurrentShop, db: DbSession) -> TodayDashboard:
    """Three big tiles + counters that the user sees on app open."""
    return await service.today_dashboard(db, shop_id=shop.id)


@router.get("/period", response_model=PeriodReport)
async def period(
    shop: CurrentShop,
    db: DbSession,
    date_from: Annotated[date, Query(alias="from")],
    date_to: Annotated[date, Query(alias="to")],
    top_n: Annotated[int, Query(ge=1, le=20)] = 5,
) -> PeriodReport:
    """Aggregates between two dates (inclusive)."""
    if date_from > date_to:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "'from' must be <= 'to'"
        )
    return await service.period_report(
        db, shop_id=shop.id, date_from=date_from, date_to=date_to, top_n=top_n
    )


@router.get(
    "/period.xlsx",
    responses={200: {"content": {_XLSX_MEDIA: {}}}},
    response_class=Response,
)
async def period_xlsx(
    shop: CurrentShop,
    db: DbSession,
    date_from: Annotated[date, Query(alias="from")],
    date_to: Annotated[date, Query(alias="to")],
    top_n: Annotated[int, Query(ge=1, le=20)] = 5,
) -> Response:
    """Same data as ``/period`` but as a downloadable Excel workbook.

    Generated server-side so it stays shop-scoped at the source and the
    Mini App bundle doesn't ship a spreadsheet library.
    """
    if date_from > date_to:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "'from' must be <= 'to'"
        )
    report = await service.period_report(
        db, shop_id=shop.id, date_from=date_from, date_to=date_to, top_n=top_n
    )
    content = build_period_xlsx(report, lang=shop.language_default)
    name = f"malika-report-{date_from.isoformat()}_{date_to.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type=_XLSX_MEDIA,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


def _require_bot(request: Request):
    """The aiogram Bot the lifespan put on app.state, or 503 if absent."""
    bot = getattr(request.app.state, "bot", None)
    if bot is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "telegram delivery unavailable"
        )
    return bot


@router.post("/period.xlsx/send")
async def period_xlsx_send(
    request: Request,
    shop: CurrentShop,
    user: CurrentUser,
    db: DbSession,
    date_from: Annotated[date, Query(alias="from")],
    date_to: Annotated[date, Query(alias="to")],
    top_n: Annotated[int, Query(ge=1, le=20)] = 5,
) -> dict[str, bool]:
    """Same workbook as ``/period.xlsx``, but pushed to the user's Telegram
    chat as a document — Telegram's WebView can't save blob downloads."""
    if date_from > date_to:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "'from' must be <= 'to'"
        )
    report = await service.period_report(
        db, shop_id=shop.id, date_from=date_from, date_to=date_to, top_n=top_n
    )
    content = build_period_xlsx(report, lang=shop.language_default)
    name = f"malika-report-{date_from.isoformat()}_{date_to.isoformat()}.xlsx"
    try:
        await delivery.send_xlsx(
            _require_bot(request),
            user,
            content=content,
            filename=name,
            caption=f"Отчёт за {date_from.isoformat()} — {date_to.isoformat()}",
        )
    except delivery.ReportDeliveryError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"sent": True}


@router.get("/breakdown", response_model=BreakdownReport)
async def breakdown(
    shop: CurrentShop,
    db: DbSession,
    date_from: Annotated[date, Query(alias="from")],
    date_to: Annotated[date, Query(alias="to")],
    group_by: Annotated[
        Literal["brand", "category", "model", "sale_type", "buyer"],
        Query(),
    ],
    category: Annotated[str | None, Query(max_length=32)] = None,
    brand: Annotated[str | None, Query(max_length=64)] = None,
    condition: Annotated[str | None, Query(max_length=32)] = None,
    sale_type: Annotated[str | None, Query(max_length=32)] = None,
) -> BreakdownReport:
    """Report builder: group active sales by one dimension over a period,
    with optional filters. Rows sorted by profit descending."""
    if date_from > date_to:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "'from' must be <= 'to'"
        )
    return await service.breakdown(
        db,
        shop_id=shop.id,
        date_from=date_from,
        date_to=date_to,
        group_by=group_by,
        category=category,
        brand=brand,
        condition=condition,
        sale_type=sale_type,
    )


_ExportEntity = Literal["sales", "devices", "purchases"]


class _ColumnMeta(BaseModel):
    key: str
    label: str
    type: str


@router.get("/export/columns", response_model=list[_ColumnMeta])
async def export_columns(
    shop: CurrentShop,
    entity: Annotated[_ExportEntity, Query()],
) -> list[_ColumnMeta]:
    """Available columns for the table-export picker (key/label/type, ordered).

    Shop dep keeps it authenticated; the registry itself is static."""
    return [
        _ColumnMeta(**c)
        for c in export_table.columns_for(entity, lang=shop.language_default)
    ]


@router.get(
    "/export.xlsx",
    responses={200: {"content": {_XLSX_MEDIA: {}}}},
    response_class=Response,
)
async def export_xlsx(
    shop: CurrentShop,
    db: DbSession,
    entity: Annotated[_ExportEntity, Query()],
    columns: Annotated[str, Query(description="comma-separated column keys, in order")] = "",
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
) -> Response:
    """Flat tabular export — only the chosen columns, in order. Empty/garbage
    ``columns`` falls back to all columns for the entity."""
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "'from' must be <= 'to'")
    selected = [c.strip() for c in columns.split(",") if c.strip()]
    rows = await export_table.fetch(
        db, shop_id=shop.id, entity=entity, date_from=date_from, date_to=date_to
    )
    content = export_table.build_xlsx(
        entity, rows, selected, lang=shop.language_default
    )
    name = f"malika-{entity}-{date.today().isoformat()}.xlsx"
    return Response(
        content=content,
        media_type=_XLSX_MEDIA,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.post("/export.xlsx/send")
async def export_xlsx_send(
    request: Request,
    shop: CurrentShop,
    user: CurrentUser,
    db: DbSession,
    entity: Annotated[_ExportEntity, Query()],
    columns: Annotated[str, Query(description="comma-separated column keys, in order")] = "",
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
) -> dict[str, bool]:
    """Same flat export as ``/export.xlsx``, pushed to the user's Telegram
    chat as a document (Telegram WebView can't save blob downloads)."""
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "'from' must be <= 'to'")
    selected = [c.strip() for c in columns.split(",") if c.strip()]
    rows = await export_table.fetch(
        db, shop_id=shop.id, entity=entity, date_from=date_from, date_to=date_to
    )
    content = export_table.build_xlsx(
        entity, rows, selected, lang=shop.language_default
    )
    name = f"malika-{entity}-{date.today().isoformat()}.xlsx"
    try:
        await delivery.send_xlsx(
            _require_bot(request),
            user,
            content=content,
            filename=name,
            caption=f"Выгрузка: {entity}",
        )
    except delivery.ReportDeliveryError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"sent": True}


@router.get("/inventory-value", response_model=InventoryValueReport)
async def inventory_value(
    shop: CurrentShop, db: DbSession
) -> InventoryValueReport:
    """Drill-down behind the "Заморожено" tile."""
    return await service.inventory_value(db, shop_id=shop.id)


@router.get("/exchange-rate-hint", response_model=ExchangeRateHint)
async def exchange_rate_hint(
    shop: CurrentShop, db: DbSession
) -> ExchangeRateHint:
    """Two USD→UZS suggestions for the purchase form's rate field:
    this shop's last-used rate and the official CBU rate."""
    return await exchange_service.exchange_rate_hint(db, shop_id=shop.id)
