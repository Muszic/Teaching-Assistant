import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os
from datetime import datetime, timezone

# Add backend to path to import server
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from server import register, UserRegister, Token, submit_assignment, Submission, User, Assignment
from fastapi import HTTPException, UploadFile

class AwaitableContextManager:
    def __init__(self, cursor):
        self.cursor = cursor
        
    def __await__(self):
        async def _ret():
            return self.cursor
        return _ret().__await__()
    
    async def __aenter__(self):
        return self.cursor
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class TestCFGFunctions(unittest.IsolatedAsyncioTestCase):
    
    async def test_register_success(self):
        user_input = UserRegister(
            email="test@example.com",
            name="Test User",
            role="student",
            password="password123"
        )
        
        connection_mock = MagicMock()
        connection_mock.commit = AsyncMock()
        
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None
        
        # Helper to handle both await and async with
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with patch("server.hash_password", return_value="hashed_secret"):
                with patch("server.create_access_token", return_value="access_token_123"):
                    result = await register(user_input)
                    
                    self.assertIsInstance(result, Token)
                    self.assertEqual(result.access_token, "access_token_123")
                    self.assertEqual(result.user.email, "test@example.com")
                    
                    connection_mock.execute.assert_any_call("SELECT * FROM users WHERE email = ?", ("test@example.com",))
                    self.assertTrue(connection_mock.commit.called)

    async def test_register_existing_user(self):
        user_input = UserRegister(
            email="existing@example.com",
            name="Existing User",
            role="student",
            password="password123"
        )
        
        connection_mock = MagicMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = {"email": "existing@example.com"}
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with self.assertRaises(HTTPException) as cm:
                await register(user_input)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertEqual(cm.exception.detail, "Email already registered")

    async def test_register_invalid_role(self):
        user_input = UserRegister(
            email="new@example.com",
            name="New User",
            role="admin", # Invalid role
            password="password123"
        )
        
        connection_mock = MagicMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with self.assertRaises(HTTPException) as cm:
                await register(user_input)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertEqual(cm.exception.detail, "Role must be 'teacher' or 'student'")

    async def test_submit_assignment_success(self):
        assignment_id = "assign_123"
        current_user = User(
            id="student_1",
            email="student@test.com",
            name="Student Name",
            role="student",
            created_at=datetime.now(timezone.utc)
        )
        file_mock = MagicMock(spec=UploadFile)
        file_mock.filename = "solution.pdf"
        file_mock.file = MagicMock()

        connection_mock = MagicMock()
        connection_mock.commit = AsyncMock()
        
        mock_cursor = AsyncMock()
        
        assignment_data = {"id": assignment_id, "course_id": "course_1", "total_points": 100}
        enrollment_data = {"id": "enroll_1", "student_id": "student_1", "course_id": "course_1"}
        existing_submission = None
        
        mock_cursor.fetchone.side_effect = [assignment_data, enrollment_data, existing_submission, {"id": "sub_new", "status": "submitted"}]
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper

        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock

        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with patch("server.open", MagicMock(), create=True):
                with patch("server.shutil.copyfileobj"):
                    result = await submit_assignment(assignment_id, file_mock, current_user)
                    
                    self.assertIsInstance(result, Submission)
                    self.assertEqual(result.assignment_id, assignment_id)
                    self.assertEqual(result.student_id, current_user.id)
                    self.assertTrue(connection_mock.commit.called)

    async def test_create_course_success(self):
        from server import create_course, CourseCreate, Course
        
        course_input = CourseCreate(title="Math 101", description="Intro to Math")
        current_user = User(
            id="teacher_1", email="teacher@test.com", name="Teacher Name", role="teacher",
            created_at=datetime.now(timezone.utc)
        )
        
        connection_mock = MagicMock()
        connection_mock.commit = AsyncMock()
        
        mock_cursor = AsyncMock()
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            # Execute
            result = await create_course(course_input, current_user)
            
            # Assertions
            self.assertIsInstance(result, Course)
            self.assertEqual(result.title, "Math 101")
            self.assertEqual(result.teacher_id, "teacher_1")
            self.assertTrue(connection_mock.commit.called)

    async def test_create_course_forbidden(self):
        from server import create_course, CourseCreate
        
        course_input = CourseCreate(title="Math 101", description="Intro to Math")
        current_user = User(
            id="student_1", email="student@test.com", name="Student Name", role="student",
            created_at=datetime.now(timezone.utc)
        )
        
        # Execute & Assert
        with self.assertRaises(HTTPException) as cm:
            await create_course(course_input, current_user)
        self.assertEqual(cm.exception.status_code, 403)
        self.assertEqual(cm.exception.detail, "Only teachers can create courses")

    async def test_grade_submission_success(self):
        from server import grade_submission, GradeSubmission
        
        submission_id = "sub_1"
        grade_input = GradeSubmission(grade=90, feedback="Good job")
        current_user = User(
            id="teacher_1", email="teacher@test.com", name="Teacher Name", role="teacher",
            created_at=datetime.now(timezone.utc)
        )
        
        connection_mock = MagicMock()
        connection_mock.commit = AsyncMock()
        
        mock_cursor = AsyncMock()
        
        submission_data = {
            "id": submission_id, 
            "assignment_id": "assign_1", 
            "student_id": "student_1",
            "student_name": "Student Name",
            "file_url": "/uploads/file.txt",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "status": "submitted"
        }
        assignment_data = {"id": "assign_1", "course_id": "course_1", "total_points": 100}
        course_data = {"id": "course_1", "teacher_id": "teacher_1"}
        updated_submission = {**submission_data, "grade": 90, "feedback": "Good job", "status": "graded"}
        
        mock_cursor.fetchone.side_effect = [submission_data, assignment_data, course_data, updated_submission]
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            # Execute
            result = await grade_submission(submission_id, grade_input, current_user)
            
            # Assertions
            self.assertIsInstance(result, Submission)
            self.assertEqual(result.grade, 90)
            self.assertEqual(result.status, "graded")
            self.assertTrue(connection_mock.commit.called)

    async def test_grade_submission_invalid_grade(self):
        from server import grade_submission, GradeSubmission
        
        submission_id = "sub_1"
        grade_input = GradeSubmission(grade=150, feedback="Too high") # > 100
        current_user = User(
            id="teacher_1", email="teacher@test.com", name="Teacher Name", role="teacher",
            created_at=datetime.now(timezone.utc)
        )
        
        connection_mock = MagicMock()
        mock_cursor = AsyncMock()
        
        submission_data = {
            "id": submission_id, 
            "assignment_id": "assign_1", 
            "student_id": "student_1",
            "student_name": "Student Name",
            "file_url": "/uploads/file.txt",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "status": "submitted"
        }
        assignment_data = {"id": "assign_1", "course_id": "course_1", "total_points": 100}
        course_data = {"id": "course_1", "teacher_id": "teacher_1"}
        
        mock_cursor.fetchone.side_effect = [submission_data, assignment_data, course_data]
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with self.assertRaises(HTTPException) as cm:
                await grade_submission(submission_id, grade_input, current_user)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertEqual(cm.exception.detail, "Invalid grade")

    async def test_submit_assignment_not_student(self):
        current_user = User(
            id="teacher_1",
            email="teacher@test.com",
            name="Teacher Name",
            role="teacher", # Wrong role
            created_at=datetime.now(timezone.utc)
        )
        file_mock = MagicMock(spec=UploadFile)
        
        with self.assertRaises(HTTPException) as cm:
            await submit_assignment("assign_1", file_mock, current_user)
        self.assertEqual(cm.exception.status_code, 403)
        self.assertEqual(cm.exception.detail, "Only students can submit assignments")

    async def test_submit_assignment_not_found(self):
        current_user = User(
            id="student_1", email="student@test.com", name="Student Name", role="student",
            created_at=datetime.now(timezone.utc)
        )
        file_mock = MagicMock(spec=UploadFile)
        
        connection_mock = MagicMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None # Assignment not found
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with self.assertRaises(HTTPException) as cm:
                await submit_assignment("assign_999", file_mock, current_user)
            self.assertEqual(cm.exception.status_code, 404)
            self.assertEqual(cm.exception.detail, "Assignment not found")

    async def test_submit_assignment_not_enrolled(self):
        current_user = User(
            id="student_1", email="student@test.com", name="Student Name", role="student",
            created_at=datetime.now(timezone.utc)
        )
        file_mock = MagicMock(spec=UploadFile)
        
        connection_mock = MagicMock()
        mock_cursor = AsyncMock()
        
        assignment_data = {"id": "assign_1", "course_id": "course_1"}
        enrollment_data = None # Not enrolled
        
        mock_cursor.fetchone.side_effect = [assignment_data, enrollment_data]
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with self.assertRaises(HTTPException) as cm:
                await submit_assignment("assign_1", file_mock, current_user)
            self.assertEqual(cm.exception.status_code, 403)
            self.assertEqual(cm.exception.detail, "Not enrolled in this course")

    async def test_submit_assignment_already_submitted(self):
        current_user = User(
            id="student_1", email="student@test.com", name="Student Name", role="student",
            created_at=datetime.now(timezone.utc)
        )
        file_mock = MagicMock(spec=UploadFile)
        
        connection_mock = MagicMock()
        mock_cursor = AsyncMock()
        
        assignment_data = {"id": "assign_1", "course_id": "course_1"}
        enrollment_data = {"id": "enroll_1"}
        existing_submission = {"id": "sub_1"} # Already submitted
        
        mock_cursor.fetchone.side_effect = [assignment_data, enrollment_data, existing_submission]
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with self.assertRaises(HTTPException) as cm:
                await submit_assignment("assign_1", file_mock, current_user)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertEqual(cm.exception.detail, "Assignment already submitted")

    async def test_grade_submission_not_teacher(self):
        from server import grade_submission, GradeSubmission
        grade_input = GradeSubmission(grade=90, feedback="Good")
        current_user = User(
            id="student_1", email="student@test.com", name="Student Name", role="student",
            created_at=datetime.now(timezone.utc)
        )
        
        with self.assertRaises(HTTPException) as cm:
            await grade_submission("sub_1", grade_input, current_user)
        self.assertEqual(cm.exception.status_code, 403)
        self.assertEqual(cm.exception.detail, "Only teachers can grade submissions")

    async def test_grade_submission_not_found(self):
        from server import grade_submission, GradeSubmission
        grade_input = GradeSubmission(grade=90, feedback="Good")
        current_user = User(
            id="teacher_1", email="teacher@test.com", name="Teacher Name", role="teacher",
            created_at=datetime.now(timezone.utc)
        )
        
        connection_mock = MagicMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = None # Submission not found
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with self.assertRaises(HTTPException) as cm:
                await grade_submission("sub_999", grade_input, current_user)
            self.assertEqual(cm.exception.status_code, 404)
            self.assertEqual(cm.exception.detail, "Submission not found")

    async def test_grade_submission_not_course_owner(self):
        from server import grade_submission, GradeSubmission
        grade_input = GradeSubmission(grade=90, feedback="Good")
        current_user = User(
            id="teacher_1", email="teacher@test.com", name="Teacher Name", role="teacher",
            created_at=datetime.now(timezone.utc)
        )
        
        connection_mock = MagicMock()
        mock_cursor = AsyncMock()
        
        submission_data = {"id": "sub_1", "assignment_id": "assign_1"}
        assignment_data = {"id": "assign_1", "course_id": "course_1"}
        course_data = None # Course not found or not owned (query includes teacher_id check)
        
        mock_cursor.fetchone.side_effect = [submission_data, assignment_data, course_data]
        
        execute_helper = AwaitableContextManager(mock_cursor)
        connection_mock.execute.return_value = execute_helper
        connect_cm = AsyncMock()
        connect_cm.__aenter__.return_value = connection_mock
        
        with patch("server.aiosqlite.connect", return_value=connect_cm):
            with self.assertRaises(HTTPException) as cm:
                await grade_submission("sub_1", grade_input, current_user)
            self.assertEqual(cm.exception.status_code, 403)
            self.assertEqual(cm.exception.detail, "Not your course")

