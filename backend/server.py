from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str  # "teacher" or "student"

class UserRegister(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class CourseCreate(BaseModel):
    title: str
    description: str

class Course(CourseCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    teacher_id: str
    teacher_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Enrollment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    course_id: str
    enrolled_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AssignmentCreate(BaseModel):
    course_id: str
    title: str
    description: str
    due_date: str
    total_points: int

class Assignment(AssignmentCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubmissionCreate(BaseModel):
    file_url: str

class Submission(SubmissionCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assignment_id: str
    student_id: str
    student_name: str
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    grade: Optional[int] = None
    feedback: Optional[str] = None
    status: str = "submitted"  # "submitted", "graded"

class GradeSubmission(BaseModel):
    grade: int
    feedback: str

# Helper Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode = {"sub": user_id, "email": email, "role": role, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_input.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if user_input.role not in ["teacher", "student"]:
        raise HTTPException(status_code=400, detail="Role must be 'teacher' or 'student'")
    
    # Create user
    user_obj = User(
        email=user_input.email,
        name=user_input.name,
        role=user_input.role
    )
    
    doc = user_obj.model_dump()
    doc['password'] = hash_password(user_input.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    # Create token
    access_token = create_access_token(user_obj.id, user_obj.email, user_obj.role)
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    user_obj = User(**{k: v for k, v in user.items() if k != 'password'})
    access_token = create_access_token(user_obj.id, user_obj.email, user_obj.role)
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Course Routes
@api_router.post("/courses", response_model=Course)
async def create_course(course_input: CourseCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create courses")
    
    course_obj = Course(
        **course_input.model_dump(),
        teacher_id=current_user.id,
        teacher_name=current_user.name
    )
    
    doc = course_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.courses.insert_one(doc)
    return course_obj

@api_router.get("/courses", response_model=List[Course])
async def get_courses(current_user: User = Depends(get_current_user)):
    if current_user.role == "teacher":
        courses = await db.courses.find({"teacher_id": current_user.id}, {"_id": 0}).to_list(1000)
    else:
        # Get all courses for students
        courses = await db.courses.find({}, {"_id": 0}).to_list(1000)
    
    for course in courses:
        if isinstance(course.get('created_at'), str):
            course['created_at'] = datetime.fromisoformat(course['created_at'])
    
    return courses

@api_router.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: str, current_user: User = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if isinstance(course.get('created_at'), str):
        course['created_at'] = datetime.fromisoformat(course['created_at'])
    
    return Course(**course)

@api_router.post("/courses/{course_id}/enroll")
async def enroll_in_course(course_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can enroll in courses")
    
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if already enrolled
    existing = await db.enrollments.find_one({"student_id": current_user.id, "course_id": course_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")
    
    enrollment_obj = Enrollment(
        student_id=current_user.id,
        course_id=course_id
    )
    
    doc = enrollment_obj.model_dump()
    doc['enrolled_at'] = doc['enrolled_at'].isoformat()
    
    await db.enrollments.insert_one(doc)
    return {"message": "Successfully enrolled in course"}

@api_router.get("/courses/enrolled/my")
async def get_enrolled_courses(current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have enrolled courses")
    
    enrollments = await db.enrollments.find({"student_id": current_user.id}, {"_id": 0}).to_list(1000)
    course_ids = [e['course_id'] for e in enrollments]
    
    courses = await db.courses.find({"id": {"$in": course_ids}}, {"_id": 0}).to_list(1000)
    
    for course in courses:
        if isinstance(course.get('created_at'), str):
            course['created_at'] = datetime.fromisoformat(course['created_at'])
    
    return courses

# Assignment Routes
@api_router.post("/assignments", response_model=Assignment)
async def create_assignment(assignment_input: AssignmentCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create assignments")
    
    # Verify course belongs to teacher
    course = await db.courses.find_one({"id": assignment_input.course_id, "teacher_id": current_user.id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or you don't have permission")
    
    assignment_obj = Assignment(**assignment_input.model_dump())
    
    doc = assignment_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.assignments.insert_one(doc)
    return assignment_obj

@api_router.get("/courses/{course_id}/assignments", response_model=List[Assignment])
async def get_course_assignments(course_id: str, current_user: User = Depends(get_current_user)):
    # Verify access to course
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if current_user.role == "student":
        # Verify student is enrolled
        enrollment = await db.enrollments.find_one({"student_id": current_user.id, "course_id": course_id})
        if not enrollment:
            raise HTTPException(status_code=403, detail="Not enrolled in this course")
    elif current_user.role == "teacher" and course['teacher_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your course")
    
    assignments = await db.assignments.find({"course_id": course_id}, {"_id": 0}).to_list(1000)
    
    for assignment in assignments:
        if isinstance(assignment.get('created_at'), str):
            assignment['created_at'] = datetime.fromisoformat(assignment['created_at'])
    
    return assignments

# Submission Routes
@api_router.post("/assignments/{assignment_id}/submit", response_model=Submission)
async def submit_assignment(assignment_id: str, submission_input: SubmissionCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit assignments")
    
    assignment = await db.assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Verify student is enrolled in the course
    enrollment = await db.enrollments.find_one({"student_id": current_user.id, "course_id": assignment['course_id']})
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Check if already submitted
    existing = await db.submissions.find_one({"assignment_id": assignment_id, "student_id": current_user.id})
    if existing:
        raise HTTPException(status_code=400, detail="Assignment already submitted")
    
    submission_obj = Submission(
        **submission_input.model_dump(),
        assignment_id=assignment_id,
        student_id=current_user.id,
        student_name=current_user.name
    )
    
    doc = submission_obj.model_dump()
    doc['submitted_at'] = doc['submitted_at'].isoformat()
    
    await db.submissions.insert_one(doc)
    return submission_obj

@api_router.get("/assignments/{assignment_id}/submissions", response_model=List[Submission])
async def get_assignment_submissions(assignment_id: str, current_user: User = Depends(get_current_user)):
    assignment = await db.assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if current_user.role == "teacher":
        # Verify it's their course
        course = await db.courses.find_one({"id": assignment['course_id'], "teacher_id": current_user.id})
        if not course:
            raise HTTPException(status_code=403, detail="Not your assignment")
        
        submissions = await db.submissions.find({"assignment_id": assignment_id}, {"_id": 0}).to_list(1000)
    else:
        # Students can only see their own submission
        submissions = await db.submissions.find({"assignment_id": assignment_id, "student_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for submission in submissions:
        if isinstance(submission.get('submitted_at'), str):
            submission['submitted_at'] = datetime.fromisoformat(submission['submitted_at'])
    
    return submissions

@api_router.put("/submissions/{submission_id}/grade", response_model=Submission)
async def grade_submission(submission_id: str, grade_input: GradeSubmission, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can grade submissions")
    
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Verify it's their assignment
    assignment = await db.assignments.find_one({"id": submission['assignment_id']})
    course = await db.courses.find_one({"id": assignment['course_id'], "teacher_id": current_user.id})
    if not course:
        raise HTTPException(status_code=403, detail="Not your assignment")
    
    # Validate grade
    if grade_input.grade < 0 or grade_input.grade > assignment['total_points']:
        raise HTTPException(status_code=400, detail=f"Grade must be between 0 and {assignment['total_points']}")
    
    # Update submission
    await db.submissions.update_one(
        {"id": submission_id},
        {"$set": {"grade": grade_input.grade, "feedback": grade_input.feedback, "status": "graded"}}
    )
    
    updated_submission = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    
    if isinstance(updated_submission.get('submitted_at'), str):
        updated_submission['submitted_at'] = datetime.fromisoformat(updated_submission['submitted_at'])
    
    return Submission(**updated_submission)

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()