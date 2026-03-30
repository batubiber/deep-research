from pydantic import BaseModel, Field


class ResearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


class ResearchResponse(BaseModel):
    report: str
    sources_count: int
