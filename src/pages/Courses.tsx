// src/pages/Courses.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Search, Plus, Copy, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Course {
  id: string;
  title: string;
  code: string;
  category: string;
  description?: string;
  duration: string;
}

export default function Courses() {
  const { user, isAdmin } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: "",
    duration: "",
    category: "",
    code: ""
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const dedupeCourses = (items: Course[]) => {
    const seen = new Set<string>();
    const result: Course[] = [];
    for (const course of items || []) {
      if (course?.id && !seen.has(course.id)) {
        seen.add(course.id);
        result.push(course);
      }
    }
    return result;
  };
  const [duplicatingCourseId, setDuplicatingCourseId] = useState<string | null>(null);

  // Guards stale async completions
  const requestIdRef = useRef(0);

  // ---- helpers -------------------------------------------------------------

  function normalizeCoursesResponse(raw: unknown): Course[] {
    // WHY: Backend occasionally returns different shapes; normalize once.
    if (Array.isArray(raw)) return raw as Course[];

    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const candidates = ["data", "items", "results", "courses"];
      for (const key of candidates) {
        const val = obj[key];
        if (Array.isArray(val)) return val as Course[];
      }
    }
    return [];
  }

  async function fetchCatalog(): Promise<Course[]> {
    const res = await apiFetch<unknown>("/courses");
    return normalizeCoursesResponse(res);
  }

  async function fetchEnrolled(): Promise<Course[]> {
    const res = await apiFetch<unknown>("/courses?enrolledOnly=true");
    return normalizeCoursesResponse(res);
  }

  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;

    // UI-only demo: use static sample courses instead of fetching from backend
    const sampleCourses: Course[] = [
      { id: "c1", title: "Introduction to Biology", code: "BIO101", category: "Bachelor's", description: "Basics of cell biology", duration: "10 weeks" },
      { id: "c2", title: "Calculus I", code: "MATH101", category: "Bachelor's", description: "Limits, derivatives, integrals", duration: "12 weeks" },
      { id: "c3", title: "Intro to Programming", code: "CS101", category: "Bachelor's", description: "Programming fundamentals with JS", duration: "8 weeks" },
      { id: "c4", title: "Academic Writing", code: "ENG201", category: "Certificate", description: "Essay writing and research skills", duration: "6 weeks" },
      { id: "c5", title: "Statistics for Science", code: "STAT110", category: "Bachelor's", description: "Introductory statistics", duration: "10 weeks" },
      { id: "c6", title: "Project Management Basics", code: "PM101", category: "Diploma", description: "Fundamentals of project planning", duration: "4 weeks" },
    ];

    setCourses(dedupeCourses(sampleCourses));
    setLoading(false);
  }, [user, isAdmin]);

  const loadCourses = async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      if (isAdmin) {
        const data = await fetchCatalog();
        if (requestId !== requestIdRef.current) return;
        setCourses(dedupeCourses(data));
        setLoading(false);
        return;
      }

      // Students: fetch in parallel and pick the best non-empty
      const [catalogRes, enrolledRes] = await Promise.allSettled([
        fetchCatalog(),
        fetchEnrolled()
      ]);

      if (requestId !== requestIdRef.current) return;

      const catalog =
        catalogRes.status === "fulfilled" ? catalogRes.value : [];
      const enrolled =
        enrolledRes.status === "fulfilled" ? enrolledRes.value : [];

      const chosen =
        (catalog && catalog.length > 0 && catalog) ||
        (enrolled && enrolled.length > 0 && enrolled) ||
        [];

      setCourses(dedupeCourses(chosen));
      setLoading(false);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error("Failed to load courses", error);
      toast.error("Failed to load courses");
      setCourses([]); // keep UI consistent
      setLoading(false);
    }
  };

  const handleAddCourse = async () => {
    if (!newCourse.title || !newCourse.category || !newCourse.duration) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const courseCode =
        newCourse.code ||
        `${newCourse.category.substring(0, 3).toUpperCase()}-${Date.now()}`;

      const created = await apiFetch<{ id: string }>("/courses", {
        method: "POST",
        body: JSON.stringify({
          title: newCourse.title,
          code: courseCode,
          category: newCourse.category,
          duration: newCourse.duration,
          description: newCourse.title
        })
      });

      if (attachments.length > 0 && created?.id) {
        for (const file of attachments) {
          const fd = new FormData();
          fd.append("course_id", created.id);
          fd.append("title", file.name);
          fd.append("file", file);
          await apiFetch("/materials", { method: "POST", body: fd }).catch(() => {
            /* WHY: don't block course creation on attachment failures */
          });
        }
      }

      toast.success("Course added successfully");
      setAddDialogOpen(false);
      setNewCourse({ title: "", duration: "", category: "", code: "" });
      setAttachments([]);
      void loadCourses();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add course");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (
      !confirm("Are you sure you want to delete this course? This action cannot be undone.")
    ) {
      return;
    }

    try {
      await apiFetch(`/courses/${courseId}`, { method: "DELETE" });
      toast.success("Course deleted");
      void loadCourses();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete course");
    }
  };

  const handleDuplicateCourse = async (course: Course) => {
    setDuplicatingCourseId(course.id);
    try {
      await apiFetch(`/courses/${course.id}/duplicate`, {
        method: "POST",
      });
      toast.success(`Course duplicated: ${course.title}`);
      void loadCourses();
    } catch (error: any) {
      toast.error(error?.message || "Failed to duplicate course");
    } finally {
      setDuplicatingCourseId(null);
    }
  };

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => {
      const title = c.title?.toLowerCase() || "";
      const desc = c.description?.toLowerCase() || "";
      const code = c.code?.toLowerCase() || "";
      return title.includes(q) || desc.includes(q) || code.includes(q);
    });
  }, [courses, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Course Catalog</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Manage your courses" : "Browse all available courses"}
          </p>
        </div>

        {isAdmin && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add New Course
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Course</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Course Name *</Label>
                  <Input
                    value={newCourse.title}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, title: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Duration *</Label>
                  <Input
                    value={newCourse.duration}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, duration: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Program Category *</Label>
                  <Select
                    value={newCourse.category}
                    onValueChange={(val) =>
                      setNewCourse({ ...newCourse, category: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bachelor's">Bachelor's Degree</SelectItem>
                      <SelectItem value="Master's">Master's Degree</SelectItem>
                      <SelectItem value="Doctorate">Doctorate</SelectItem>
                      <SelectItem value="Diploma">Diploma</SelectItem>
                      <SelectItem value="Certificate">Certificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Course Code (Optional)</Label>
                  <Input
                    value={newCourse.code}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, code: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Attachments (Optional)</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) =>
                      setAttachments(Array.from(e.target.files || []))
                    }
                  />
                </div>

                <Button onClick={handleAddCourse} className="w-full">
                  Add Course
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Courses Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading && (
          <Card className="p-12 text-center col-span-full">Loading courses…</Card>
        )}

        {!loading &&
          filteredCourses.map((course) => (
            <Card key={course.id} className="h-full p-6 hover:shadow-xl transition-all">
              <Badge className="mb-2">{course.category}</Badge>

              <h3 className="text-lg font-semibold mb-2">{course.title}</h3>

              <p className="text-sm text-muted-foreground mb-4">{course.code}</p>

              <div className="text-xs text-muted-foreground mb-4">
                Duration: {course.duration}
              </div>

              <div className="flex gap-2">
                <Link to={`/courses/${course.id}`} className="flex-1">
                  <Button className="w-full">View Details</Button>
                </Link>
                {isAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      className="text-xs whitespace-nowrap flex items-center gap-1"
                      onClick={() => handleDuplicateCourse(course)}
                      disabled={duplicatingCourseId === course.id}
                    >
                      {duplicatingCourseId === course.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Duplicating...
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Duplicate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs whitespace-nowrap"
                      onClick={() => handleDeleteCourse(course.id)}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}

        {!loading && filteredCourses.length === 0 && (
          <Card className="p-12 text-center col-span-full">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No courses found</h3>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Add your first course to get started"
                : "You haven't been enrolled yet"}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
