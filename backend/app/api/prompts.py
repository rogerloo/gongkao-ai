"""Prompt 模板 + 版本管理(PLAN §7/§9.4)。"""

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Prompt, PromptVersion
from app.db.session import get_session

router = APIRouter(prefix="/prompts", tags=["prompts"])

VAR_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def extract_vars(text: str) -> list[str]:
    """抽取 {{变量}} 名(去重排序)。"""
    return sorted(set(VAR_RE.findall(text)))


class CreatePrompt(BaseModel):
    name: str
    system_prompt: str = ""


class SaveVersion(BaseModel):
    system_prompt: str


@router.get("")
async def list_prompts(db: AsyncSession = Depends(get_session)) -> list[dict]:
    prompts = (await db.execute(select(Prompt).order_by(Prompt.id))).scalars().all()
    out: list[dict] = []
    for p in prompts:
        count = await db.scalar(
            select(func.count()).select_from(PromptVersion).where(PromptVersion.prompt_id == p.id)
        )
        out.append(
            {"id": p.id, "name": p.name, "current_version": p.current_version, "versions": count or 0}
        )
    return out


@router.get("/{pid}")
async def get_prompt(pid: int, db: AsyncSession = Depends(get_session)) -> dict:
    p = await db.get(Prompt, pid)
    if p is None:
        raise HTTPException(status_code=404, detail="prompt 不存在")
    versions = (
        await db.execute(
            select(PromptVersion)
            .where(PromptVersion.prompt_id == pid)
            .order_by(PromptVersion.version.desc())
        )
    ).scalars().all()
    return {
        "id": p.id,
        "name": p.name,
        "current_version": p.current_version,
        "versions": [
            {
                "id": v.id,
                "version": v.version,
                "system_prompt": v.system_prompt,
                "variables": v.variables or [],
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in versions
        ],
    }


@router.post("")
async def create_prompt(body: CreatePrompt, db: AsyncSession = Depends(get_session)) -> dict:
    p = Prompt(name=body.name, current_version=1)
    db.add(p)
    await db.flush()
    db.add(
        PromptVersion(
            prompt_id=p.id,
            version=1,
            system_prompt=body.system_prompt,
            variables=extract_vars(body.system_prompt),
        )
    )
    await db.commit()
    return {"id": p.id, "name": p.name, "current_version": 1}


@router.post("/{pid}/versions")
async def add_version(
    pid: int, body: SaveVersion, db: AsyncSession = Depends(get_session)
) -> dict:
    p = await db.get(Prompt, pid)
    if p is None:
        raise HTTPException(status_code=404, detail="prompt 不存在")
    max_v = (
        await db.scalar(
            select(func.max(PromptVersion.version)).where(PromptVersion.prompt_id == pid)
        )
    ) or 0
    new_v = max_v + 1
    db.add(
        PromptVersion(
            prompt_id=pid,
            version=new_v,
            system_prompt=body.system_prompt,
            variables=extract_vars(body.system_prompt),
        )
    )
    p.current_version = new_v
    await db.commit()
    return {"version": new_v}


@router.put("/{pid}/current/{version}")
async def set_current(
    pid: int, version: int, db: AsyncSession = Depends(get_session)
) -> dict:
    p = await db.get(Prompt, pid)
    if p is None:
        raise HTTPException(status_code=404, detail="prompt 不存在")
    exists = await db.scalar(
        select(func.count())
        .select_from(PromptVersion)
        .where(PromptVersion.prompt_id == pid, PromptVersion.version == version)
    )
    if not exists:
        raise HTTPException(status_code=404, detail="version 不存在")
    p.current_version = version
    await db.commit()
    return {"current_version": version}
