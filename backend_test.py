import requests
import sys
import json
from datetime import datetime, timedelta

class TGTASAPITester:
    def __init__(self, base_url="https://assignmate-17.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.teacher_token = None
        self.student_token = None
        self.teacher_user = None
        self.student_user = None
        self.course_id = None
        self.assignment_id = None
        self.submission_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        result = f"{status} - {name}"
        if details:
            result += f" | {details}"
        
        print(result)
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })
        return success

    def make_request(self, method, endpoint, data=None, token=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            
            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_teacher_registration(self):
        """Test teacher registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        teacher_data = {
            "email": f"teacher_{timestamp}@test.com",
            "password": "TestPass123!",
            "name": f"Test Teacher {timestamp}",
            "role": "teacher"
        }
        
        success, response, status_code = self.make_request("POST", "auth/register", teacher_data, expected_status=200)
        
        if success and 'access_token' in response:
            self.teacher_token = response['access_token']
            self.teacher_user = response['user']
            return self.log_test("Teacher Registration", True, f"Teacher ID: {self.teacher_user['id']}")
        else:
            return self.log_test("Teacher Registration", False, f"Status: {status_code}, Response: {response}")

    def test_student_registration(self):
        """Test student registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        student_data = {
            "email": f"student_{timestamp}@test.com",
            "password": "TestPass123!",
            "name": f"Test Student {timestamp}",
            "role": "student"
        }
        
        success, response, status_code = self.make_request("POST", "auth/register", student_data, expected_status=200)
        
        if success and 'access_token' in response:
            self.student_token = response['access_token']
            self.student_user = response['user']
            return self.log_test("Student Registration", True, f"Student ID: {self.student_user['id']}")
        else:
            return self.log_test("Student Registration", False, f"Status: {status_code}, Response: {response}")

    def test_teacher_login(self):
        """Test teacher login"""
        login_data = {
            "email": self.teacher_user['email'],
            "password": "TestPass123!"
        }
        
        success, response, status_code = self.make_request("POST", "auth/login", login_data, expected_status=200)
        
        if success and 'access_token' in response:
            return self.log_test("Teacher Login", True, "Login successful")
        else:
            return self.log_test("Teacher Login", False, f"Status: {status_code}, Response: {response}")

    def test_student_login(self):
        """Test student login"""
        login_data = {
            "email": self.student_user['email'],
            "password": "TestPass123!"
        }
        
        success, response, status_code = self.make_request("POST", "auth/login", login_data, expected_status=200)
        
        if success and 'access_token' in response:
            return self.log_test("Student Login", True, "Login successful")
        else:
            return self.log_test("Student Login", False, f"Status: {status_code}, Response: {response}")

    def test_get_current_user(self):
        """Test get current user endpoint"""
        success, response, status_code = self.make_request("GET", "auth/me", token=self.teacher_token, expected_status=200)
        
        if success and response.get('id') == self.teacher_user['id']:
            return self.log_test("Get Current User", True, "User data retrieved correctly")
        else:
            return self.log_test("Get Current User", False, f"Status: {status_code}, Response: {response}")

    def test_create_course(self):
        """Test course creation by teacher"""
        course_data = {
            "title": "Introduction to Computer Science",
            "description": "A comprehensive course covering fundamental concepts of computer science including programming, algorithms, and data structures."
        }
        
        success, response, status_code = self.make_request("POST", "courses", course_data, token=self.teacher_token, expected_status=200)
        
        if success and 'id' in response:
            self.course_id = response['id']
            return self.log_test("Create Course", True, f"Course ID: {self.course_id}")
        else:
            return self.log_test("Create Course", False, f"Status: {status_code}, Response: {response}")

    def test_get_courses(self):
        """Test getting courses"""
        success, response, status_code = self.make_request("GET", "courses", token=self.teacher_token, expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            return self.log_test("Get Courses", True, f"Found {len(response)} courses")
        else:
            return self.log_test("Get Courses", False, f"Status: {status_code}, Response: {response}")

    def test_student_enroll_course(self):
        """Test student enrolling in course"""
        success, response, status_code = self.make_request("POST", f"courses/{self.course_id}/enroll", {}, token=self.student_token, expected_status=200)
        
        if success and response.get('message'):
            return self.log_test("Student Enroll Course", True, "Enrollment successful")
        else:
            return self.log_test("Student Enroll Course", False, f"Status: {status_code}, Response: {response}")

    def test_get_enrolled_courses(self):
        """Test getting enrolled courses for student"""
        success, response, status_code = self.make_request("GET", "courses/enrolled/my", token=self.student_token, expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            return self.log_test("Get Enrolled Courses", True, f"Student enrolled in {len(response)} courses")
        else:
            return self.log_test("Get Enrolled Courses", False, f"Status: {status_code}, Response: {response}")

    def test_create_assignment(self):
        """Test assignment creation by teacher"""
        due_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        assignment_data = {
            "course_id": self.course_id,
            "title": "Programming Assignment 1",
            "description": "Write a Python program that implements basic sorting algorithms",
            "due_date": due_date,
            "total_points": 100
        }
        
        success, response, status_code = self.make_request("POST", "assignments", assignment_data, token=self.teacher_token, expected_status=200)
        
        if success and 'id' in response:
            self.assignment_id = response['id']
            return self.log_test("Create Assignment", True, f"Assignment ID: {self.assignment_id}")
        else:
            return self.log_test("Create Assignment", False, f"Status: {status_code}, Response: {response}")

    def test_get_course_assignments(self):
        """Test getting assignments for a course"""
        success, response, status_code = self.make_request("GET", f"courses/{self.course_id}/assignments", token=self.student_token, expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            return self.log_test("Get Course Assignments", True, f"Found {len(response)} assignments")
        else:
            return self.log_test("Get Course Assignments", False, f"Status: {status_code}, Response: {response}")

    def test_submit_assignment(self):
        """Test assignment submission by student"""
        submission_data = {
            "file_url": "s3://mock-bucket/assignments/student_submission.py"
        }
        
        success, response, status_code = self.make_request("POST", f"assignments/{self.assignment_id}/submit", submission_data, token=self.student_token, expected_status=200)
        
        if success and 'id' in response:
            self.submission_id = response['id']
            return self.log_test("Submit Assignment", True, f"Submission ID: {self.submission_id}")
        else:
            return self.log_test("Submit Assignment", False, f"Status: {status_code}, Response: {response}")

    def test_get_assignment_submissions(self):
        """Test getting submissions for an assignment"""
        success, response, status_code = self.make_request("GET", f"assignments/{self.assignment_id}/submissions", token=self.teacher_token, expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            return self.log_test("Get Assignment Submissions", True, f"Found {len(response)} submissions")
        else:
            return self.log_test("Get Assignment Submissions", False, f"Status: {status_code}, Response: {response}")

    def test_grade_submission(self):
        """Test grading submission by teacher"""
        grade_data = {
            "grade": 85,
            "feedback": "Good work! Your implementation is correct but could be optimized for better performance."
        }
        
        success, response, status_code = self.make_request("PUT", f"submissions/{self.submission_id}/grade", grade_data, token=self.teacher_token, expected_status=200)
        
        if success and response.get('grade') == 85:
            return self.log_test("Grade Submission", True, f"Grade: {response.get('grade')}")
        else:
            return self.log_test("Grade Submission", False, f"Status: {status_code}, Response: {response}")

    def test_student_view_grade(self):
        """Test student viewing their grade"""
        success, response, status_code = self.make_request("GET", f"assignments/{self.assignment_id}/submissions", token=self.student_token, expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            submission = response[0]
            if submission.get('grade') == 85 and submission.get('status') == 'graded':
                return self.log_test("Student View Grade", True, f"Grade: {submission.get('grade')}, Status: {submission.get('status')}")
            else:
                return self.log_test("Student View Grade", False, f"Grade not found or incorrect: {submission}")
        else:
            return self.log_test("Student View Grade", False, f"Status: {status_code}, Response: {response}")

    def test_invalid_role_registration(self):
        """Test registration with invalid role"""
        invalid_data = {
            "email": "invalid@test.com",
            "password": "TestPass123!",
            "name": "Invalid User",
            "role": "admin"  # Invalid role
        }
        
        success, response, status_code = self.make_request("POST", "auth/register", invalid_data, expected_status=400)
        
        if not success and status_code == 400:
            return self.log_test("Invalid Role Registration", True, "Correctly rejected invalid role")
        else:
            return self.log_test("Invalid Role Registration", False, f"Should have failed with 400, got {status_code}")

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        success, response, status_code = self.make_request("GET", "courses", expected_status=401)
        
        if not success and status_code == 401:
            return self.log_test("Unauthorized Access", True, "Correctly rejected unauthorized request")
        else:
            return self.log_test("Unauthorized Access", False, f"Should have failed with 401, got {status_code}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting TG-TAS Backend API Tests")
        print("=" * 50)
        
        # Authentication Tests
        print("\n📝 Authentication Tests")
        if not self.test_teacher_registration():
            return False
        if not self.test_student_registration():
            return False
        if not self.test_teacher_login():
            return False
        if not self.test_student_login():
            return False
        if not self.test_get_current_user():
            return False
        
        # Course Management Tests
        print("\n📚 Course Management Tests")
        if not self.test_create_course():
            return False
        if not self.test_get_courses():
            return False
        if not self.test_student_enroll_course():
            return False
        if not self.test_get_enrolled_courses():
            return False
        
        # Assignment Tests
        print("\n📋 Assignment Tests")
        if not self.test_create_assignment():
            return False
        if not self.test_get_course_assignments():
            return False
        if not self.test_submit_assignment():
            return False
        if not self.test_get_assignment_submissions():
            return False
        if not self.test_grade_submission():
            return False
        if not self.test_student_view_grade():
            return False
        
        # Error Handling Tests
        print("\n🛡️ Error Handling Tests")
        self.test_invalid_role_registration()
        self.test_unauthorized_access()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 All tests passed! Backend API is working correctly.")
        else:
            print(f"\n⚠️ {self.tests_run - self.tests_passed} tests failed. Check the details above.")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TGTASAPITester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        return 0 if success else 1
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())