"""岗位聚合端点(PLAN §9.3 / §10:后端 SQL 把 41k 压成几百聚合点,图表只吃聚合结果)。"""

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import ColumnElement

from app.db.models import Job
from app.db.session import get_session

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _conds(
    province: str | None, city: str | None, year: int | None, education: str | None
) -> list[ColumnElement[bool]]:
    conds: list[ColumnElement[bool]] = []
    if province:
        conds.append(Job.province == province)
    if city:
        conds.append(Job.city == city)
    if year:
        conds.append(Job.year == year)
    if education:
        conds.append(Job.education.ilike(f"%{education}%"))
    return conds


def _num(x: object, digits: int = 1) -> float | None:
    return round(float(x), digits) if x is not None else None


@router.get("/filters")
async def filters(db: AsyncSession = Depends(get_session)) -> dict:
    """筛选控件选项:省→市级联 + 年份。"""
    rows = (
        await db.execute(
            select(Job.province, Job.city, func.count(Job.id))
            .where(Job.province.isnot(None))
            .group_by(Job.province, Job.city)
        )
    ).all()
    prov: dict[str, list[str]] = {}
    for province, city, _ in rows:
        prov.setdefault(province, [])
        if city and city not in prov[province]:
            prov[province].append(city)
    years = [
        r[0]
        for r in (
            await db.execute(select(Job.year).where(Job.year.isnot(None)).distinct().order_by(Job.year))
        ).all()
    ]
    return {
        "provinces": [{"province": p, "cities": sorted(c)} for p, c in sorted(prov.items())],
        "years": years,
    }


@router.get("/stats")
async def stats(
    province: str | None = None,
    city: str | None = None,
    year: int | None = None,
    education: str | None = None,
    db: AsyncSession = Depends(get_session),
) -> dict:
    conds = _conds(province, city, year, education)

    def q(*cols: object):
        s = select(*cols)
        for c in conds:
            s = s.where(c)
        return s

    kpi_row = (
        await db.execute(
            q(
                func.count(Job.id),
                func.coalesce(func.sum(Job.headcount), 0),
                func.avg(Job.apply_ratio),
                func.avg(Job.interview_score),
                func.avg(Job.value_score),
            )
        )
    ).one()
    kpi = {
        "total_jobs": kpi_row[0],
        "total_headcount": int(kpi_row[1] or 0),
        "avg_apply_ratio": _num(kpi_row[2]),
        "avg_interview_score": _num(kpi_row[3]),
        "avg_value_score": _num(kpi_row[4]),
    }

    by_year = [
        {"year": r[0], "jobs": r[1], "headcount": int(r[2] or 0)}
        for r in (
            await db.execute(
                q(Job.year, func.count(Job.id), func.sum(Job.headcount))
                .where(Job.year.isnot(None))
                .group_by(Job.year)
                .order_by(Job.year)
            )
        ).all()
    ]

    bucket = case(
        (Job.apply_ratio < 5, "0-5"),
        (Job.apply_ratio < 10, "5-10"),
        (Job.apply_ratio < 20, "10-20"),
        (Job.apply_ratio < 50, "20-50"),
        (Job.apply_ratio < 100, "50-100"),
        else_="100+",
    )
    ratio_rows = (
        await db.execute(
            q(bucket.label("bucket"), func.count(Job.id))
            .where(Job.apply_ratio > 0)
            .group_by(bucket)
        )
    ).all()
    rmap = {r[0]: r[1] for r in ratio_rows}
    ratio_hist = [
        {"bucket": b, "count": rmap.get(b, 0)}
        for b in ["0-5", "5-10", "10-20", "20-50", "50-100", "100+"]
    ]

    by_education = [
        {"education": r[0] or "未注明", "jobs": r[1], "headcount": int(r[2] or 0)}
        for r in (
            await db.execute(
                q(Job.education, func.count(Job.id), func.sum(Job.headcount))
                .group_by(Job.education)
                .order_by(func.count(Job.id).desc())
                .limit(8)
            )
        ).all()
    ]

    by_province = [
        {
            "province": r[0],
            "jobs": r[1],
            "headcount": int(r[2] or 0),
            "avg_ratio": _num(r[3]),
        }
        for r in (
            await db.execute(
                q(Job.province, func.count(Job.id), func.sum(Job.headcount), func.avg(Job.apply_ratio))
                .where(Job.province.isnot(None))
                .group_by(Job.province)
                .order_by(func.count(Job.id).desc())
            )
        ).all()
    ]

    top_units = [
        {"unit": r[0], "jobs": r[1], "headcount": int(r[2] or 0)}
        for r in (
            await db.execute(
                q(Job.unit, func.count(Job.id), func.sum(Job.headcount))
                .where(Job.unit.isnot(None))
                .group_by(Job.unit)
                .order_by(func.count(Job.id).desc())
                .limit(10)
            )
        ).all()
    ]

    return {
        "kpi": kpi,
        "by_year": by_year,
        "ratio_hist": ratio_hist,
        "by_education": by_education,
        "by_province": by_province,
        "top_units": top_units,
    }


