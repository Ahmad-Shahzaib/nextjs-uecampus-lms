import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

interface Deadline {
  id: string;
  refId: string;
  title: string;
  course: string;
  courseId?: string;
  due_date: string;
  priority: string;
  hours_left: number;
  type: "assignment" | "quiz";
}

export function RightSidebar() {
  const { user, isAdmin, isAccounts, isTeacher } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [submittedAssignmentIds, setSubmittedAssignmentIds] = useState<Set<string>>(new Set());
  const [startedQuizIds, setStartedQuizIds] = useState<Set<string>>(new Set());
  const [activeCourseIds, setActiveCourseIds] = useState<Set<string>>(new Set());
  const isPrivileged = useMemo(() => isAdmin || isAccounts || isTeacher, [isAdmin, isAccounts, isTeacher]);
  const isLikelyUuid = (value?: string) =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
  const parseDeadline = (value?: string | null) => {
    if (!value) return null;
    let trimmed = String(value).trim();
    if (!trimmed) return null;
    trimmed = trimmed.replace(/\.\d+/, "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const dateOnly = new Date(`${trimmed}T23:59:59`);
      return Number.isNaN(dateOnly.getTime()) ? null : dateOnly;
    }
    const normalized = trimmed.includes(" ")
      ? trimmed.replace(" ", "T")
      : trimmed;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const buildDeadline = (item: any, type: "assignment" | "quiz") => {
    const deadline = item.custom_deadline || item.due_date;
    if (!deadline) return null;
    const dueDate = parseDeadline(deadline);
    const now = new Date();
    if (dueDate && dueDate.getTime() < now.getTime()) return null;
    const hoursLeft = dueDate
      ? Math.max(0, Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)))
      : 0;
    const courseId = item.course_id || (isLikelyUuid(item.course) ? item.course : "");
    const courseLabel = item.course_title || item.course_code || item.course || item.course_id || "";
    return {
      id: `${type}-${item.id}`,
      refId: item.id,
      title: item.title,
      course: courseLabel,
      courseId,
      due_date: deadline,
      priority:
        type === "quiz"
          ? hoursLeft < 24
            ? "high"
            : hoursLeft < 72
              ? "medium"
              : "low"
          : item.priority || "medium",
      hours_left: hoursLeft,
      type,           
    };
  };

  const dedupeDeadlines = (items: Deadline[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.type}-${item.refId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const loadDeadlines = async (
    submittedIds: Set<string>,
    courseIds: Set<string>,
    startedQuizzes: Set<string>
  ) => {
    if (!user) {
      setDeadlines([]);
      return;
    }
    try {
      const shouldFilterByCourse = !isPrivileged && courseIds.size > 0;
      const feedData = await apiFetch<{ assignments: any[]; quizzes: any[] }>("/feed/upcoming")
        .catch(() => null);
      const assignmentsSource = isPrivileged
        ? feedData?.assignments || []
        : (await apiFetch<any[]>("/assignments").catch(() => []));
      const quizzesSource = feedData?.quizzes || [];
      let assignmentDeadlines = assignmentsSource
        .map((a) => buildDeadline(a, "assignment"))
        .filter((d): d is Deadline => Boolean(d))
        .filter((d) => !submittedIds.has(d.refId))
        .filter((d) => !shouldFilterByCourse || !d.courseId || courseIds.has(d.courseId));
      const quizDeadlines = (quizzesSource || [])
        .map((q) => buildDeadline(q, "quiz"))
        .filter((d): d is Deadline => Boolean(d));
      const filteredQuizDeadlines = quizDeadlines.filter((d) => !startedQuizzes.has(d.refId));
      const combined = dedupeDeadlines([...assignmentDeadlines, ...filteredQuizDeadlines]);
      const sorted = combined.sort(
        (a, b) => {
          const aTime = parseDeadline(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bTime = parseDeadline(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        }
      );
      setDeadlines(sorted);
    } catch (error) {
      console.error("Error fetching deadlines:", error);
      setDeadlines([]);
    }
  };

  useEffect(() => {
    let active = true;
    const loadSubmissions = async () => {
      if (!user) {
        setSubmittedAssignmentIds(new Set());
        return;
      }
      try {
        const submissions = await apiFetch<any[]>("/submissions?mine=true");
        if (!active) return;
        const submittedIds = new Set(
          submissions.map((s) => s.assignment_id).filter(Boolean)
        );
        setSubmittedAssignmentIds(submittedIds);
      } catch (error) {
        if (active) {
          setSubmittedAssignmentIds(new Set());
        }
      }
    };
    loadSubmissions();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadQuizProgress = async () => {
      if (!user) {
        setStartedQuizIds(new Set());
        return;
      }
      try {
        const progress = await apiFetch<any[]>("/progress");
        if (!active) return;
        const quizIds = new Set(
          progress
            .filter((p) => p.item_type === "quiz" && p.quiz_id)
            .map((p) => p.quiz_id)
        );
        setStartedQuizIds(quizIds);
      } catch (error) {
        if (active) {
          setStartedQuizIds(new Set());
        }
      }
    };
    loadQuizProgress();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadEnrollments = async () => {
      if (!user || isPrivileged) {
        setActiveCourseIds(new Set());
        return;
      }
      try {
        const enrollments = await apiFetch<any[]>("/enrollments");
        if (!active) return;
        const ids = new Set(
          enrollments
            .filter((e) => !e.status || e.status === "active")
            .map((e) => e.course_id)
            .filter(Boolean)
        );
        setActiveCourseIds(ids);
      } catch {
        if (active) {
          setActiveCourseIds(new Set());
        }
      }
    };
    loadEnrollments();
    return () => {
      active = false;
    };
  }, [user, isPrivileged]);

  useEffect(() => {
    loadDeadlines(submittedAssignmentIds, activeCourseIds, startedQuizIds);
  }, [user, submittedAssignmentIds, activeCourseIds, startedQuizIds, isPrivileged]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            Upcoming Deadlines
          </h2>
          <div className="space-y-3">
            {deadlines.length === 0 ? (
              <Card className="p-4 text-center text-muted-foreground">
                <p className="text-sm">No upcoming deadlines</p>
              </Card>
            ) : (
              deadlines.map((deadline) => (
                <Card
                  key={deadline.id}
                  className={cn(
                    "p-4 border-l-4 transition-all duration-300 hover:shadow-glow hover:scale-105 bg-gradient-card",
                    deadline.priority === "high" && "border-l-destructive shadow-glow-accent",
                    deadline.priority === "medium" && "border-l-warning",
                    deadline.priority === "low" && "border-l-success"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {deadline.type === "quiz" && (
                          <Badge variant="secondary" className="text-[10px] h-5 bg-purple-600 text-white mb-1">
                            Quiz
                          </Badge>
                        )}
                        {deadline.type === "assignment" && (
                          <Badge variant="destructive" className="text-[10px] h-5 mb-1">
                            Assignment
                          </Badge>
                        )}
                        <h3 className="font-medium text-sm leading-tight">{deadline.title}</h3>
                      </div>
                      <Badge
                        variant={deadline.priority === "high" ? "destructive" : "secondary"}
                        className={deadline.priority === "high" ? "animate-pulse" : ""}
                      >
                        {deadline.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{deadline.course}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {deadline.due_date
                          ? (() => {
                              const parsed = parseDeadline(deadline.due_date);
                              if (!parsed) return "No date";
                              const uaeDate = new Date(parsed.getTime() + 4 * 60 * 60 * 1000);
                              return format(uaeDate, "MMM d, h:mm a");
                            })()
                          : "No date"}
                      </span>
                      <span
                        className={cn(
                          "ml-auto font-semibold",
                          deadline.hours_left < 24 && "text-destructive",
                          deadline.hours_left >= 24 && deadline.hours_left < 72 && "text-warning",
                          deadline.hours_left >= 72 && "text-success"
                        )}
                      >
                        {deadline.hours_left}h left
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
