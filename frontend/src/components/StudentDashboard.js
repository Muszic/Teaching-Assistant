import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BookOpen,
  LogOut,
  FileText,
  Calendar,
  Award,
  CheckCircle2,
  Download,
  User,
  Trash2,
  Search,
  ArrowLeft
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API = `${BACKEND_URL}/api`;

const StudentDashboard = ({ user, onLogout, onUserUpdate }) => {
  const [allCourses, setAllCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [file, setFile] = useState(null);
  const [activeTab, setActiveTab] = useState("courses");

  // Search and Professors State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfessor, setSelectedProfessor] = useState(null);

  // Profile State
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
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
    fetchEnrolledCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchAssignments(selectedCourse.id);
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
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
      console.error("Error fetching enrolled courses:", error);
      toast.error("Failed to fetch enrolled courses");
    }
  };

  const fetchAssignments = async (courseId) => {
    try {
      const response = await axios.get(`${API}/courses/${courseId}/assignments`, axiosConfig);
      setAssignments(response.data);

      // Fetch submissions for these assignments
      const subs = {};
      for (const assignment of response.data) {
        try {
          const subResponse = await axios.get(`${API}/assignments/${assignment.id}/submissions`, axiosConfig);
          if (subResponse.data.length > 0) {
            subs[assignment.id] = subResponse.data[0];
          }
        } catch (err) {
          console.error(err);
        }
      }
      setSubmissions(subs);
    } catch (error) {
      toast.error("Failed to fetch assignments");
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      await axios.post(`${API}/courses/${courseId}/enroll`, {}, axiosConfig);
      toast.success("Enrolled successfully!");
      fetchEnrolledCourses();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to enroll");
    }
  };

  const handleUnenroll = async (e, courseId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to unregister from this course?")) {
      try {
        await axios.delete(`${API}/courses/${courseId}/enroll`, axiosConfig);
        toast.success("Unenrolled successfully");
        if (selectedCourse?.id === courseId) {
          setSelectedCourse(null);
        }
        await fetchEnrolledCourses();
      } catch (error) {
        console.error("Unenroll failed:", error);
        toast.error("Failed to unenroll");
      }
    }
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(
        `${API}/assignments/${selectedAssignment.id}/submit`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      toast.success("Assignment submitted successfully!");
      setFile(null);
      setSubmitDialogOpen(false);
      fetchAssignments(selectedCourse.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit assignment");
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

  const openSubmitDialog = (assignment) => {
    setSelectedAssignment(assignment);
    setSubmitDialogOpen(true);
  };

  const isEnrolled = (courseId) => {
    return enrolledCourses.some(course => course.id === courseId);
  };

  // Derived State
  const filteredCourses = useMemo(() => {
    if (!searchQuery) return allCourses;
    const lowerQuery = searchQuery.toLowerCase();
    return allCourses.filter(course =>
      course.title.toLowerCase().includes(lowerQuery) ||
      course.description.toLowerCase().includes(lowerQuery) ||
      course.teacher_name.toLowerCase().includes(lowerQuery)
    );
  }, [allCourses, searchQuery]);

  const professors = useMemo(() => {
    const profMap = {};
    allCourses.forEach(course => {
      if (!profMap[course.teacher_id]) {
        profMap[course.teacher_id] = {
          id: course.teacher_id,
          name: course.teacher_name,
          courses: []
        };
      }
      profMap[course.teacher_id].courses.push(course);
    });
    return Object.values(profMap);
  }, [allCourses]);

  const CourseCard = ({ course }) => (
    <Card className="hover:shadow-lg transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          {isEnrolled(course.id) && (
            <Badge className="bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Enrolled
            </Badge>
          )}
        </div>
        <CardTitle className="mt-4">{course.title}</CardTitle>
        <CardDescription>{course.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            <p><strong>Instructor:</strong> {course.teacher_name}</p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (isEnrolled(course.id)) {
                setSelectedCourse(course);
                setActiveTab("assignments");
              } else {
                handleEnroll(course.id);
              }
            }}
            variant={isEnrolled(course.id) ? "outline" : "default"}
          >
            {isEnrolled(course.id) ? "View Assignments" : "Enroll Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50" data-testid="student-dashboard-header">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>TG-TAS</h1>
              <p className="text-sm text-gray-600">Student Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-semibold" data-testid="student-name">{user.name}</p>
              <p className="text-sm text-gray-600">Student</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setProfileDialogOpen(true)} data-testid="profile-btn">
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout} data-testid="student-logout-btn">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3" data-testid="student-tabs">
            <TabsTrigger value="courses" data-testid="tab-courses">Browse Courses</TabsTrigger>
            <TabsTrigger value="professors" data-testid="tab-professors">Professors</TabsTrigger>
            <TabsTrigger value="assignments" data-testid="tab-assignments">My Assignments</TabsTrigger>
          </TabsList>

          {/* Browse Courses Tab */}
          <TabsContent value="courses" className="space-y-4" data-testid="courses-tab-content">
            <div className="flex flex-col space-y-4">
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Available Courses</h2>

              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search courses by title, description, or instructor..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="course-search-input"
                />
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No courses found matching your search.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Professors Tab */}
          <TabsContent value="professors" className="space-y-4" data-testid="professors-tab-content">
            {!selectedProfessor ? (
              <>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Our Professors</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {professors.map((prof) => (
                    <Card
                      key={prof.id}
                      className="hover:shadow-lg transition-all cursor-pointer hover:border-indigo-300"
                      onClick={() => setSelectedProfessor(prof)}
                      data-testid={`professor-card-${prof.id}`}
                    >
                      <CardContent className="p-6 flex items-center space-x-4">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-8 h-8 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">{prof.name}</h3>
                          <p className="text-sm text-gray-600">{prof.courses.length} Course{prof.courses.length !== 1 ? 's' : ''}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <Button
                  variant="ghost"
                  className="pl-0 hover:pl-2 transition-all"
                  onClick={() => setSelectedProfessor(null)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Professors
                </Button>

                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{selectedProfessor.name}</h2>
                    <p className="text-gray-600">Courses offered by this professor</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {selectedProfessor.courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              </div>
            )}
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
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>My Enrolled Courses</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {enrolledCourses.map((course) => (
                    <Card
                      key={course.id}
                      className={`cursor-pointer hover:shadow-lg transition-all ${selectedCourse?.id === course.id ? "ring-2 ring-indigo-600" : ""
                        }`}
                      onClick={() => setSelectedCourse(course)}
                      data-testid={`enrolled-course-card-${course.id}`}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg" data-testid={`enrolled-course-title-${course.id}`}>{course.title}</CardTitle>
                          <div className="flex items-center space-x-2">
                            {selectedCourse?.id === course.id && (
                              <Badge className="bg-indigo-600">Selected</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => handleUnenroll(e, course.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
                                <CardDescription data-testid={`assignment-description-${assignment.id}`}>
                                  <div dangerouslySetInnerHTML={{ __html: assignment.description }} />
                                </CardDescription>
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

                                {assignment.file_url && (
                                  <div className="mt-2 mb-2">
                                    <a
                                      href={`${BACKEND_URL}${assignment.file_url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center text-sm text-indigo-600 hover:underline"
                                      data-testid={`assignment-file-${assignment.id}`}
                                    >
                                      <Download className="w-4 h-4 mr-1" />
                                      Download Assignment File
                                    </a>
                                  </div>
                                )}

                                {submission ? (
                                  <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-sm font-semibold">Your Submission:</p>
                                    <a
                                      href={`${BACKEND_URL}${submission.file_url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center text-sm text-indigo-600 hover:underline"
                                      data-testid={`submission-file-${assignment.id}`}
                                    >
                                      <Download className="w-4 h-4 mr-1" />
                                      Download File
                                    </a>
                                    {submission.status === "graded" && (
                                      <>
                                        <div className="pt-2 border-t mt-2">
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
              <Label htmlFor="file-upload">Upload File</Label>
              <Input
                id="file-upload"
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                required
                data-testid="file-upload-input"
              />
              <p className="text-xs text-gray-500 mt-1">Upload your assignment file (PDF, Docx, etc.)</p>
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="submit-assignment-btn">
              Submit Assignment
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
    </div>
  );
};

export default StudentDashboard;