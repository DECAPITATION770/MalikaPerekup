"""HTTP endpoints for reports — dashboard tiles and period summaries."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import CurrentShop, DbSession
from app.features.exchange import service as exchange_service
from app.features.exchange.schemas import ExchangeRateHint
from app.features.reports import service
from app.features.reports.export import build_period_xlsx
from app.features.reports.schemas import (
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
