"""
统一响应工具

所有接口均通过 ok() / fail() 包裹后返回，格式为：
{
    "code": 0,
    "msg": "success",
    "data": ...
}
"""

from typing import Any


def ok(data: Any = None, msg: str = "success") -> dict:
    """成功响应"""
    return {"code": 0, "msg": msg, "data": data}


def fail(code: int, msg: str) -> dict:
    """业务失败响应（一般不直接用，推荐抛 HTTPException）"""
    return {"code": code, "msg": msg, "data": None}