import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Users,
  FileText,
  LogOut,
  Calendar,
  Award,
  Download,
  User,
  Trash2
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API = `${BACKEND_URL}/api`;

const TeacherDashboard = ({ user, onLogout, onUserUpdate }) => {
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [activeTab, setActiveTab] = useState("courses");

  // Dialog states
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [studentsDialogOpen, setStudentsDialogOpen] = useState(false);

  // Form states
  const [courseForm, setCourseForm] = useState({ title: "", description: "" });
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    due_date: "",
    total_points: 100
  });
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [gradeForm, setGradeForm] = useState({ grade: 0, feedback: "" });
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    password: ""
  });

  const token = localStorage.getItem("token");
  const axiosConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchAssignments(selectedCourse.id);
      setSelectedAssignment(null);
      setSubmissions([]);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedAssignment) {
      fetchSubmissions(selectedAssignment.id);
    }
  }, [selectedAssignment]);

  const fetchCourses = async () => {
    try {
      const response = await axios.get(`${API}/courses`, axiosConfig);
      setCourses(response.data);
    } catch (error) {
      console.error("Error fetching courses:", error);
      toast.error("Failed to fetch courses");
    }
  };

  const fetchAssignments = async (courseId) => {
    try {
      const response = await axios.get(`${API}/courses/${courseId}/assignments`, axiosConfig);
      setAssignments(response.data);
    } catch (error) {
      toast.error("Failed to fetch assignments");
    }
  };

  const fetchSubmissions = async (assignmentId) => {
    try {
      const response = await axios.get(`${API}/assignments/${assignmentId}/submissions`, axiosConfig);
      setSubmissions(response.data);
    } catch (error) {
      toast.error("Failed to fetch submissions");
    }
  };

  const fetchEnrolledStudents = async (courseId) => {
    try {
      const response = await axios.get(`${API}/courses/${courseId}/students`, axiosConfig);
      setStudents(response.data);
      if (response.data.length === 0) {
        toast.info("No students are registered in this course");
      }
      setStudentsDialogOpen(true);
    } catch (error) {
      toast.error("Failed to fetch enrolled students");
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/courses`, courseForm, axiosConfig);
      toast.success("Course created successfully");
      setCourseForm({ title: "", description: "" });
      setCourseDialogOpen(false);
      fetchCourses();
    } catch (error) {
      toast.error("Failed to create course");
    }
  };

  const handleDeleteCourse = async (e, courseId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this course? This action cannot be undone.")) {
      try {
        await axios.delete(`${API}/courses/${courseId}`, axiosConfig);
        toast.success("Course deleted successfully");
        if (selectedCourse?.id === courseId) {
          setSelectedCourse(null);
          setActiveTab("courses");
        }
        fetchCourses();
      } catch (error) {
        toast.error("Failed to delete course");
      }
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!selectedCourse) {
      toast.error("Please select a course first");
      return;
    }

    const formData = new FormData();
    formData.append("course_id", selectedCourse.id);
    formData.append("title", assignmentForm.title);
    formData.append("description", assignmentForm.description);
    formData.append("due_date", assignmentForm.due_date);
    formData.append("total_points", assignmentForm.total_points);
    if (assignmentFile) {
      formData.append("file", assignmentFile);
    }

    try {
      await axios.post(
        `${API}/assignments`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Assignment created successfully!");
      setAssignmentForm({ title: "", description: "", due_date: "", total_points: 100 });
      setAssignmentFile(null);
      setAssignmentDialogOpen(false);
      fetchAssignments(selectedCourse.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create assignment");
    }
  };

  const handleDeleteAssignment = async (e, assignmentId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this assignment?")) {
      try {
        await axios.delete(`${API}/assignments/${assignmentId}`, axiosConfig);
        toast.success("Assignment deleted successfully");
        if (selectedAssignment?.id === assignmentId) {
          setSelectedAssignment(null);
        }
        fetchAssignments(selectedCourse.id);
      } catch (error) {
        toast.error("Failed to delete assignment");
      }
    }
  };

  const handleGradeSubmission = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${API}/submissions/${selectedSubmission.id}/grade`,
        gradeForm,
        axiosConfig
      );
      toast.success("Submission graded successfully!");
      setGradeForm({ grade: 0, feedback: "" });
      setGradeDialogOpen(false);
      fetchSubmissions(selectedAssignment.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to grade submission");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const payload = {};
      if (profileForm.name) payload.name = profileForm.name;
      if (profileForm.password) payload.password = profileForm.password;

      const response = await axios.put(`${API}/auth/profile`, payload, axiosConfig);
      toast.success("Profile updated successfully");
      if (onUserUpdate) {
        onUserUpdate(response.data);
      }
      setProfileDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  const openGradeDialog = (submission) => {
    setSelectedSubmission(submission);
    setGradeForm({
      grade: submission.grade || 0,
      feedback: submission.feedback || ""
    });
    setGradeDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50" data-testid="teacher-dashboard-header">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>TG-TAS</h1>
              <p className="text-sm text-gray-600">Teacher Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-semibold" data-testid="teacher-name">{user.name}</p>
              <p className="text-sm text-gray-600">Teacher</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setProfileDialogOpen(true)} data-testid="profile-btn">
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout} data-testid="teacher-logout-btn">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="teacher-tabs">
            <TabsTrigger value="courses" data-testid="tab-courses">My Courses</TabsTrigger>
            <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
          </TabsList>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-4" data-testid="courses-tab-content">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>My Courses</h2>
              <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-indigo-600 hover:bg-indigo-700" data-testid="create-course-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Course
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="create-course-dialog">
                  <DialogHeader>
                    <DialogTitle>Create New Course</DialogTitle>
                    <DialogDescription>Fill in the details to create a new course</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateCourse} className="space-y-4">
                    <div>
                      <Label htmlFor="course-title">Course Title</Label>
                      <Input
                        id="course-title"
                        placeholder="Introduction to Computer Science"
                        value={courseForm.title}
                        onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                        required
                        data-testid="course-title-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="course-description">Description</Label>
                      <Textarea
                        id="course-description"
                        placeholder="Course description..."
                        value={courseForm.description}
                        onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                        required
                        rows={4}
                        data-testid="course-description-input"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="course-submit-btn">
                      Create Course
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Card
                  key={course.id}
                  className={`cursor-pointer hover:shadow-lg transition-all ${selectedCourse?.id === course.id ? "ring-2 ring-indigo-600" : ""
                    }`}
                  onClick={() => {
                    setSelectedCourse(course);
                    setActiveTab("assignments");
                  }}
                  data-testid={`course-card-${course.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-indigo-600" />
                      </div>
                      {selectedCourse?.id === course.id && (
                        <Badge className="bg-indigo-600">Selected</Badge>
                      )}
                    </div>
                    <CardTitle className="mt-4" data-testid={`course-title-${course.id}`}>{course.title}</CardTitle>
                    <CardDescription data-testid={`course-description-${course.id}`}>{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-gray-600 mb-4">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(course.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchEnrolledStudents(course.id);
                        }}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Students
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => handleDeleteCourse(e, course.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4" data-testid="assignments-tab-content">
            {!selectedCourse ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600" data-testid="select-course-message">Please select a course from the Courses tab to manage assignments</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="selected-course-title">{selectedCourse.title}</h2>
                    <p className="text-gray-600">Manage assignments and submissions</p>
                  </div>
                  <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-indigo-600 hover:bg-indigo-700" data-testid="create-assignment-btn">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Assignment
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="create-assignment-dialog">
                      <DialogHeader>
                        <DialogTitle>Create New Assignment</DialogTitle>
                        <DialogDescription>Create an assignment for {selectedCourse.title}</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateAssignment} className="space-y-4">
                        <div>
                          <Label htmlFor="assignment-title">Assignment Title</Label>
                          <Input
                            id="assignment-title"
                            placeholder="Homework 1"
                            value={assignmentForm.title}
                            onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                            required
                            data-testid="assignment-title-input"
                          />
                        </div>
                        <div>
                          <Label htmlFor="assignment-description">Description</Label>
                          <Textarea
                            id="assignment-description"
                            placeholder="Assignment instructions..."
                            value={assignmentForm.description}
                            onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                            required
                            rows={4}
                            data-testid="assignment-description-input"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="due-date">Due Date</Label>
                            <Input
                              id="due-date"
                              type="date"
                              value={assignmentForm.due_date}
                              onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                              required
                              data-testid="assignment-due-date-input"
                            />
                          </div>
                          <div>
                            <Label htmlFor="total-points">Total Points</Label>
                            <Input
                              id="total-points"
                              type="number"
                              value={assignmentForm.total_points}
                              onChange={(e) => setAssignmentForm({ ...assignmentForm, total_points: e.target.value })}
                              required
                              data-testid="assignment-points-input"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="file-upload">Attachment (Optional)</Label>
                          <Input
                            id="file-upload"
                            type="file"
                            onChange={(e) => setAssignmentFile(e.target.files[0])}
                            data-testid="assignment-file-input"
                          />
                        </div>
                        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="assignment-submit-btn">
                          Create Assignment
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {assignments.map((assignment) => (
                    <Card key={assignment.id} data-testid={`assignment-card-${assignment.id}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg" data-testid={`assignment-title-${assignment.id}`}>{assignment.title}</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => handleDeleteAssignment(e, assignment.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <CardDescription data-testid={`assignment-description-${assignment.id}`}>
                          <div dangerouslySetInnerHTML={{ __html: assignment.description }} />
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between text-sm text-gray-600 mb-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Due: {assignment.due_date}
                          </div>
                          <div className="flex items-center">
                            <Award className="w-4 h-4 mr-1" />
                            {assignment.total_points} pts
                          </div>
                        </div>
                        {assignment.file_url && (
                          <div className="mb-4">
                            <a
                              href={`${API.replace('/api', '')}${assignment.file_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-sm text-indigo-600 hover:underline"
                              data-testid={`assignment-file-${assignment.id}`}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download Attachment
                            </a>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setSelectedAssignment(assignment);
                            fetchSubmissions(assignment.id);
                          }}
                          data-testid={`view-submissions-btn-${assignment.id}`}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View Submissions
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedAssignment && (
                  <div className="mt-8 border-t pt-8">
                    <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      Submissions for {selectedAssignment.title}
                    </h3>
                    {submissions.length === 0 ? (
                      <p className="text-gray-600" data-testid="no-submissions-message">No submissions yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {submissions.map((submission) => (
                          <Card key={submission.id} data-testid={`submission-card-${submission.id}`}>
                            <CardContent className="p-4 flex justify-between items-center">
                              <div>
                                <p className="font-semibold" data-testid={`submission-student-${submission.id}`}>{submission.student_name}</p>
                                <p className="text-sm text-gray-600">
                                  Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                                </p>
                                <a
                                  href={`${API.replace('/api', '')}${submission.file_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center text-sm text-indigo-600 hover:underline mt-1"
                                  data-testid={`submission-file-${submission.id}`}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  View Submission
                                </a>
                              </div>
                              <div className="text-right">
                                {submission.status === "graded" ? (
                                  <div>
                                    <p className="font-bold text-green-600" data-testid={`submission-grade-${submission.id}`}>
                                      {submission.grade} / {selectedAssignment.total_points}
                                    </p>
                                    <p className="text-sm text-gray-600">Graded</p>
                                  </div>
                                ) : (
                                  <Button onClick={() => openGradeDialog(submission)} data-testid={`grade-btn-${submission.id}`}>
                                    Grade
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Grade Dialog */}
      <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
        <DialogContent data-testid="grade-dialog">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              Grading submission for {selectedAssignment?.title}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGradeSubmission} className="space-y-4">
            <div>
              <Label htmlFor="grade">Grade (out of {selectedAssignment?.total_points})</Label>
              <Input
                id="grade"
                type="number"
                max={selectedAssignment?.total_points}
                value={gradeForm.grade}
                onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
                required
                data-testid="grade-input"
              />
            </div>
            <div>
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea
                id="feedback"
                placeholder="Enter feedback..."
                value={gradeForm.feedback}
                onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                rows={4}
                data-testid="feedback-input"
              />
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="submit-grade-btn">
              Submit Grade
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent data-testid="profile-dialog">
          <DialogHeader>
            <DialogTitle>Update Profile</DialogTitle>
            <DialogDescription>Update your personal information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                required
                data-testid="profile-name-input"
              />
            </div>
            <div>
              <Label htmlFor="profile-password">New Password (optional)</Label>
              <Input
                id="profile-password"
                type="password"
                placeholder="Leave blank to keep current"
                value={profileForm.password}
                onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                data-testid="profile-password-input"
              />
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="profile-submit-btn">
              Update Profile
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Students Dialog */}
      <Dialog open={studentsDialogOpen} onOpenChange={setStudentsDialogOpen}>
        <DialogContent className="max-w-3xl" data-testid="students-dialog">
          <DialogHeader>
            <DialogTitle>Enrolled Students</DialogTitle>
            <DialogDescription>
              Students enrolled in this course
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {students.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No students enrolled yet.</p>
            ) : (
              <div className="grid gap-4">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.email}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Enrolled: {new Date(student.enrolled_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;