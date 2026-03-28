from pydantic import BaseModel


class ResearchRequest(BaseModel):
    query: str


class ResearchResponse(BaseModel):
    report: str
    sources_count: int
