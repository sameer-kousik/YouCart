from fastapi import APIRouter, Query
from utils import load_material_data

router = APIRouter(prefix="/api", tags=["Academic"])

@router.get("/subjects")
def get_subjects(year: str = Query(...), semester: str = Query(...)):
    data = load_material_data(year.upper())
    subjects = list(data.get(semester.upper(), {}).keys())
    return {"subjects": subjects}

@router.get("/materials")
def get_materials(year: str, semester: str, category: str):
    data = load_material_data(year.upper())
    return {"link": data.get(semester.upper(), {}).get(category.lower(), "Not available")}

@router.get("/syllabus")
def get_syllabus(year: str, semester: str):
    data = load_material_data(year.upper())
    return {"link": data.get(semester.upper(), {}).get("syllabus", "Not available")}

@router.get("/timetable")
def get_timetable(year: str):
    data = load_material_data(year.upper())
    # assume timetable is same across semesters
    for sem in data.values():
        if "tt" in sem:
            return {"link": sem["tt"]}
    return {"link": "Not available"}

@router.get("/question-papers")
def get_question_papers(year: str, semester: str):
    data = load_material_data(year.upper())
    return {"link": data.get(semester.upper(), {}).get("qp", "Not available")}