class ColorTextTestResult(unittest.TextTestResult):
    def addSuccess(self, test):
        super().addSuccess(test)
        self.stream.writeln(f"\033[92m[PASS]\033[0m {test._testMethodName}")

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.stream.writeln(f"\033[91m[FAIL]\033[0m {test._testMethodName}")

    def addError(self, test, err):
        super().addError(test, err)
        self.stream.writeln(f"\033[91m[ERROR]\033[0m {test._testMethodName}")

class ColorTextTestRunner(unittest.TextTestRunner):
    resultclass = ColorTextTestResult

if __name__ == "__main__":
    # Disable default stderr output to avoid duplicate printing by unittest
    runner = ColorTextTestRunner(verbosity=0)
    
    if len(sys.argv) > 1:
        # Run specific test or function
        test_name = sys.argv[1]
        print(f"Running tests matching: {test_name}")
        suite = unittest.TestSuite()
        # Find tests matching the name (case-insensitive partial match)
        all_tests = unittest.TestLoader().loadTestsFromTestCase(TestCFGFunctions)
        for test in all_tests:
            if test_name.lower() in test._testMethodName.lower():
                suite.addTest(test)
        
        if suite.countTestCases() == 0:
            print(f"No tests found matching '{test_name}'")
            sys.exit(1)
    else:
        # Run all tests
        print("Running ALL tests...")
        suite = unittest.TestLoader().loadTestsFromTestCase(TestCFGFunctions)

    result = runner.run(suite)
    print(f"\nTotal Tests Run: {result.testsRun}")
    print(f"Total Passed: {result.testsRun - len(result.failures) - len(result.errors)}")
    if result.failures or result.errors:
        print(f"Total Failed/Errors: {len(result.failures) + len(result.errors)}")
