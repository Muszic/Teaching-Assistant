import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, LogOut, FileText, Calendar, Award, CheckCircle2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StudentDashboard = ({ user, onLogout }) => {
  const [allCourses, setAllCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [fileUrl, setFileUrl] = useState("");

  const token = localStorage.getItem("token");
  const axiosConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchAllCourses();
    fetchEnrolledCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchAssignments(selectedCourse.id);
    }
  }, [selectedCourse]);

  const fetchAllCourses = async () => {
    try {
      const response = await axios.get(`${API}/courses`, axiosConfig);
      setAllCourses(response.data);
    } catch (error) {
      toast.error("Failed to fetch courses");
    }
  };

  const fetchEnrolledCourses = async () => {
    try {
      const response = await axios.get(`${API}/courses/enrolled/my`, axiosConfig);
      setEnrolledCourses(response.data);
    } catch (error) {
      toast.error("Failed to fetch enrolled courses");
    }
  };

  const fetchAssignments = async (courseId) => {
    try {
      const response = await axios.get(`${API}/courses/${courseId}/assignments`, axiosConfig);
      setAssignments(response.data);
      
      // Fetch submissions for each assignment
      const submissionsPromises = response.data.map(assignment =>
        axios.get(`${API}/assignments/${assignment.id}/submissions`, axiosConfig)
          .then(res => ({ assignmentId: assignment.id, submissions: res.data }))
      );
      const allSubmissions = await Promise.all(submissionsPromises);
      const submissionsMap = {};
      allSubmissions.forEach(item => {
        submissionsMap[item.assignmentId] = item.submissions[0] || null;
      });
      setSubmissions(submissionsMap);
    } catch (error) {
      toast.error("Failed to fetch assignments");
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      await axios.post(`${API}/courses/${courseId}/enroll`, {}, axiosConfig);
      toast.success("Successfully enrolled in course!");
      fetchEnrolledCourses();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to enroll in course");
    }
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API}/assignments/${selectedAssignment.id}/submit`,
        { file_url: fileUrl },
        axiosConfig
      );
      toast.success("Assignment submitted successfully!");
      setFileUrl("");
      setSubmitDialogOpen(false);
      fetchAssignments(selectedCourse.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit assignment");
    }
  };

  const openSubmitDialog = (assignment) => {
    setSelectedAssignment(assignment);
    setSubmitDialogOpen(true);
  };

  const isEnrolled = (courseId) => {
    return enrolledCourses.some(course => course.id === courseId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50" data-testid="student-dashboard-header">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold" style={{fontFamily: 'Space Grotesk, sans-serif'}}>TG-TAS</h1>
              <p className="text-sm text-gray-600">Student Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-semibold" data-testid="student-name">{user.name}</p>
              <p className="text-sm text-gray-600">Student</p>
            </div>
            <Button variant="outline" onClick={onLogout} data-testid="student-logout-btn">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="courses" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="student-tabs">
            <TabsTrigger value="courses" data-testid="tab-courses">Browse Courses</TabsTrigger>
            <TabsTrigger value="assignments" data-testid="tab-assignments">My Assignments</TabsTrigger>
          </TabsList>

          {/* Browse Courses Tab */}
          <TabsContent value="courses" className="space-y-4" data-testid="courses-tab-content">
            <h2 className="text-2xl font-bold" style={{fontFamily: 'Space Grotesk, sans-serif'}}>Available Courses</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allCourses.map((course) => (
                <Card key={course.id} className="hover:shadow-lg transition-all" data-testid={`course-card-${course.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-indigo-600" />
                      </div>
                      {isEnrolled(course.id) && (
                        <Badge className="bg-green-600" data-testid={`enrolled-badge-${course.id}`}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Enrolled
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-4" data-testid={`course-title-${course.id}`}>{course.title}</CardTitle>
                    <CardDescription data-testid={`course-description-${course.id}`}>{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        <p><strong>Instructor:</strong> {course.teacher_name}</p>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => isEnrolled(course.id) ? setSelectedCourse(course) : handleEnroll(course.id)}
                        variant={isEnrolled(course.id) ? "outline" : "default"}
                        data-testid={`course-action-btn-${course.id}`}
                      >
                        {isEnrolled(course.id) ? "View Assignments" : "Enroll Now"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* My Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4" data-testid="assignments-tab-content">
            {enrolledCourses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600" data-testid="no-enrolled-courses-message">You haven't enrolled in any courses yet. Browse courses to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <h2 className="text-2xl font-bold" style={{fontFamily: 'Space Grotesk, sans-serif'}}>My Enrolled Courses</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {enrolledCourses.map((course) => (
                    <Card
                      key={course.id}
                      className={`cursor-pointer hover:shadow-lg transition-all ${
                        selectedCourse?.id === course.id ? "ring-2 ring-indigo-600" : ""
                      }`}
                      onClick={() => setSelectedCourse(course)}
                      data-testid={`enrolled-course-card-${course.id}`}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg" data-testid={`enrolled-course-title-${course.id}`}>{course.title}</CardTitle>
                          {selectedCourse?.id === course.id && (
                            <Badge className="bg-indigo-600">Selected</Badge>
                          )}
                        </div>
                        <CardDescription>by {course.teacher_name}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>

                {selectedCourse && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Assignments for {selectedCourse.title}
                    </h3>
                    {assignments.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-gray-600" data-testid="no-assignments-message">
                          No assignments yet for this course
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-6">
                        {assignments.map((assignment) => {
                          const submission = submissions[assignment.id];
                          return (
                            <Card key={assignment.id} data-testid={`assignment-card-${assignment.id}`}>
                              <CardHeader>
                                <div className="flex justify-between items-start">
                                  <CardTitle className="text-lg" data-testid={`assignment-title-${assignment.id}`}>{assignment.title}</CardTitle>
                                  {submission && (
                                    <Badge
                                      className={submission.status === "graded" ? "bg-green-600" : "bg-blue-600"}
                                      data-testid={`assignment-status-${assignment.id}`}
                                    >
                                      {submission.status}
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription data-testid={`assignment-description-${assignment.id}`}>{assignment.description}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-3">
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

                                {submission ? (
                                  <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-sm font-semibold">Your Submission:</p>
                                    <p className="text-sm font-mono text-gray-600" data-testid={`submission-file-${assignment.id}`}>{submission.file_url}</p>
                                    {submission.status === "graded" && (
                                      <>
                                        <div className="pt-2 border-t">
                                          <p className="text-sm font-semibold mb-1">Grade:</p>
                                          <p className="text-2xl font-bold text-green-600" data-testid={`submission-grade-${assignment.id}`}>
                                            {submission.grade} / {assignment.total_points}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold mb-1">Feedback:</p>
                                          <p className="text-sm text-gray-700" data-testid={`submission-feedback-${assignment.id}`}>{submission.feedback}</p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <Button
                                    onClick={() => openSubmitDialog(assignment)}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                    data-testid={`submit-btn-${assignment.id}`}
                                  >
                                    Submit Assignment
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Submit Assignment Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent data-testid="submit-dialog">
          <DialogHeader>
            <DialogTitle>Submit Assignment</DialogTitle>
            <DialogDescription>
              Submitting: {selectedAssignment?.title}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAssignment} className="space-y-4">
            <div>
              <Label htmlFor="file-url">File Path (Mock)</Label>
              <Input
                id="file-url"
                placeholder="s3://bucket/path/to/file.pdf"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                required
                data-testid="file-url-input"
              />
              <p className="text-xs text-gray-500 mt-1">Enter a mock file path (e.g., s3://mock/assignment.pdf)</p>
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="submit-assignment-btn">
              Submit Assignment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentDashboard;