from typing import Any, Literal
from pydantic import BaseModel, Field


# --- FE → BE ---

class UserMessage(BaseModel):
    type: Literal["user_message"] = "user_message"
    text: str


class ToolResult(BaseModel):
    type: Literal["tool_result"] = "tool_result"
    id: str
    ok: bool = True
    result: Any | None = None
    error: str | None = None


class Cancel(BaseModel):
    type: Literal["cancel"] = "cancel"


ClientMessage = UserMessage | ToolResult | Cancel


# --- BE → FE ---

class AssistantText(BaseModel):
    type: Literal["assistant_text"] = "assistant_text"
    text: str


class ToolCall(BaseModel):
    type: Literal["tool_call"] = "tool_call"
    id: str
    name: str
    args: dict[str, Any] = Field(default_factory=dict)


class Done(BaseModel):
    type: Literal["done"] = "done"
    usage: dict[str, Any] | None = None


class ServerError(BaseModel):
    type: Literal["error"] = "error"
    message: str


ServerMessage = AssistantText | ToolCall | Done | ServerError
