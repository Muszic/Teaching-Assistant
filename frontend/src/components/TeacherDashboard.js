import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Plus, LogOut, FileText, Users, Calendar, Award } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TeacherDashboard = ({ user, onLogout }) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  
  const [courseForm, setCourseForm] = useState({ title: "", description: "" });
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    due_date: "",
    total_points: 100
  });
  const [gradeForm, setGradeForm] = useState({ grade: 0, feedback: "" });

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

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/courses`, courseForm, axiosConfig);
      toast.success("Course created successfully!");
      setCourseForm({ title: "", description: "" });
      setCourseDialogOpen(false);
      fetchCourses();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create course");
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!selectedCourse) {
      toast.error("Please select a course first");
      return;
    }
    try {
      await axios.post(
        `${API}/assignments`,
        { ...assignmentForm, course_id: selectedCourse.id },
        axiosConfig
      );
      toast.success("Assignment created successfully!");
      setAssignmentForm({ title: "", description: "", due_date: "", total_points: 100 });
      setAssignmentDialogOpen(false);
      fetchAssignments(selectedCourse.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create assignment");
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
              <h1 className="text-2xl font-bold" style={{fontFamily: 'Space Grotesk, sans-serif'}}>TG-TAS</h1>
              <p className="text-sm text-gray-600">Teacher Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-semibold" data-testid="teacher-name">{user.name}</p>
              <p className="text-sm text-gray-600">Teacher</p>
            </div>
            <Button variant="outline" onClick={onLogout} data-testid="teacher-logout-btn">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="courses" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="teacher-tabs">
            <TabsTrigger value="courses" data-testid="tab-courses">My Courses</TabsTrigger>
            <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
          </TabsList>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-4" data-testid="courses-tab-content">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold" style={{fontFamily: 'Space Grotesk, sans-serif'}}>My Courses</h2>
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
                  className={`cursor-pointer hover:shadow-lg transition-all ${
                    selectedCourse?.id === course.id ? "ring-2 ring-indigo-600" : ""
                  }`}
                  onClick={() => setSelectedCourse(course)}
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
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(course.created_at).toLocaleDateString()}
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
                    <h2 className="text-2xl font-bold" style={{fontFamily: 'Space Grotesk, sans-serif'}} data-testid="selected-course-title">{selectedCourse.title}</h2>
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
                            placeholder="Assignment description..."
                            value={assignmentForm.description}
                            onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                            required
                            rows={3}
                            data-testid="assignment-description-input"
                          />
                        </div>
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
                            min="1"
                            value={assignmentForm.total_points}
                            onChange={(e) => setAssignmentForm({ ...assignmentForm, total_points: parseInt(e.target.value) })}
                            required
                            data-testid="assignment-points-input"
                          />
                        </div>
                        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="assignment-submit-btn">
                          Create Assignment
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Assignments List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Assignments
                    </h3>
                    {assignments.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-gray-600" data-testid="no-assignments-message">
                          No assignments yet. Create one to get started!
                        </CardContent>
                      </Card>
                    ) : (
                      assignments.map((assignment) => (
                        <Card
                          key={assignment.id}
                          className={`cursor-pointer hover:shadow-lg transition-all ${
                            selectedAssignment?.id === assignment.id ? "ring-2 ring-indigo-600" : ""
                          }`}
                          onClick={() => setSelectedAssignment(assignment)}
                          data-testid={`assignment-card-${assignment.id}`}
                        >
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-lg" data-testid={`assignment-title-${assignment.id}`}>{assignment.title}</CardTitle>
                              {selectedAssignment?.id === assignment.id && (
                                <Badge className="bg-indigo-600">Selected</Badge>
                              )}
                            </div>
                            <CardDescription data-testid={`assignment-description-${assignment.id}`}>{assignment.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex justify-between text-sm">
                              <div className="flex items-center text-gray-600">
                                <Calendar className="w-4 h-4 mr-1" />
                                Due: {assignment.due_date}
                              </div>
                              <div className="flex items-center text-gray-600">
                                <Award className="w-4 h-4 mr-1" />
                                {assignment.total_points} pts
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  {/* Submissions List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      Submissions
                    </h3>
                    {!selectedAssignment ? (
                      <Card>
                        <CardContent className="py-8 text-center text-gray-600" data-testid="select-assignment-message">
                          Select an assignment to view submissions
                        </CardContent>
                      </Card>
                    ) : submissions.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-gray-600" data-testid="no-submissions-message">
                          No submissions yet
                        </CardContent>
                      </Card>
                    ) : (
                      submissions.map((submission) => (
                        <Card key={submission.id} data-testid={`submission-card-${submission.id}`}>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg" data-testid={`submission-student-${submission.id}`}>{submission.student_name}</CardTitle>
                                <CardDescription>
                                  Submitted: {new Date(submission.submitted_at).toLocaleString()}
                                </CardDescription>
                              </div>
                              <Badge
                                className={submission.status === "graded" ? "bg-green-600" : "bg-yellow-600"}
                                data-testid={`submission-status-${submission.id}`}
                              >
                                {submission.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">File:</p>
                              <p className="text-sm font-mono bg-gray-100 p-2 rounded" data-testid={`submission-file-${submission.id}`}>{submission.file_url}</p>
                            </div>
                            {submission.status === "graded" && (
                              <>
                                <div>
                                  <p className="text-sm text-gray-600 mb-1">Grade:</p>
                                  <p className="text-lg font-bold text-green-600" data-testid={`submission-grade-${submission.id}`}>
                                    {submission.grade} / {selectedAssignment.total_points}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600 mb-1">Feedback:</p>
                                  <p className="text-sm" data-testid={`submission-feedback-${submission.id}`}>{submission.feedback}</p>
                                </div>
                              </>
                            )}
                            <Button
                              onClick={() => openGradeDialog(submission)}
                              className="w-full"
                              variant={submission.status === "graded" ? "outline" : "default"}
                              data-testid={`grade-btn-${submission.id}`}
                            >
                              {submission.status === "graded" ? "Update Grade" : "Grade Submission"}
                            </Button>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
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
              Grading submission by {selectedSubmission?.student_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGradeSubmission} className="space-y-4">
            <div>
              <Label htmlFor="grade">Grade (out of {selectedAssignment?.total_points})</Label>
              <Input
                id="grade"
                type="number"
                min="0"
                max={selectedAssignment?.total_points}
                value={gradeForm.grade}
                onChange={(e) => setGradeForm({ ...gradeForm, grade: parseInt(e.target.value) })}
                required
                data-testid="grade-input"
              />
            </div>
            <div>
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea
                id="feedback"
                placeholder="Provide feedback to the student..."
                value={gradeForm.feedback}
                onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                required
                rows={4}
                data-testid="feedback-input"
              />
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="grade-submit-btn">
              Submit Grade
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;