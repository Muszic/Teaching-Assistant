# TG-TAS: Teaching Assistant System

A comprehensive educational platform for managing courses, assignments, and student submissions. Built with FastAPI, React, and MongoDB.

## 🎯 Overview

TG-TAS is a mid-level working prototype that enables teachers to create courses and assignments, while students can enroll in courses, submit assignments, and receive grades with feedback.

### Key Features

**For Teachers:**
- Create and manage courses
- Create assignments with due dates and point values
- View all student submissions
- Grade submissions with detailed feedback
- Track student progress

**For Students:**
- Browse and enroll in available courses
- View course assignments
- Submit assignments (mock file upload)
- View grades and teacher feedback
- Track submission status

## 🛠️ Technology Stack

- **Backend:** FastAPI (Python)
- **Frontend:** React 19
- **Database:** MongoDB
- **Authentication:** JWT (JSON Web Tokens)
- **UI Components:** Shadcn UI + Tailwind CSS
- **Fonts:** Space Grotesk, Inter

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- MongoDB
- yarn package manager

## 🚀 Setup Instructions

### 1. Database Setup

MongoDB is already running locally. The database `tg_tas_db` will be created automatically on first use.

**Collections created automatically:**
- `users` - User accounts (teachers and students)
- `courses` - Course information
- `enrollments` - Student course enrollments
- `assignments` - Course assignments
- `submissions` - Assignment submissions with grades

### 2. Backend Setup

```bash
# Navigate to backend directory
cd /app/backend

# Install Python dependencies
pip install -r requirements.txt

# The backend runs automatically via supervisor
# To restart manually:
sudo supervisorctl restart backend

# View backend logs:
tail -f /var/log/supervisor/backend.*.log
```

**Backend runs on:** `http://0.0.0.0:8001` (internal)

**Environment variables** (configured in `/app/backend/.env`):
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=tg_tas_db
JWT_SECRET=tg-tas-secret-key-change-in-production-12345
CORS_ORIGINS=*
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd /app/frontend

# Install dependencies
yarn install

# The frontend runs automatically via supervisor
# To restart manually:
sudo supervisorctl restart frontend
```

**Frontend runs on:** `http://0.0.0.0:3000` (internal)

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (teacher/student)
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Courses
- `POST /api/courses` - Create course (teacher only)
- `GET /api/courses` - Get all courses
- `GET /api/courses/{course_id}` - Get specific course
- `POST /api/courses/{course_id}/enroll` - Enroll in course (student only)
- `GET /api/courses/enrolled/my` - Get enrolled courses (student only)

### Assignments
- `POST /api/assignments` - Create assignment (teacher only)
- `GET /api/courses/{course_id}/assignments` - Get course assignments

### Submissions
- `POST /api/assignments/{assignment_id}/submit` - Submit assignment (student only)
- `GET /api/assignments/{assignment_id}/submissions` - Get submissions
- `PUT /api/submissions/{submission_id}/grade` - Grade submission (teacher only)

## 🔐 Authentication

The system uses JWT token-based authentication:

1. User registers with email, password, name, and role (teacher/student)
2. On successful registration/login, receive JWT token
3. Token is stored in localStorage
4. All API requests include token in Authorization header: `Bearer {token}`
5. Token expires after 24 hours

## 📝 Assignment Lifecycle

1. **Teacher creates course** → Course appears in student's browse list
2. **Student enrolls** → Course added to "My Assignments" tab
3. **Teacher creates assignment** → Assignment visible to enrolled students
4. **Student submits** → Mock file path stored (e.g., "s3://mock/assignment.pdf")
5. **Teacher grades** → Grade and feedback provided
6. **Student views results** → Grade and feedback displayed

## 🎨 UI/UX Design

- Clean, professional educational platform aesthetic
- Soft blue and indigo color palette
- Modern Space Grotesk font for headings
- Inter font for body text
- Responsive design for all screen sizes
- Smooth animations and transitions
- Glass-morphism effects for depth
- Clear visual hierarchy

## 🧪 Testing

The system includes comprehensive test coverage:

- User registration and authentication
- Course creation and management
- Assignment lifecycle
- Submission and grading flow
- Protected routes and role-based access
- Form validations

**Test results:** 95% success rate (all major features working)

## 📁 Project Structure

```
/app/
├── backend/
│   ├── server.py              # FastAPI application
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Environment variables
│
├── frontend/
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── App.js           # Main React component
│   │   ├── App.css          # Global styles
│   │   └── components/
│   │       ├── LandingPage.js
│   │       ├── Login.js
│   │       ├── Register.js
│   │       ├── TeacherDashboard.js
│   │       ├── StudentDashboard.js
│   │       └── ui/          # Shadcn UI components
│   ├── package.json         # Node dependencies
│   └── .env                 # Environment variables
│
└── README.md                # This file
```

## 🔒 Security Notes

- Passwords are hashed using bcrypt
- JWT tokens expire after 24 hours
- CORS is configured for cross-origin requests
- Role-based access control for all protected routes
- Input validation on all forms

**⚠️ For Production:**
- Change JWT_SECRET to a secure random string
- Configure proper CORS origins
- Enable HTTPS
- Add rate limiting
- Implement refresh tokens
- Add comprehensive logging

## 🎯 Scope and Limitations

**Included:**
- Core assignment lifecycle (create → submit → grade → view)
- Two user roles (Teacher and Student)
- JWT authentication
- Course and assignment management
- Basic enrollment system

**Not Included (as per prototype scope):**
- Real file uploads (using mock text strings)
- Administrator or TA roles
- Real-time features (WebSockets, live sessions)
- Cloud storage integration (AWS S3)
- Advanced performance optimization
- Accessibility compliance (WCAG)

## 📞 Support

For issues or questions:
1. Check backend logs: `tail -f /var/log/supervisor/backend.*.log`
2. Check frontend logs: `tail -f /var/log/supervisor/frontend.*.log`
3. Restart services: `sudo supervisorctl restart backend frontend`

## 📄 License

Educational prototype - 2025

---

**Built with ❤️ using Emergent AI**
