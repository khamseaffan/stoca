from pydantic import BaseModel


class ToolRequest(BaseModel):
    """Incoming tool execution request from Next.js."""

    store_id: str
    tool_name: str
    tool_input: dict


class ToolResponse(BaseModel):
    """Standard tool execution response."""

    success: bool
    result: str
