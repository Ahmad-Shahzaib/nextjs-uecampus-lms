import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookOpen, Clock, PlayCircle, CheckCircle2, AlertCircle, Trash2, Copy, Edit2 } from "lucide-react";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import LMSGuides from "@/components/LMSGuides";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useEditMode } from "@/contexts/EditModeContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface Course {
  id: string;
  title: string;
  code: string;
  progress: number;
  instructor: string | null;
  next_class: string | null;
  grade: string | null;
}

export default function Dashboard() {
  const { isEditMode, isAdmin, isEditor } = useEditMode();
  const isPrivileged = isAdmin || isEditor;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({
    totalActivity: 0,
    inProgress: 0,
    completed: 0,
    totalCourses: 0
  });
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState<"assignments" | "quizzes" | null>(null);

  useEffect(() => {
    if (user) {
      // UI-only demo data (no backend)
      const sampleCourses: Course[] = [
        { id: "c1", title: "Introduction to Biology", code: "BIO101", progress: 42, instructor: "Dr. A", next_class: null, grade: null },
        { id: "c2", title: "Calculus I", code: "MATH101", progress: 75, instructor: "Prof. B", next_class: null, grade: null },
        { id: "c3", title: "Intro to Programming", code: "CS101", progress: 18, instructor: "Ms. C", next_class: null, grade: null },
      ];
      // Sample assignments (static UI-only)
      const sampleAssignments = [
        { id: "a1", title: "Essay on Cell Structure", points: 100, attempts: 1, due_date: "2026-02-20" },
        { id: "a2", title: "Calculus Problem Set 1", points: 50, attempts: 3, due_date: "2026-02-22" },
        { id: "a3", title: "Programming: Hello World Project", points: 20, attempts: 2, due_date: "2026-02-25" },
      ];

      // Sample quizzes (static UI-only)
      const sampleQuizzes = [
        { id: "q1", title: "Biology Basics Quiz", duration: 30, due_date: "2026-02-18" },
        { id: "q2", title: "Limits & Continuity Quiz", duration: 20, due_date: "2026-02-21" },
        { id: "q3", title: "Intro to JS Quiz", duration: 15, due_date: "2026-02-23" },
      ];

      setCourses(sampleCourses);
      setAssignments(sampleAssignments);
      setQuizzes(sampleQuizzes);

      // Update simple stats derived from the sample courses
      const totalCourses = sampleCourses.length;
      const totalActivity = totalCourses
        ? Math.round(sampleCourses.reduce((s, c) => s + (c.progress || 0), 0) / totalCourses)
        : 0;
      const inProgress = sampleCourses.filter((c) => (c.progress ?? 0) > 0 && (c.progress ?? 0) < 100).length;
      const completed = sampleCourses.filter((c) => (c.progress ?? 0) >= 100).length;
      setStats({ totalActivity, inProgress, completed, totalCourses });
    }
  }, [user, isPrivileged]);
  // Removed backend fetches for UI-only build. Data is initialized locally.

  const fetchAssignments = async () => {
    // no-op in UI-only mode
    return;
  };

  const fetchQuizzes = async () => {
    // no-op in UI-only mode
    return;
  };

  const updateCourse = async (id: string, field: string, value: any) => {
    // Local-only update (no backend)
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    toast.success("Updated locally (UI-only)");
  };

  const deleteCourse = async (id: string) => {
    // Local-only delete
    setCourses((prev) => prev.filter((c) => c.id !== id));
    toast.success("Removed locally (UI-only)");
  };

  const duplicateCourse = async (course: Course) => {
    const copy: Course = {
      ...course,
      id: `${course.id}-copy-${Date.now()}`,
      title: `${course.title} (Copy)`,
    };
    setCourses((prev) => [copy, ...prev]);
    toast.success("Duplicated locally (UI-only)");
  };

  const renderAssignmentItem = (assignment: any) => (
    <Card key={assignment?.id || assignment?.title} className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{assignment.title || "Untitled Assignment"}</h3>
          <p className="text-sm text-muted-foreground">
            Points: {assignment.points ?? "N/A"} · Attempts: {assignment.attempts ?? 0}
          </p>
        </div>
        {assignment.due_date && (
          <span className="text-xs text-muted-foreground">
            Due {new Date(assignment.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </Card>
  );

  const renderQuizItem = (quiz: any) => (
    <Card key={quiz?.id || quiz?.title} className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{quiz.title || "Untitled Quiz"}</h3>
          <p className="text-sm text-muted-foreground">Duration: {quiz.duration ?? "N/A"} mins</p>
        </div>
        {quiz.due_date && (
          <span className="text-xs text-muted-foreground">
            Due {new Date(quiz.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <WelcomeDialog />
      
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {isEditMode && (
          <Badge variant="outline" className="animate-pulse">
            <Edit2 className="h-3 w-3 mr-1" />
            Edit Mode Active
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6 bg-gradient-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-muted-foreground">Total Activity</h3>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="text-4xl font-bold">{stats.totalActivity}%</div>
        </Card>

        <Card className="p-6 bg-gradient-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-muted-foreground">In Progress</h3>
            <AlertCircle className="h-4 w-4 text-primary" />
          </div>
          <div className="text-4xl font-bold">{stats.inProgress}</div>
        </Card>

        <Card className="p-6 bg-gradient-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-muted-foreground">Completed</h3>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div className="text-4xl font-bold">{stats.completed}</div>
        </Card>

        <Card className="p-6 bg-gradient-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-muted-foreground">Total Courses</h3>
            <BookOpen className="h-4 w-4 text-accent" />
          </div>
          <div className="text-4xl font-bold">{stats.totalCourses}</div>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Enrolled Courses</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="p-6 hover:shadow-glow transition-all bg-gradient-card group relative">
              {isEditMode && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    onClick={() => duplicateCourse(course)}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => deleteCourse(course.id)}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="space-y-4">
                {isEditMode ? (
                  <>
                    <Input
                      value={course.code}
                      onChange={(e) => updateCourse(course.id, "code", e.target.value)}
                      placeholder="Course Code"
                    />
                    <Input
                      value={course.title}
                      onChange={(e) => updateCourse(course.id, "title", e.target.value)}
                      placeholder="Course Title"
                    />
                    <Input
                      type="number"
                      value={course.progress}
                      onChange={(e) => updateCourse(course.id, "progress", parseInt(e.target.value))}
                      placeholder="Progress %"
                    />
                  </>
                ) : (
                  <>
                    <Badge variant="secondary">{course.code}</Badge>
                    <h3 className="text-lg font-semibold">{course.title}</h3>
                    <p className="text-sm text-muted-foreground">Progress: {course.progress}%</p>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-[#5b3fd6]"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                    <Button
                      className="w-full bg-gradient-primary"
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Continue Learning
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
      </div>
    </div>

    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Assignments & Quizzes</h2>
        <div className="flex gap-2">
          <Button
            variant={selectedTab === "assignments" ? "secondary" : "outline"}
            onClick={() =>
              setSelectedTab((prev) => (prev === "assignments" ? null : "assignments"))
            }
          >
            Assignments
          </Button>
          <Button
            variant={selectedTab === "quizzes" ? "secondary" : "outline"}
            onClick={() =>
              setSelectedTab((prev) => (prev === "quizzes" ? null : "quizzes"))
            }
          >
            Quizzes
          </Button>
        </div>
      </div>
      {selectedTab && (
        <div className="space-y-3">
          {selectedTab === "assignments" ? (
            assignments.length ? (
              assignments.map((assignment) => renderAssignmentItem(assignment))
            ) : (
              <Card className="p-4 text-sm text-muted-foreground">No assignments available.</Card>
            )
          ) : quizzes.length ? (
            quizzes.map((quiz) => renderQuizItem(quiz))
          ) : (
            <Card className="p-4 text-sm text-muted-foreground">No quizzes available.</Card>
          )}
        </div>
      )}
    </div>

    {/* LMS Guides Section */}
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">LMS Learning Guides</h2>
          <Button variant="outline" onClick={() => window.location.href = '/guides'}>
            View All
          </Button>
        </div>
        <LMSGuides isAdmin={isAdmin} maxDisplay={3} showUploadButton={false} />
      </div>
    </div>
  );
}
