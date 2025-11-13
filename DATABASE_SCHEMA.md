# TG-TAS Database Schema

## Overview

This document describes the MongoDB collections used in TG-TAS. While the original requirements specified PostgreSQL, we've adapted the schema to MongoDB for this implementation.

## Collections

### 1. users

Stores user account information for both teachers and students.

```javascript
{
  id: "uuid-string",              // Primary key (UUID)
  email: "user@example.com",      // Unique email address
  password: "hashed-password",    // bcrypt hashed password
  name: "John Doe",               // User's full name
  role: "teacher" | "student",    // User role
  created_at: "ISO-8601-datetime" // Account creation timestamp
}
```

**Indexes:**
- `email` (unique)
- `id` (unique)

---

### 2. courses

Stores course information created by teachers.

```javascript
{
  id: "uuid-string",              // Primary key (UUID)
  title: "Course Title",          // Course name
  description: "Course desc",     // Course description
  teacher_id: "uuid-string",      // Foreign key to users.id
  teacher_name: "Teacher Name",   // Denormalized for quick access
  created_at: "ISO-8601-datetime" // Course creation timestamp
}
```

**Indexes:**
- `id` (unique)
- `teacher_id`

**Relationships:**
- `teacher_id` → `users.id` (Many-to-One)

---

### 3. enrollments

Tracks student enrollments in courses.

```javascript
{
  id: "uuid-string",              // Primary key (UUID)
  student_id: "uuid-string",      // Foreign key to users.id
  course_id: "uuid-string",       // Foreign key to courses.id
  enrolled_at: "ISO-8601-datetime" // Enrollment timestamp
}
```

**Indexes:**
- `id` (unique)
- `student_id`
- `course_id`
- Compound: `(student_id, course_id)` (unique)

**Relationships:**
- `student_id` → `users.id` (Many-to-One)
- `course_id` → `courses.id` (Many-to-One)

---

### 4. assignments

Stores assignment information for courses.

```javascript
{
  id: "uuid-string",              // Primary key (UUID)
  course_id: "uuid-string",       // Foreign key to courses.id
  title: "Assignment Title",      // Assignment name
  description: "Assignment desc", // Assignment description
  due_date: "YYYY-MM-DD",        // Due date (string format)
  total_points: 100,              // Maximum points possible
  created_at: "ISO-8601-datetime" // Assignment creation timestamp
}
```

**Indexes:**
- `id` (unique)
- `course_id`

**Relationships:**
- `course_id` → `courses.id` (Many-to-One)

---

### 5. submissions

Stores student assignment submissions and grades.

```javascript
{
  id: "uuid-string",              // Primary key (UUID)
  assignment_id: "uuid-string",   // Foreign key to assignments.id
  student_id: "uuid-string",      // Foreign key to users.id
  student_name: "Student Name",   // Denormalized for quick access
  file_url: "s3://path/file.pdf", // Mock file path (string)
  submitted_at: "ISO-8601-datetime", // Submission timestamp
  grade: 85,                      // Grade value (null until graded)
  feedback: "Great work!",        // Teacher feedback (null until graded)
  status: "submitted" | "graded"  // Submission status
}
```

**Indexes:**
- `id` (unique)
- `assignment_id`
- `student_id`
- Compound: `(assignment_id, student_id)` (unique)

**Relationships:**
- `assignment_id` → `assignments.id` (Many-to-One)
- `student_id` → `users.id` (Many-to-One)

---

## PostgreSQL Equivalent Schema

If you were to implement this in PostgreSQL, here's the equivalent SQL:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('teacher', 'student')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enrollments table
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- Assignments table
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    due_date DATE NOT NULL,
    total_points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Submissions table
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    grade INTEGER,
    feedback TEXT,
    status VARCHAR(20) CHECK (status IN ('submitted', 'graded')) DEFAULT 'submitted',
    UNIQUE(assignment_id, student_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_assignments_course ON assignments(course_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
```

## Data Flow

### User Registration/Login
1. User submits registration form
2. Password is hashed with bcrypt
3. User document inserted into `users` collection
4. JWT token generated and returned

### Course Creation (Teacher)
1. Teacher creates course
2. Document inserted into `courses` collection with `teacher_id`
3. Course appears in all users' browse list

### Student Enrollment
1. Student clicks "Enroll"
2. Document inserted into `enrollments` collection
3. Course added to student's enrolled courses

### Assignment Creation (Teacher)
1. Teacher creates assignment for their course
2. Document inserted into `assignments` collection with `course_id`
3. Assignment visible to all enrolled students

### Assignment Submission (Student)
1. Student submits mock file URL
2. Document inserted into `submissions` collection
3. Status set to "submitted", grade and feedback null

### Grading (Teacher)
1. Teacher enters grade and feedback
2. Submission document updated: `grade`, `feedback`, `status="graded"`
3. Student can now view results

## Notes

- All IDs use UUID v4 for uniqueness
- Timestamps stored as ISO-8601 strings in MongoDB
- Denormalized fields (`teacher_name`, `student_name`) for performance
- No cascading deletes in MongoDB (handled in application logic)
- Unique constraints enforced via MongoDB indexes
- File uploads are mocked (text strings only)

## MongoDB vs PostgreSQL Trade-offs

**MongoDB Advantages:**
- Flexible schema for prototyping
- Easier horizontal scaling
- Native JSON document storage
- No need for complex joins

**PostgreSQL Advantages (if used):**
- Strong ACID guarantees
- Foreign key constraints
- Complex query capabilities
- Better for relational data
