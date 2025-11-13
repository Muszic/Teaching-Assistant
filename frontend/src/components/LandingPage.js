import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Award, CheckCircle } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold" style={{fontFamily: 'Space Grotesk, sans-serif'}}>TG-TAS</h1>
          </div>
          <div className="space-x-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/login")}
              data-testid="header-login-btn"
            >
              Login
            </Button>
            <Button
              onClick={() => navigate("/register")}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="header-register-btn"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center animate-fade-in">
        <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6" style={{fontFamily: 'Space Grotesk, sans-serif'}}>
          Teaching Assistant System
        </h2>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Streamline your educational workflow with our comprehensive assignment management platform.
          Create courses, manage assignments, and track student progress all in one place.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Button
            size="lg"
            onClick={() => navigate("/register")}
            className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-6"
            data-testid="hero-get-started-btn"
          >
            Get Started Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/login")}
            className="text-lg px-8 py-6"
            data-testid="hero-login-btn"
          >
            Sign In
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow animate-slide-in" data-testid="feature-course-management">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3" style={{fontFamily: 'Space Grotesk, sans-serif'}}>Course Management</h3>
            <p className="text-gray-600">
              Create and organize courses effortlessly. Teachers can set up structured learning paths for their students.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow animate-slide-in" style={{animationDelay: '0.1s'}} data-testid="feature-assignment-tracking">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <Award className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3" style={{fontFamily: 'Space Grotesk, sans-serif'}}>Assignment Tracking</h3>
            <p className="text-gray-600">
              Monitor submission status, provide detailed feedback, and grade assignments with ease.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow animate-slide-in" style={{animationDelay: '0.2s'}} data-testid="feature-student-portal">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3" style={{fontFamily: 'Space Grotesk, sans-serif'}}>Student Portal</h3>
            <p className="text-gray-600">
              Students can enroll in courses, submit assignments, and view their grades and feedback in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16 mb-16">
        <div className="bg-white rounded-3xl p-12 shadow-xl">
          <h3 className="text-3xl font-bold text-center mb-10" style={{fontFamily: 'Space Grotesk, sans-serif'}}>Why Choose TG-TAS?</h3>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex items-start space-x-3" data-testid="benefit-easy-setup">
              <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Easy Setup</h4>
                <p className="text-gray-600 text-sm">Get started in minutes with our intuitive interface</p>
              </div>
            </div>
            <div className="flex items-start space-x-3" data-testid="benefit-real-time">
              <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Real-time Updates</h4>
                <p className="text-gray-600 text-sm">Stay informed with instant notifications</p>
              </div>
            </div>
            <div className="flex items-start space-x-3" data-testid="benefit-secure">
              <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Secure & Reliable</h4>
                <p className="text-gray-600 text-sm">Your data is protected with industry-standard security</p>
              </div>
            </div>
            <div className="flex items-start space-x-3" data-testid="benefit-collaborative">
              <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Collaborative</h4>
                <p className="text-gray-600 text-sm">Facilitate better communication between teachers and students</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">© 2025 TG-TAS. Teaching Assistant System.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;