@router.get("/map")
async def map_data(
    province: str | None = None,
    year: int | None = None,
    education: str | None = None,
    db: AsyncSession = Depends(get_session),
) -> dict:
    """地图聚合:给定 province 返回其市州级,否则返回省级。"""
    region = Job.city if province else Job.province
    conds = _conds(province, None, year, education)
    s = select(region, func.count(Job.id), func.sum(Job.headcount), func.avg(Job.apply_ratio)).where(
        region.isnot(None)
    )
    for c in conds:
        s = s.where(c)
    s = s.group_by(region)
    rows = (await db.execute(s)).all()
    return {
        "level": "city" if province else "province",
        "items": [
            {"name": r[0], "jobs": r[1], "headcount": int(r[2] or 0), "avg_ratio": _num(r[3])}
            for r in rows
        ],
    }


@router.get("/scatter")
async def scatter(
    province: str | None = None,
    city: str | None = None,
    year: int | None = None,
    education: str | None = None,
    limit: int = 3000,
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    """性价比×进面分散点的采样点(large 模式可承载数千点)。"""
    conds = _conds(province, city, year, education)
    s = select(Job.value_score, Job.interview_score, Job.headcount, Job.education).where(
        Job.value_score.isnot(None), Job.interview_score.isnot(None)
    )
    for c in conds:
        s = s.where(c)
    s = s.order_by(func.random()).limit(min(limit, 5000))
    rows = (await db.execute(s)).all()
    return [
        {
            "value_score": float(r[0]),
            "interview_score": float(r[1]),
            "headcount": r[2] or 1,
            "education": r[3] or "未注明",
        }
        for r in rows
    ]


@router.get("/list")
async def list_jobs(
    province: str | None = None,
    city: str | None = None,
    year: int | None = None,
    education: str | None = None,
    limit: int = 2000,
    db: AsyncSession = Depends(get_session),
) -> dict:
    """岗位明细(按性价比降序,上限较高以演示前端虚拟滚动)。"""
    conds = _conds(province, city, year, education)
    base = select(Job)
    for c in conds:
        base = base.where(c)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    rows = (
        await db.execute(base.order_by(Job.value_score.desc().nulls_last()).limit(min(limit, 20000)))
    ).scalars().all()
    items = [
        {
            "id": j.id,
            "province": j.province,
            "city": j.city,
            "year": j.year,
            "unit": j.unit,
            "position": j.position,
            "education": j.education,
            "apply_ratio": _num(j.apply_ratio),
            "interview_score": _num(j.interview_score),
            "headcount": j.headcount,
            "value_score": _num(j.value_score),
        }
        for j in rows
    ]
    return {"total": total, "items": items}
