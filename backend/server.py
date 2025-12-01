from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import aiosqlite
import os
import logging
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database
DB_NAME = "tg_tas.db"
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str

class UserRegister(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None

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
    file_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubmissionCreate(BaseModel):
    pass

class Submission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assignment_id: str
    student_id: str
    student_name: str
    file_url: str
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    grade: Optional[int] = None
    feedback: Optional[str] = None
    status: str = "submitted"

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
        
        async with aiosqlite.connect(DB_NAME) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
                user = await cursor.fetchone()
                
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_dict = dict(user)
        if isinstance(user_dict.get('created_at'), str):
            user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
        
        return User(**user_dict)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Init DB
@app.on_event("startup")
async def startup():
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                name TEXT,
                role TEXT,
                password TEXT,
                created_at TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS courses (
                id TEXT PRIMARY KEY,
                title TEXT,
                description TEXT,
                teacher_id TEXT,
                teacher_name TEXT,
                created_at TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS enrollments (
                id TEXT PRIMARY KEY,
                student_id TEXT,
                course_id TEXT,
                enrolled_at TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS assignments (
                id TEXT PRIMARY KEY,
                course_id TEXT,
                title TEXT,
                description TEXT,
                due_date TEXT,
                total_points INTEGER,
                file_url TEXT,
                created_at TEXT
            )
        """)
        # Migration for existing assignments table
        try:
            await db.execute("ALTER TABLE assignments ADD COLUMN file_url TEXT")
        except Exception:
            pass

        await db.execute("""
            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                assignment_id TEXT,
                student_id TEXT,
                student_name TEXT,
                file_url TEXT,
                submitted_at TEXT,
                grade INTEGER,
                feedback TEXT,
                status TEXT
            )
        """)
        await db.commit()

# Auth Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserRegister):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE email = ?", (user_input.email,)) as cursor:
            existing_user = await cursor.fetchone()
            
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        if user_input.role not in ["teacher", "student"]:
            raise HTTPException(status_code=400, detail="Role must be 'teacher' or 'student'")
        
        user_obj = User(
            email=user_input.email,
            name=user_input.name,
            role=user_input.role
        )
        
        hashed_pw = hash_password(user_input.password)
        
        await db.execute(
            "INSERT INTO users (id, email, name, role, password, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_obj.id, user_obj.email, user_obj.name, user_obj.role, hashed_pw, user_obj.created_at.isoformat())
        )
        await db.commit()
        
        access_token = create_access_token(user_obj.id, user_obj.email, user_obj.role)
        return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE email = ?", (credentials.email,)) as cursor:
            user = await cursor.fetchone()
            
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_dict = dict(user)
    if not verify_password(credentials.password, user_dict['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
    
    user_obj = User(**{k: v for k, v in user_dict.items() if k != 'password'})
    access_token = create_access_token(user_obj.id, user_obj.email, user_obj.role)
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/auth/profile", response_model=User)
async def update_profile(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        updates = []
        params = []
        
        if user_update.name:
            updates.append("name = ?")
            params.append(user_update.name)
            
        if user_update.password:
            hashed_pw = hash_password(user_update.password)
            updates.append("password = ?")
            params.append(hashed_pw)
            
        if not updates:
            return current_user
            
        params.append(current_user.id)
        
        await db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", tuple(params))
        await db.commit()
        
        async with db.execute("SELECT * FROM users WHERE id = ?", (current_user.id,)) as cursor:
            updated_user = await cursor.fetchone()
            
    user_dict = dict(updated_user)
    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
        
    return User(**user_dict)

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
    
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(
            "INSERT INTO courses (id, title, description, teacher_id, teacher_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (course_obj.id, course_obj.title, course_obj.description, course_obj.teacher_id, course_obj.teacher_name, course_obj.created_at.isoformat())
        )
        await db.commit()
        
    return course_obj

@api_router.get("/courses", response_model=List[Course])
async def get_courses(current_user: User = Depends(get_current_user)):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        if current_user.role == "teacher":
            async with db.execute("SELECT * FROM courses WHERE teacher_id = ?", (current_user.id,)) as cursor:
                courses = await cursor.fetchall()
        else:
            async with db.execute("SELECT * FROM courses") as cursor:
                courses = await cursor.fetchall()
                
    result = []
    for course in courses:
        c = dict(course)
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
        result.append(Course(**c))
    
    return result

@api_router.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: str, current_user: User = Depends(get_current_user)):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM courses WHERE id = ?", (course_id,)) as cursor:
            course = await cursor.fetchone()
            
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    c = dict(course)
    if isinstance(c.get('created_at'), str):
        c['created_at'] = datetime.fromisoformat(c['created_at'])
    
    return Course(**c)

@api_router.post("/courses/{course_id}/enroll")
async def enroll_in_course(course_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can enroll in courses")
    
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        # Check course exists
        async with db.execute("SELECT * FROM courses WHERE id = ?", (course_id,)) as cursor:
            course = await cursor.fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Check if already enrolled
        async with db.execute("SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?", (current_user.id, course_id)) as cursor:
            existing = await cursor.fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Already enrolled in this course")
        
        enrollment_obj = Enrollment(
            student_id=current_user.id,
            course_id=course_id
        )
        
        await db.execute(
            "INSERT INTO enrollments (id, student_id, course_id, enrolled_at) VALUES (?, ?, ?, ?)",
            (enrollment_obj.id, enrollment_obj.student_id, enrollment_obj.course_id, enrollment_obj.enrolled_at.isoformat())
        )
        await db.commit()
        
    return {"message": "Successfully enrolled in course"}

@api_router.get("/courses/enrolled/my")
async def get_enrolled_courses(current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have enrolled courses")
    
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT c.* FROM courses c
            JOIN enrollments e ON c.id = e.course_id
            WHERE e.student_id = ?
        """, (current_user.id,)) as cursor:
            courses = await cursor.fetchall()
            
    result = []
    for course in courses:
        c = dict(course)
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
        result.append(Course(**c))
    
    return result

# Assignment Routes
@api_router.post("/assignments", response_model=Assignment)
async def create_assignment(
    course_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    due_date: str = Form(...),
    total_points: int = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create assignments")
    
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        # Verify course belongs to teacher
        async with db.execute("SELECT * FROM courses WHERE id = ? AND teacher_id = ?", (course_id, current_user.id)) as cursor:
            course = await cursor.fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found or you don't have permission")
        
        file_url = None
        if file:
            file_extension = Path(file.filename).suffix
            new_filename = f"assignment_{uuid.uuid4()}{file_extension}"
            file_path = UPLOADS_DIR / new_filename
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            file_url = f"/uploads/{new_filename}"

        assignment_obj = Assignment(
            course_id=course_id,
            title=title,
            description=description,
            due_date=due_date,
            total_points=total_points,
            file_url=file_url
        )
        
        await db.execute(
            "INSERT INTO assignments (id, course_id, title, description, due_date, total_points, file_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (assignment_obj.id, assignment_obj.course_id, assignment_obj.title, assignment_obj.description, assignment_obj.due_date, assignment_obj.total_points, assignment_obj.file_url, assignment_obj.created_at.isoformat())
        )
        await db.commit()
        
    return assignment_obj

@api_router.get("/courses/{course_id}/assignments", response_model=List[Assignment])
async def get_course_assignments(course_id: str, current_user: User = Depends(get_current_user)):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        async with db.execute("SELECT * FROM courses WHERE id = ?", (course_id,)) as cursor:
            course = await cursor.fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        course_dict = dict(course)
        
        if current_user.role == "student":
            async with db.execute("SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?", (current_user.id, course_id)) as cursor:
                enrollment = await cursor.fetchone()
            if not enrollment:
                raise HTTPException(status_code=403, detail="Not enrolled in this course")
        elif current_user.role == "teacher" and course_dict['teacher_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Not your course")
        
        async with db.execute("SELECT * FROM assignments WHERE course_id = ?", (course_id,)) as cursor:
            assignments = await cursor.fetchall()
            
    result = []
    for assignment in assignments:
        a = dict(assignment)
        if isinstance(a.get('created_at'), str):
            a['created_at'] = datetime.fromisoformat(a['created_at'])
        result.append(Assignment(**a))
    
    return result

# Submission Routes
@api_router.post("/assignments/{assignment_id}/submit", response_model=Submission)
async def submit_assignment(
    assignment_id: str, 
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit assignments")
    
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        async with db.execute("SELECT * FROM assignments WHERE id = ?", (assignment_id,)) as cursor:
            assignment = await cursor.fetchone()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        assignment_dict = dict(assignment)
        
        # Verify student is enrolled
        async with db.execute("SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?", (current_user.id, assignment_dict['course_id'])) as cursor:
            enrollment = await cursor.fetchone()
        if not enrollment:
            raise HTTPException(status_code=403, detail="Not enrolled in this course")
        
        # Check if already submitted
        async with db.execute("SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?", (assignment_id, current_user.id)) as cursor:
            existing = await cursor.fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Assignment already submitted")
        
        # Save file
        file_extension = Path(file.filename).suffix
        new_filename = f"{assignment_id}_{current_user.id}{file_extension}"
        file_path = UPLOADS_DIR / new_filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_url = f"/uploads/{new_filename}"
        
        submission_obj = Submission(
            assignment_id=assignment_id,
            student_id=current_user.id,
            student_name=current_user.name,
            file_url=file_url
        )
        
        await db.execute(
            "INSERT INTO submissions (id, assignment_id, student_id, student_name, file_url, submitted_at, grade, feedback, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (submission_obj.id, submission_obj.assignment_id, submission_obj.student_id, submission_obj.student_name, submission_obj.file_url, submission_obj.submitted_at.isoformat(), submission_obj.grade, submission_obj.feedback, submission_obj.status)
        )
        await db.commit()
        
    return submission_obj

@api_router.get("/assignments/{assignment_id}/submissions", response_model=List[Submission])
async def get_submissions(assignment_id: str, current_user: User = Depends(get_current_user)):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        async with db.execute("SELECT * FROM assignments WHERE id = ?", (assignment_id,)) as cursor:
            assignment = await cursor.fetchone()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        assignment_dict = dict(assignment)
        
        # Check permissions
        if current_user.role == "student":
            async with db.execute("SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?", (assignment_id, current_user.id)) as cursor:
                submissions = await cursor.fetchall()
        elif current_user.role == "teacher":
            # Verify teacher owns the course
            async with db.execute("SELECT * FROM courses WHERE id = ? AND teacher_id = ?", (assignment_dict['course_id'], current_user.id)) as cursor:
                course = await cursor.fetchone()
            if not course:
                raise HTTPException(status_code=403, detail="Not your course")
            
            async with db.execute("SELECT * FROM submissions WHERE assignment_id = ?", (assignment_id,)) as cursor:
                submissions = await cursor.fetchall()
        
    result = []
    for submission in submissions:
        s = dict(submission)
        if isinstance(s.get('submitted_at'), str):
            s['submitted_at'] = datetime.fromisoformat(s['submitted_at'])
        result.append(Submission(**s))
    
    return result

@api_router.put("/submissions/{submission_id}/grade", response_model=Submission)
async def grade_submission(
    submission_id: str, 
    grade_input: GradeSubmission, 
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can grade submissions")
    
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        async with db.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,)) as cursor:
            submission = await cursor.fetchone()
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        submission_dict = dict(submission)
        
        # Verify teacher owns the course
        async with db.execute("SELECT * FROM assignments WHERE id = ?", (submission_dict['assignment_id'],)) as cursor:
            assignment = await cursor.fetchone()
        assignment_dict = dict(assignment)
        
        async with db.execute("SELECT * FROM courses WHERE id = ? AND teacher_id = ?", (assignment_dict['course_id'], current_user.id)) as cursor:
            course = await cursor.fetchone()
        if not course:
            raise HTTPException(status_code=403, detail="Not your course")
        
        # Validate grade
        if grade_input.grade < 0 or grade_input.grade > assignment_dict['total_points']:
            raise HTTPException(status_code=400, detail="Invalid grade")
        
        await db.execute(
            "UPDATE submissions SET grade = ?, feedback = ?, status = ? WHERE id = ?",
            (grade_input.grade, grade_input.feedback, "graded", submission_id)
        )
        await db.commit()
        
        async with db.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,)) as cursor:
            updated_submission = await cursor.fetchone()
            
    s = dict(updated_submission)
    if isinstance(s.get('submitted_at'), str):
        s['submitted_at'] = datetime.fromisoformat(s['submitted_at'])
        
    return Submission(**s)




@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can delete courses")
    
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        # Verify course ownership
        async with db.execute("SELECT * FROM courses WHERE id = ? AND teacher_id = ?", (course_id, current_user.id)) as cursor:
            course = await cursor.fetchone()
        
        if not course:
            raise HTTPException(status_code=404, detail="Course not found or you don't have permission")
        
        # Delete course and related data
        
        async with db.execute("SELECT id FROM assignments WHERE course_id = ?", (course_id,)) as cursor:
            assignments = await cursor.fetchall()
            assignment_ids = [a['id'] for a in assignments]
        
        if assignment_ids:
            placeholders = ','.join('?' * len(assignment_ids))
            await db.execute(f"DELETE FROM submissions WHERE assignment_id IN ({placeholders})", assignment_ids)
            await db.execute(f"DELETE FROM assignments WHERE course_id = ?", (course_id,))
            
        await db.execute("DELETE FROM enrollments WHERE course_id = ?", (course_id,))
        await db.execute("DELETE FROM courses WHERE id = ?", (course_id,))
        await db.commit()
    
    return {"message": "Course deleted successfully"}

@api_router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can delete assignments")
    
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        # Verify assignment and course ownership
        async with db.execute("""
            SELECT a.*, c.teacher_id 
            FROM assignments a 
            JOIN courses c ON a.course_id = c.id 
            WHERE a.id = ?
        """, (assignment_id,)) as cursor:
            result = await cursor.fetchone()
            
        if not result:
            raise HTTPException(status_code=404, detail="Assignment not found")
            
        if result['teacher_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="You don't have permission to delete this assignment")
            
        # Delete assignment and its submissions
        await db.execute("DELETE FROM submissions WHERE assignment_id = ?", (assignment_id,))
        await db.execute("DELETE FROM assignments WHERE id = ?", (assignment_id,))
        await db.commit()
        
    return {"message": "Assignment deleted successfully"}

@api_router.delete("/courses/{course_id}/enroll")
async def unenroll_course(course_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can unenroll from courses")
        
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        await db.execute(
            "DELETE FROM enrollments WHERE student_id = ? AND course_id = ?",
            (current_user.id, course_id)
        )
        await db.commit()
        
    return {"message": "Unenrolled successfully"}

@api_router.get("/courses/{course_id}/students", response_model=List[UserBase])
async def get_course_students(course_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can view enrolled students")
        
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        
        # Verify course ownership
        async with db.execute("SELECT * FROM courses WHERE id = ? AND teacher_id = ?", (course_id, current_user.id)) as cursor:
            course = await cursor.fetchone()
            
        if not course:
            raise HTTPException(status_code=404, detail="Course not found or you don't have permission")
            
        async with db.execute("""
            SELECT u.email, u.name, u.role
            FROM users u
            JOIN enrollments e ON u.id = e.student_id
            WHERE e.course_id = ?
        """, (course_id,)) as cursor:
            students = await cursor.fetchall()
            
    return [UserBase(email=s['email'], name=s['name'], role=s['role']) for s in students]

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)

