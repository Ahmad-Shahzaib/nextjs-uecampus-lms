import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Award, BookOpen, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ProgressItem {
  id: string;
  course_id: string;
  course_name: string;
  item_type: string;
  material_id?: string;
  score: number;
  max_score: number;
  percentage: number;
  status: string;
  completed_at: string;
}

interface CourseProgress {
  course_id: string;
  course_name: string;
  overall_progress: number;
  assignments_completed: number;
  total_score: number;
}

interface ApiCourse {
  id: string;
  title: string;
}

export default function Progress() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [summary, setSummary] = useState({
    activeCourses: 0,
    completedItems: 0,
    averageProgress: 0,
    totalPoints: 0,
  });
  const toNumber = (value: any, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user]);

  const loadProgress = async () => {
    try {
      setLoading(true);

      const [items, courses, enrollments] = await Promise.all([
        apiFetch<any[]>("/progress"),
        apiFetch<ApiCourse[]>("/courses?enrolledOnly=true"),
        apiFetch<any[]>("/enrollments"),
      ]);

      const uniqueCourses = Array.from(
        new Map((courses || []).map((c) => [c.id, c])).values()
      );
      const courseMap = new Map(uniqueCourses.map((c) => [c.id, c.title]));
      const activeEnrollments = (enrollments || []).filter(
        (e) => !e.status || e.status === "active"
      );
      const activeCourseIds = Array.from(
        new Set(activeEnrollments.map((e) => e.course_id).filter(Boolean))
      );
      const enrollmentProgressMap = new Map(
        activeEnrollments.map((e) => [e.course_id, toNumber(e.progress, 0)])
      );
      const avgProgressFromEnrollments = activeEnrollments.length
        ? Math.round(
            activeEnrollments.reduce(
              (sum, e) => sum + toNumber(e.progress, 0),
              0
            ) / activeEnrollments.length
          )
        : 0;

      const formattedItems: ProgressItem[] = (items || []).map((item) => ({
        id: item.id,
        course_id: item.course_id,
        course_name: courseMap.get(item.course_id) || "Unknown Course",
        item_type: item.item_type,
        material_id: item.material_id || undefined,
        score: toNumber(item.score, 0),
        max_score: toNumber(item.max_score, 100),
        percentage: toNumber(item.percentage, 0),
        status: item.status,
        completed_at: item.completed_at,
      }));

      const relevantItems = formattedItems.filter((item) => {
        const type = (item.item_type || "").toLowerCase();
        return type === "assignment" || type === "quiz";
      });
      const serverCompletedMaterials = new Set(
        formattedItems
          .filter((item) => {
            const type = (item.item_type || "").toLowerCase();
            return type === "material" && item.status === "completed";
          })
          .map((item) => String(item.material_id || item.id))
      );
      const localCompletedMaterials = new Set<string>();
      if (user?.id) {
        uniqueCourses.forEach((course) => {
          const localKey = `completed_materials_${user.id}_${course.id}`;
          const localValue = localStorage.getItem(localKey);
          if (!localValue) return;
          try {
            const ids = JSON.parse(localValue);
            if (Array.isArray(ids)) {
              ids.forEach((id) => localCompletedMaterials.add(String(id)));
            }
          } catch (error) {
            console.error("Failed to parse local progress cache", error);
          }
        });
      }
      const completedMaterials = new Set([
        ...Array.from(serverCompletedMaterials),
        ...Array.from(localCompletedMaterials),
      ]).size;

      const courseProgressData: CourseProgress[] = uniqueCourses.map((course) => {
        const courseItems = relevantItems.filter(
          (item) => item.course_id === course.id
        );

        const assignmentsCompleted = courseItems.filter(
          (item) => item.item_type === "assignment" && item.status === "completed"
        ).length;

        const totalScore = courseItems.reduce((sum, item) => sum + toNumber(item.score, 0), 0);
        const avg =
          courseItems.length === 0
            ? 0
            : courseItems.reduce((sum, item) => sum + toNumber(item.percentage, 0), 0) /
              courseItems.length;
        const enrolledProgress = enrollmentProgressMap.get(course.id);
        const localProgressKey = user?.id ? `course_progress_${user.id}_${course.id}` : "";
        const localProgressValue = localProgressKey ? localStorage.getItem(localProgressKey) : null;
        const localProgress = localProgressValue !== null ? toNumber(localProgressValue, 0) : undefined;
        const resolvedProgress =
          localProgress !== undefined
            ? localProgress
            : enrolledProgress !== undefined
              ? enrolledProgress
              : Number.isFinite(avg)
                ? Math.round(avg)
                : 0;

        return {
          course_id: course.id,
          course_name: course.title,
          overall_progress: resolvedProgress,
          assignments_completed: assignmentsCompleted,
          total_score: totalScore,
        };
      });

      setCourseProgress(courseProgressData);
      const avgProgressFromCourses = courseProgressData.length
        ? Math.round(
            courseProgressData.reduce(
              (sum, c) => sum + toNumber(c.overall_progress, 0),
              0
            ) / courseProgressData.length
          )
        : 0;
      setSummary({
        activeCourses: activeCourseIds.length || uniqueCourses.length,
        completedItems: completedMaterials,
        averageProgress: avgProgressFromCourses || avgProgressFromEnrollments,
        totalPoints: completedMaterials * 2,
      });
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          My Progress
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your learning progress and achievements
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.activeCourses}</p>
                <p className="text-xs text-muted-foreground">Active Courses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {summary.completedItems}
                </p>
                <p className="text-xs text-muted-foreground">Completed Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/10">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(summary.averageProgress)}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <Award className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalPoints}</p>
                <p className="text-xs text-muted-foreground">Total Points</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course Progress */}
      <div className="space-y-4">
        {courseProgress.map((course) => (
          <Card key={course.course_id} className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">{course.course_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span className="font-semibold">{course.overall_progress}%</span>
                </div>
                <ProgressBar value={course.overall_progress} className="h-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Assignments</p>
                  <p className="font-semibold">{course.assignments_completed}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Score</p>
                  <p className="font-semibold">{course.total_score} pts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
