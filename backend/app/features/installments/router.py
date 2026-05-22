"""HTTP endpoints for installment plans (Nasiya)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.common.pagination import Page, PageParams
from app.core.deps import CurrentShop, DbSession
from app.features.installments import repository as repo
from app.features.installments import service
from app.features.installments.schemas import (
    EarlyPayoffRequest,
    PaymentOut,
    PaymentRecord,
    PlanCreate,
    PlanOut,
    PlanStatusLiteral,
    PlanWithPaymentsOut,
)
from app.features.sales import service as sale_service

router = APIRouter(tags=["installments"])


def _payments_out(payments) -> list[PaymentOut]:
    return [PaymentOut.model_validate(p) for p in payments]


async def _build_plan_with_payments(
    db, plan, *, _shop_id: int  # _shop_id reserved for future role checks
) -> PlanWithPaymentsOut:
    payments = await repo.list_payments(db, plan.id)
    return PlanWithPaymentsOut(
        **PlanOut.model_validate(plan).model_dump(),
        payments=_payments_out(payments),
        remaining=await repo.remaining_balance(db, plan),
    )


# ─── Plan lifecycle ───────────────────────────────────────────────────


@router.post(
    "/sales/{sale_id}/installments",
    response_model=PlanWithPaymentsOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_plan_for_sale(
    sale_id: int, payload: PlanCreate, shop: CurrentShop, db: DbSession
) -> PlanWithPaymentsOut:
    """Build a payment schedule for a nasiya sale."""
    # Make sure the sale exists in this shop and is a real nasiya deal.
    try:
        sale = await sale_service.get_or_404(db, sale_id, shop_id=shop.id)
    except sale_service.SaleNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    if sale.sale_type != "nasiya":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "schedule can only be attached to a nasiya sale",
        )

    # The plan's total must equal the actual sale price — otherwise the
    # tracked debt (and the "Долги по Nasiya" KPI) is fabricated. Compare in
    # the sale's own currency: USD sales send total_amount in USD, UZS in UZS.
    expected = sale.sale_price_usd if sale.currency == "USD" else sale.sale_price_uzs
    if expected is not None and payload.total_amount != expected:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"total_amount must equal the sale price ({expected} {sale.currency})",
        )

    try:
        plan, _ = await service.create_plan(
            db,
            shop_id=shop.id,
            sale_id=sale_id,
            total_amount=payload.total_amount,
            down_payment=payload.down_payment,
            period_type=payload.period_type,
            period_count=payload.period_count,
            start_date=payload.start_date,
        )
    except service.PlanAlreadyExists as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except service.InstallmentError as exc:
        # down_payment > total_amount, non-positive total, etc. — 400 not 500.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return await _build_plan_with_payments(db, plan, _shop_id=shop.id)


@router.get("/installments", response_model=Page[PlanOut])
async def list_plans(
    shop: CurrentShop,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    status_: Annotated[PlanStatusLiteral | None, Query(alias="status")] = None,
) -> Page[PlanOut]:
    rows, total = await repo.search_plans(
        db,
        shop_id=shop.id,
        status=status_,
        limit=params.limit,
        offset=params.offset,
    )
    return Page.of(
        items=[
            PlanOut.model_validate(plan).model_copy(
                update={
                    "buyer_name": buyer_name,
                    "buyer_phone": buyer_phone,
                    "buyer_tg_username": buyer_tg_username,
                    "paid_amount": paid_amount,
                    "paid_count": paid_count,
                    "payments_count": payments_count,
                }
            )
            for (plan, buyer_name, buyer_phone, buyer_tg_username,
                 paid_amount, paid_count, payments_count) in rows
        ],
        total=total,
        params=params,
    )


@router.get("/installments/{plan_id}", response_model=PlanWithPaymentsOut)
async def get_plan(
    plan_id: int, shop: CurrentShop, db: DbSession
) -> PlanWithPaymentsOut:
    try:
        plan = await service.get_plan_or_404(db, plan_id, shop_id=shop.id)
    except service.PlanNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return await _build_plan_with_payments(db, plan, _shop_id=shop.id)


@router.get(
    "/sales/{sale_id}/installment", response_model=PlanWithPaymentsOut
)
async def get_plan_for_sale(
    sale_id: int, shop: CurrentShop, db: DbSession
) -> PlanWithPaymentsOut:
    """Convenience: jump straight from a sale id to its plan."""
    plan = await repo.get_plan_for_sale(db, sale_id, shop_id=shop.id)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "plan not found for sale")
    return await _build_plan_with_payments(db, plan, _shop_id=shop.id)


# ─── Payments ─────────────────────────────────────────────────────────


@router.post(
    "/installments/{plan_id}/payments",
    response_model=list[PaymentOut],
    status_code=status.HTTP_201_CREATED,
)
async def record_payment(
    plan_id: int,
    payload: PaymentRecord,
    shop: CurrentShop,
    db: DbSession,
) -> list[PaymentOut]:
    """Apply ``amount`` to the next unpaid rows in schedule order."""
    try:
        plan = await service.get_plan_or_404(db, plan_id, shop_id=shop.id)
    except service.PlanNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    try:
        touched = await service.record_payment(
            db,
            plan,
            amount=payload.amount,
            paid_at=payload.paid_at,
            note=payload.note,
        )
    except service.PlanInactive as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except service.InstallmentError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _payments_out(touched)


@router.post(
    "/installments/{plan_id}/payoff",
    response_model=list[PaymentOut],
    status_code=status.HTTP_200_OK,
)
async def early_payoff(
    plan_id: int,
    payload: EarlyPayoffRequest,
    shop: CurrentShop,
    db: DbSession,
) -> list[PaymentOut]:
    """Close every remaining payment row in a single event."""
    try:
        plan = await service.get_plan_or_404(db, plan_id, shop_id=shop.id)
    except service.PlanNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    try:
        touched = await service.early_payoff(
            db, plan, paid_at=payload.paid_at, note=payload.note
        )
    except service.PlanInactive as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except service.NothingOwed as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return _payments_out(touched)
