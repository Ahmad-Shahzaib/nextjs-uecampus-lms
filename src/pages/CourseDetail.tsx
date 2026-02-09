// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Trash2,
  Plus,
  FileText,
  Video,
  File,
  Upload,
  Download,
  BookOpen,
  LayoutGrid,
  ClipboardList,
  Award,
  Menu,
  FileQuestion,
  Presentation,
  ChevronDown,
  ChevronRight,
  Loader2,
  Edit2,
  Check,
  X,
  GripVertical
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichTextEditor } from "@/components/RichTextEditor";
import { FileViewer } from "@/components/FileViewer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DraggableMaterialList, DraggableAssignmentList, DraggableQuizList } from "@/components/DraggableMaterialList";
import { CertificateGeneratedDialog } from "@/components/CertificateGeneratedDialog";
import { Switch } from "@/components/ui/switch";
import { UECampusLogoLink } from "@/components/UECampusLogoLink";
import quizIcon from "@/assets/quiz-icon.png";
import { useIsMobile } from "@/hooks/use-mobile";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { apiFetch, resolveStorageUrl } from "@/lib/api";
import { chunkedUploadFile, ChunkUploadProgress } from "@/lib/chunkUpload";
import { directUploadFile, DirectUploadProgress } from "@/lib/directUpload";

// Static fallback/test data for CourseDetail (exported for reuse)
export const STATIC_DATA = {
  course: {
    id: "sample-course",
    title: "Sample Course: Introduction to Testing",
    code: "SAMP101",
    category: "Sample",
    description: "This is a static sample course used for local testing and UI preview.",
  },
  sections: [
    { id: "sec-intro", slug: "introduction", title: "Introduction" },
    { id: "sec-basics", slug: "basics", title: "Basic Concepts" },
  ],
  materials: [
    {
      id: "mat-1",
      title: "Welcome",
      file_path: "",
      file_type: "text/html",
      section_id: "sec-intro",
      order_index: "0",
      content: "<p>Welcome to the sample course.</p>",
    },
    {
      id: "mat-2",
      title: "Getting Started Guide (PDF)",
      file_path: "sample-guide.pdf",
      file_type: "application/pdf",
      section_id: "sec-basics",
      order_index: "1",
    },
  ],
  assignments: [
    {
      id: "asgn-1",
      title: "Intro Assignment",
      unit_name: "sec-intro",
      due_date: null,
      description: "A simple assignment for testing.",
    },
  ],
  quizzes: [
    {
      id: "quiz-1",
      title: "Intro Quiz",
      quiz_url: "https://example.com/quiz/1",
      section_id: "sec-intro",
    },
  ],
};

export default function CourseDetail() {
  const { courseId } = useParams();
  const { user, isAdmin: isAdminFromAuth, isTeacher, isAccounts } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const canManageUsers = isAdminFromAuth || isAccounts;
  const isPrivilegedUser = canManageUsers || isTeacher;
  const [course, setCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [editingSectionSaving, setEditingSectionSaving] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [textLessonDialogOpen, setTextLessonDialogOpen] = useState(false);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [currentSectionId, setCurrentSectionId] = useState("");
  const [newSection, setNewSection] = useState({ title: "", description: "" });
  const [newTextLesson, setNewTextLesson] = useState({ title: "", content: "" });
  const getDefaultAssignmentState = () => ({
    title: "",
    unit_name: "",
    description: "",
    points: 100,
    passing_marks: 50,
    assessment_brief: "",
    due_date: "",
  });
  const [newAssignment, setNewAssignment] = useState(getDefaultAssignmentState());
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [completedMaterials, setCompletedMaterials] = useState<Set<string>>(new Set());
  const [courseProgress, setCourseProgress] = useState(0);
  const [sectionQuizzes, setSectionQuizzes] = useState<any[]>([]);
  const [newQuiz, setNewQuiz] = useState({
    title: "",
    quiz_url: "",
    description: "",
    duration: 30,
    due_date: ""
  });
  const [blockedQuizIds, setBlockedQuizIds] = useState<Set<string>>(new Set());
  const [pendingQuizStart, setPendingQuizStart] = useState<any>(null);
  const [quizStartLoading, setQuizStartLoading] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState<
    "text" | "file" | "quiz" | "brief" | "google_drive" | "video_lecture" | "pdf" | "powerpoint" | "assignment" | null
  >(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [fileDisplayName, setFileDisplayName] = useState("");
  const [googleDriveUrl, setGoogleDriveUrl] = useState("");
  const [googleDriveTitle, setGoogleDriveTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pptTitle, setPptTitle] = useState("");
  const [pptFile, setPptFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pptUploading, setPptUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeUploadMode, setActiveUploadMode] = useState<"direct" | "chunked" | null>(null);
  const activityLabelMap: Record<string, string> = {
    text: "text lesson",
    file: "file",
    pdf: "PDF",
    powerpoint: "PowerPoint",
    brief: "assessment brief",
    quiz: "quiz",
    google_drive: "Google Drive item",
    video_lecture: "video lecture",
    assignment: "assignment",
  };
  const isActivityDialogBusy = activityLoading || pdfUploading || pptUploading;
  const activityOverlayLabel =
    pdfUploading
      ? "Uploading PDF..."
      : pptUploading
        ? "Uploading PowerPoint..."
        : activityType
          ? `Adding ${activityLabelMap[activityType] || "activity"}...`
          : "Adding activity...";
  const [sidebarPanel, setSidebarPanel] = useState<"content" | "assessment" | "quizzes">("content");
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [courseCompleteDialogOpen, setCourseCompleteDialogOpen] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const ensureArray = (val: any) => (Array.isArray(val) ? val : val && typeof val === "object" ? Object.values(val) : []);
  const [deadlineDialogOpen, setDeadlineDialogOpen] = useState(false);
  const [selectedAssignmentForDeadline, setSelectedAssignmentForDeadline] = useState<any>(null);
  const [selectedQuizForDeadline, setSelectedQuizForDeadline] = useState<any>(null);
  const [selectedUserForDeadline, setSelectedUserForDeadline] = useState("");
  const [customDeadline, setCustomDeadline] = useState("");
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [defaultSectionId, setDefaultSectionId] = useState("default-section");
  const [defaultSectionSlug, setDefaultSectionSlug] = useState("default-section");
  const [assignmentSectionContext, setAssignmentSectionContext] = useState<any>(null);
  const MATERIAL_UPLOAD_TIMEOUT = 600000;
  const lastSyncedProgressRef = useRef<number | null>(null);
  const activitySections =
    sections.length > 0
      ? sections
      : [{ id: defaultSectionId || "default-section", slug: defaultSectionSlug || defaultSectionId || "default-section", title: "Course Content" }];

  useEffect(() => {
    setPendingQuizStart(null);
  }, [courseId]);

  const getSectionIdentifiers = (section: any) => {
    const idCandidates = [
      section?.id,
      section?.section_id,
      section?.sectionId,
      section?.unit_id,
      section?.unitId,
      section?.title,
      section?.name,
    ]
      .map((value) => (value ? String(value) : ""))
      .filter(Boolean);
    const slugCandidates = [
      section?.slug,
      normalizeIdentifier(section?.title),
      normalizeIdentifier(section?.name),
    ].filter(Boolean);
    return { idCandidates, slugCandidates };
  };

  const resolveSectionContext = (section?: any) => {
    const fallbackId = defaultSectionId || "default-section";
    const fallbackSlug = defaultSectionSlug || normalizeIdentifier(fallbackId) || "default-section";
    const candidateId =
      section?.id ||
      section?.section_id ||
      section?.sectionId ||
      section?.unit_id ||
      section?.unitId ||
      section?.title ||
      section?.name ||
      fallbackId;
    const normalizedSlug =
      section?.slug ||
      normalizeIdentifier(section?.title) ||
      normalizeIdentifier(section?.name) ||
      normalizeIdentifier(section?.section_title) ||
      normalizeIdentifier(section?.sectionName) ||
      normalizeIdentifier(section?.section_name) ||
      normalizeIdentifier(section?.sectionTitle) ||
      normalizeIdentifier(candidateId);
    return {
      id: keyify(candidateId) || fallbackId,
      slug: normalizedSlug || fallbackSlug || "default-section",
    };
  };

  // Map section to dialog context
  const mapSectionToDialogContext = (section: any) => {
    const fallbackId = defaultSectionId || "default-section";
    const fallbackTitle = "Course Section";
    
    const candidateSection = section || sections[0] || { 
      id: fallbackId, 
      title: fallbackTitle 
    };
    
    const context = resolveSectionContext(candidateSection);
    const title = candidateSection?.title || 
                 candidateSection?.name || 
                 candidateSection?.section_title || 
                 fallbackTitle;
    
    return { ...context, title };
  };

  // Normalize section references coming from mixed API shapes
  const keyify = (val: any) => (val === undefined || val === null ? "" : String(val));

  const getSectionKey = (section: any) =>
    keyify(
      section?.id ||
      section?.section_id ||
      section?.sectionId ||
      section?.unit_id ||
      section?.unitId ||
      section?.title ||
      section?.name
    );

  const normalizeIdentifier = (value: any) => {
    if (value === undefined || value === null) return "";
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const generateSectionSlug = (section: any, fallbackIndex: number) => {
    const candidate =
      section?.slug ||
      section?.title ||
      section?.name ||
      section?.section_title ||
      section?.sectionName ||
      section?.id ||
      section?.section_id ||
      section?.sectionId ||
      `section-${fallbackIndex}`;
    return normalizeIdentifier(candidate) || `section-${fallbackIndex}`;
  };

  const buildAssignmentSlugCandidates = (assignment: any) => {
    if (!assignment) return [];
    return [
      assignment.unit_name,
      assignment.unitName,
      assignment.section_name,
      assignment.sectionName,
      assignment.section,
      assignment.section_id,
      assignment.sectionId,
      assignment.assigned_section_slug,
    ]
      .map((value) => normalizeIdentifier(value))
      .filter((value) => value);
  };

  const findAssignmentSectionMatch = (
    assignment: any,
    sectionsList: any[],
    fallbackSlug: string,
    fallbackSectionKey: string
  ) => {
    const candidates = buildAssignmentSlugCandidates(assignment);
    const idCandidates = [assignment?.section_id, assignment?.sectionId].filter((value) => value);
    const defaultKey = fallbackSectionKey || "";
    let matched = false;

    for (const candidate of candidates) {
      for (const section of sectionsList) {
        if (!section) continue;
        const slug = section.slug || "";
        if (
          slug === candidate ||
          normalizeIdentifier(section.title) === candidate ||
          normalizeIdentifier(section.name) === candidate
        ) {
          matched = true;
          return {
            slug: slug || candidate || fallbackSlug,
            sectionKey: getSectionKey(section) || defaultKey,
            matched,
          };
        }
      }
    }

    for (const candidateId of idCandidates) {
      for (const section of sectionsList) {
        if (!section) continue;
        const sectionKey = getSectionKey(section);
        if (
          sectionKey === candidateId ||
          section.id === candidateId ||
          section.section_id === candidateId ||
          section.sectionId === candidateId
        ) {
          matched = true;
          return {
            slug: section.slug || fallbackSlug,
            sectionKey: sectionKey || defaultKey,
            matched,
          };
        }
      }
    }

    return {
      slug: fallbackSlug,
      sectionKey: defaultKey,
      matched,
    };
  };

  const getItemSectionKey = (item: any) =>
    keyify(
      item?.section_id ||
      item?.section ||
      item?.sectionId ||
      item?.unit_id ||
      item?.unitId ||
      item?.unit_name ||
      item?.unitName ||
      item?.section_name ||
      item?.sectionName
    );

  const resolveSectionByKey = (key?: string) => {
    if (!key) return null;
    const normalizedKey = normalizeIdentifier(key);
    return (
      sections.find(
        (sec) =>
          sec.id === key ||
          sec.section_id === key ||
          sec.slug === key ||
          normalizeIdentifier(sec.slug) === normalizedKey ||
          normalizeIdentifier(sec.title) === normalizedKey ||
          normalizeIdentifier(sec.name) === normalizedKey
      ) || null
    );
  };

  const findSectionRecordByContext = (context: any) => {
    if (!context) return null;
    const normalizedKey = normalizeIdentifier(context.id);
    const normalizedSlug = normalizeIdentifier(context.slug);
    const normalizedTitle = normalizeIdentifier(context.title);
    return (
      sections.find(
        (sec) =>
          sec.id === context.id ||
          sec.section_id === context.id ||
          sec.sectionId === context.id ||
          sec.slug === context.slug ||
          normalizeIdentifier(sec.slug) === normalizedSlug ||
          normalizeIdentifier(sec.title) === normalizedTitle ||
          normalizeIdentifier(sec.name) === normalizedTitle ||
          normalizeIdentifier(sec.title) === normalizedKey ||
          normalizeIdentifier(sec.name) === normalizedKey
      ) || null
    );
  };

  const getAssignmentDialogSectionContext = () => {
    const fallbackTitle = "Course Section";
    const candidateSection =
      resolveSectionByKey(currentSectionId) || sections[0] || { id: defaultSectionId, slug: defaultSectionSlug, title: fallbackTitle };
    const resolvedContext = resolveSectionContext(candidateSection);
    const title =
      candidateSection?.title ||
      candidateSection?.name ||
      candidateSection?.section_title ||
      candidateSection?.sectionName ||
      fallbackTitle;
    return { ...resolvedContext, title };
  };

  const doesAssignmentBelongToSection = (assignment: any, section: any) => {
    if (!assignment || !section) return false;
    const { idCandidates, slugCandidates } = getSectionIdentifiers(section);
    const assignmentIds = [
      assignment.section_id,
      assignment.sectionId,
      assignment.unit_id,
      assignment.unitId,
      assignment.unit_name,
    ]
      .map((value) => (value ? String(value) : ""))
      .filter(Boolean);
    const assignmentSlugs = [
      assignment.assigned_section_slug,
      assignment.slug,
      normalizeIdentifier(assignment.unit_name),
      normalizeIdentifier(assignment.section_name),
    ]
      .map((value) => (value ? String(value) : ""))
      .map(normalizeIdentifier)
      .filter(Boolean);

    return (
      assignmentIds.some((id) => idCandidates.includes(id)) ||
      assignmentSlugs.some((slug) => slugCandidates.includes(slug))
    );
  };

  useEffect(() => {
    if (user) {
      setIsAdmin(isPrivilegedUser);
      loadCourseData();
      if (!isPrivilegedUser) {
        setShowWelcome(true);
      }
    }
  }, [user, courseId, isPrivilegedUser]);

  useEffect(() => {
    if (user && !isAdmin) {
      loadUserProgress();
      loadUserSubmissions();
    }
  }, [user, courseId, isAdmin]);

  // Reset section tracking when activity dialog closes
  useEffect(() => {
    if (!activityDialogOpen) {
      setCurrentSectionId("");
    }
  }, [activityDialogOpen]);

  useEffect(() => {
    if (!assignmentDialogOpen) {
      setNewAssignment(getDefaultAssignmentState());
      setAssignmentFile(null);
      setAssignmentSectionContext(null);
    }
  }, [assignmentDialogOpen]);

  const loadUserSubmissions = async () => {
    if (!user || !courseId) return;

    try {
      const subs = await apiFetch<any[]>("/submissions?mine=true");
      setUserSubmissions(ensureArray(subs || []));

      const submittedAssignmentIds = new Set((subs || []).map((s: any) => s.assignment_id));
      setAssignments(prev => prev.map(a => ({
        ...a,
        hasSubmission: submittedAssignmentIds.has(a.id),
        status: submittedAssignmentIds.has(a.id) ? 'submitted' : a.status
      })));
    } catch (error) {
      console.error("Failed to load submissions", error);
    }
  };

  const loadUserProgress = async () => {
    if (!user || !courseId) return;

    // Load from localStorage first
    const localKey = `completed_materials_${user.id}_${courseId}`;
    const localCompleted = localStorage.getItem(localKey);

    if (localCompleted) {
      try {
        const completedIds = JSON.parse(localCompleted);
        setCompletedMaterials(new Set(completedIds));
      } catch (e) {
        console.error('Error parsing local storage:', e);
      }
    }

    try {
      const data = await apiFetch<any[]>("/progress");
      const courseProgress = (data || []).filter(
        (item) => item?.course_id === courseId
      );

      const completedAssignments = courseProgress.filter(item => item.item_type === 'assignment');
      const completedQuizzes = courseProgress.filter(item => item.item_type === 'quiz');
      const completedMaterialIds = new Set<string>();

      const quizProgressIds = new Set<string>();
      completedQuizzes.forEach(item => {
        if (item.quiz_id) {
          quizProgressIds.add(item.quiz_id);
        }
      });

      // Merge with localStorage completed materials (and sync any missing server entries)
      if (localCompleted) {
        try {
          const localIds = JSON.parse(localCompleted);
          const unsynced = localIds.filter((id: string) => !completedMaterialIds.has(id));
          localIds.forEach((id: string) => completedMaterialIds.add(id));
          if (unsynced.length) {
            await Promise.all(
              unsynced.map((materialId: string) =>
                apiFetch("/progress", {
                  method: "POST",
                  body: {
                    user_id: user.id,
                    course_id: courseId,
                    item_type: "material",
                    material_id: materialId,
                    status: "completed",
                    completed_at: new Date().toISOString(),
                  },
                }).catch(() => null)
              )
            );
          }
        } catch (e) {
          console.error('Error parsing local storage:', e);
        }
      }

      // Support server-tracked material completions if present
      courseProgress
        .filter((item) => item.item_type === "material" && item.material_id)
        .forEach((item) => completedMaterialIds.add(item.material_id));

      setCompletedMaterials(completedMaterialIds);
      try {
        const localKey = `completed_materials_${user.id}_${courseId}`;
        localStorage.setItem(localKey, JSON.stringify(Array.from(completedMaterialIds)));
      } catch (e) {
        console.error("Failed to update local storage with server progress", e);
      }
      setBlockedQuizIds(quizProgressIds);
    } catch (error) {
      console.error("Failed to load progress", error);
    }
  };

  const handleConfirmQuizStart = async () => {
    if (!pendingQuizStart) return;
    if (!courseId) {
      toast.error("Course unavailable");
      return;
    }
    try {
      setQuizStartLoading(true);
      await apiFetch("/progress", {
        method: "POST",
        body: JSON.stringify({
          course_id: courseId,
          item_type: "quiz",
          quiz_id: pendingQuizStart.id,
          status: "in_progress",
          score: 0,
          max_score: pendingQuizStart.points || 100,
          percentage: 0,
          completed_at: new Date().toISOString(),
        }),
      });

      setBlockedQuizIds((prev) => {
        const next = new Set(prev);
        next.add(pendingQuizStart.id);
        return next;
      });
      setSectionQuizzes((prev) => prev.filter((quiz) => quiz.id !== pendingQuizStart.id));
      setSelectedFile(pendingQuizStart);

      await loadUserProgress();
      setPendingQuizStart(null);
      toast.success("Quiz started. You will not be able to retake it.");
    } catch (error) {
      console.error("Failed to start quiz:", error);
      toast.error("Could not start the quiz. Please try again.");
    } finally {
      setQuizStartLoading(false);
    }
  };

  const checkAndGenerateCertificate = async () => {
    if (!user || !courseId) return;

    try {
      // Only admins can create certificates via API; skip silently for students
      if (!(isAdminFromAuth || isTeacher)) return;
      const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      await apiFetch("/certificates", {
        method: "POST",
        body: {
          user_id: user.id,
          course_id: courseId,
          certificate_number: certificateNumber,
          completion_date: new Date().toISOString(),
        },
      });
      setCertificateDialogOpen(true);
    } catch (error: any) {
      console.error('Error generating certificate:', error);
    }
  };

  const handleMarkComplete = async (materialId: string) => {
    if (!user || !courseId) return;

    try {
      // Check if already completed
      if (completedMaterials.has(materialId)) {
        toast.info("Already marked as complete");
        return;
      }

      // Insert progress tracking record with material reference
      await apiFetch("/progress", {
        method: "POST",
        body: {
          user_id: user.id,
          course_id: courseId,
          item_type: "material",
          material_id: materialId,
          status: "completed",
          completed_at: new Date().toISOString(),
        },
      });

      // Update local state
      const newCompleted = new Set([...completedMaterials, materialId]);
      setCompletedMaterials(newCompleted);

      // Save to localStorage
      const localKey = `completed_materials_${user.id}_${courseId}`;
      localStorage.setItem(localKey, JSON.stringify(Array.from(newCompleted)));

      const totalItems = materials.length;
      const updatedPercent = totalItems
        ? Math.min(100, Math.round((newCompleted.size / totalItems) * 100))
        : 0;
      try {
        await apiFetch("/enrollments/progress", {
          method: "PATCH",
          body: {
            course_id: courseId,
            progress: updatedPercent,
          },
        });
      } catch (error) {
        console.error("Failed to sync enrollment progress", error);
      }

      toast.success("Marked as complete");
    } catch (error: any) {
      console.error("Error marking complete:", error);
      toast.error(error.message || "Failed to mark as complete");
    }
  };

  const loadCourseData = async () => {
    if (!courseId) return;
    try {
      const data = await apiFetch<any>(`/courses/${courseId}`);
      setCourse(data);

      const sectionsRaw = data.sections || data.course_sections || [];

      // Normalize sections
      let normalizedSections = sectionsRaw.map((s: any, idx: number) => {
        const originalId = keyify(s?.id || s?.section_id || s?.sectionId || `section-${idx}`);
        const title =
          s?.title || s?.name || s?.section_title || s?.sectionName || s?.section_name || "Untitled Section";
        const slug = generateSectionSlug(s, idx);
        return {
          ...s,
          id: originalId,
          slug,
          title,
        };
      });

      // Gather content from both top-level and nested under sections
      const materialList: any[] = [
        ...(data.materials || []).map((m: any) => ({
          ...m,
          file_path: m.file_path || m.link_url || m.url || "",
        })),
        ...sectionsRaw.flatMap((s: any) =>
          (s.materials || []).map((m: any) => ({
            ...m,
            file_path: m.file_path || m.link_url || m.url || "",
            section_id: keyify(m.section_id || s.id || s.section_id || s.sectionId || s.title),
          }))
        ),
      ];
      const assignmentList: any[] = [
        ...(data.assignments || []),
        ...sectionsRaw.flatMap((s: any) =>
          (s.assignments || []).map((a: any) => ({
            ...a,
            unit_name: keyify(a.unit_name || a.section_id || s.id || s.section_id || s.sectionId || s.title),
            file_type: "assignment",
            _isAssignment: true,
            course_id: courseId,
          }))
        ),
      ];
      const quizList: any[] = [
        ...(data.quizzes || []),
        ...sectionsRaw.flatMap((s: any) =>
          (s.quizzes || []).map((q: any) => ({
            ...q,
            section_id: keyify(q.section_id || s.id || s.section_id || s.sectionId || s.title),
            file_type: "quiz",
            _isQuiz: true,
          }))
        ),
      ];

      // Create fallback section if API didn't send any but content exists
      if (!normalizedSections.length && (materialList.length || assignmentList.length || quizList.length)) {
        normalizedSections = [{ id: "default-section", slug: "default-section", title: "Course Content" }];
      }
      const defaultSectionIdLocal = normalizedSections[0]?.id || "default-section";
      const defaultSectionSlugLocal =
        normalizedSections[0]?.slug ||
        normalizeIdentifier(normalizedSections[0]?.title) ||
        normalizeIdentifier(normalizedSections[0]?.name) ||
        "default-section";
      setDefaultSectionId(defaultSectionIdLocal);
      setDefaultSectionSlug(defaultSectionSlugLocal);

      const normalizeMaterial = (m: any) => {
        const link = m.file_path || m.link_url || m.url || "";
        const isDriveLink = /drive\.google\.com|docs\.google\.com/i.test(link);
        const inferredType = isDriveLink ? "google_drive" : m.file_type;
        return {
          ...m,
          file_path: link,
          file_type: inferredType || m.file_type,
          section_id: getItemSectionKey(m) || defaultSectionIdLocal,
          title: m.title || m.name || m.file_name || "Untitled Material",
        };
      };
      const normalizeAssignment = (a: any) => ({
        ...a,
        unit_name: getItemSectionKey(a) || defaultSectionIdLocal,
        title: a.title || a.name || "Untitled Assignment",
        file_type: "assignment",
        _isAssignment: true,
        course_id: courseId,
      });
      const normalizeQuiz = (q: any) => ({
        ...q,
        section_id: getItemSectionKey(q) || defaultSectionIdLocal,
        title: q.title || q.name || "Quiz",
        file_type: "quiz",
        _isQuiz: true,
      });

      const materialsData = materialList.map(normalizeMaterial);
      const assignmentsData = assignmentList.map(normalizeAssignment);
      const quizzesData = quizList.map(normalizeQuiz);
      const assignmentsToFix: { id: string; section_id: string }[] = [];
      const assignmentsWithSection = assignmentsData.map((assignment) => {
        const sectionMatch = findAssignmentSectionMatch(
          assignment,
          normalizedSections,
          defaultSectionSlugLocal,
          defaultSectionIdLocal
        );
        const existingSectionId = assignment.section_id || assignment.sectionId;
        const sectionKey =
          existingSectionId ||
          (sectionMatch.matched ? sectionMatch.sectionKey : "") ||
          defaultSectionIdLocal;
        if (!existingSectionId && sectionMatch.matched && sectionMatch.sectionKey) {
          assignmentsToFix.push({ id: assignment.id, section_id: sectionMatch.sectionKey });
        }
        return {
          ...assignment,
          assigned_section_slug: sectionMatch.slug,
          section_id: sectionKey,
          sectionId: sectionKey,
        };
      });

      const isVisible = (item: any) => (isPrivilegedUser ? true : item.is_hidden !== true);
      const visibleMaterials = materialsData.filter(isVisible);
      const visibleAssignments = assignmentsWithSection.filter(isVisible);
      const visibleQuizzes = quizzesData.filter(
        (item) => isVisible(item) && (isPrivilegedUser || !blockedQuizIds.has(item.id))
      );

      setSections(normalizedSections);
      const openState: Record<string, boolean> = {};
      normalizedSections.forEach((s: any) => { openState[getSectionKey(s)] = true; });
      setOpenSections(openState);

      setMaterials(visibleMaterials);
      setAssignments(visibleAssignments);
      setSectionQuizzes(visibleQuizzes);

      if (isPrivilegedUser && assignmentsToFix.length) {
        const updates = assignmentsToFix.map((assignment) =>
          apiFetch(`/assignments/${assignment.id}`, {
            method: "PATCH",
            body: { section_id: assignment.section_id },
          }).catch(() => null)
        );
        await Promise.all(updates);
      }

      // Auto-select first available item for students so the viewer isn't empty
        if (!isAdmin) {
          const defaultSelection =
            visibleMaterials[0] ||
            visibleAssignments[0] ||
            null;
          setSelectedFile(defaultSelection);
        }

      const enrollmentsData = data.enrollments || [];
      setEnrolledStudents(enrollmentsData);

      if (canManageUsers) {
        try {
          const usersData = await apiFetch<any[]>("/users");
          setUsers(usersData);
        } catch (e) {
          console.error("Failed to load users", e);
        }
      }
    } catch (error: any) {
      console.error("Failed to load course", error);
      toast.error(error.message || "Failed to load course");
      setCourse({ title: "Course not found", code: "", category: "" });
    }
  };

  const handleEnrollUser = async () => {
    if (!selectedUserId || !courseId) return;

    try {
      await apiFetch("/enrollments", {
        method: "POST",
        body: {
          user_id: selectedUserId,
          course_id: courseId,
          role: "student",
        },
      });
      toast.success("User enrolled successfully");
      setEnrollDialogOpen(false);
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || "Failed to enroll user");
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseId || !confirm("Are you sure you want to delete this course?")) return;

    try {
      await apiFetch(`/courses/${courseId}`, { method: "DELETE" });
      toast.success("Course deleted");
      window.location.href = "/courses";
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const sectionSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousSections = sections;
    const reordered = arrayMove(sections, oldIndex, newIndex);
    setSections(reordered);

    try {
      await apiFetch("/sections/reorder", {
        method: "POST",
        body: { order: reordered.map((section) => section.id) },
      });
    } catch (error: any) {
      setSections(previousSections);
      toast.error(error?.message || "Failed to reorder sections");
    }
  };

  const SortableSectionCard = ({ section }: { section: any }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: section.id });
    const isEditingSection = editingSectionId === section.id;
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };

    return (
      <div ref={setNodeRef} style={style}>
        <Card className="shadow-sm border border-border">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground"
                  aria-label="Drag to reorder section"
                  type="button"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <CardTitle className="text-base sm:text-lg break-words">
                  {isEditingSection ? (
                    <Input
                      value={editingSectionTitle}
                      onChange={(e) => setEditingSectionTitle(e.target.value)}
                      className="w-full sm:w-[220px]"
                    />
                  ) : (
                    section.title
                  )}
                </CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isEditingSection ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => saveSectionTitle(section.id)}
                      disabled={editingSectionSaving}
                      className="gap-2 w-full sm:w-auto"
                    >
                      {editingSectionSaving ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEditingSection}
                      className="gap-1 w-full sm:w-auto"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEditingSection(section)}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Edit2 className="h-3 w-3" />
                    Rename
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    const context = resolveSectionContext(section);
                    setCurrentSectionId(context.id);
                    setActivityDialogOpen(true);
                  }}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Add an activity
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const sectionContext = mapSectionToDialogContext(section);
                    setAssignmentSectionContext(sectionContext);
                    setCurrentSectionId(sectionContext.id);
                    setAssignmentDialogOpen(true);
                  }}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Upload className="h-4 w-4" />
                  Add assignment
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteSection(section.id || defaultSectionId)}
                  className="gap-2 text-destructive w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete section
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DraggableMaterialList
              materials={materials.filter((m) => {
                const sectionKey = getSectionKey(section) || defaultSectionId;
                const key = getItemSectionKey(m) || defaultSectionId;
                return key === sectionKey;
              })}
              onReorder={async (reordered) => {
                setMaterials((prevMaterials) => {
                  const sectionKey = getSectionKey(section) || defaultSectionId;
                  let pointer = 0;
                  return prevMaterials.map((m) => {
                    const key = getItemSectionKey(m) || defaultSectionId;
                    if (key === sectionKey) {
                      const replacement = reordered[pointer] || m;
                      pointer += 1;
                      return replacement;
                    }
                    return m;
                  });
                });
                try {
                  await apiFetch("/materials/reorder", {
                    method: "POST",
                    body: { order: reordered.map((r) => r.id) },
                  });
                } catch (error) {
                  console.error("Reorder failed", error);
                }
              }}
              onDelete={async (id) => {
                try {
                  await apiFetch(`/materials/${id}`, { method: "DELETE" });
                  loadCourseData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to delete material");
                }
              }}
              onUpdate={async (id, updates) => {
                try {
                  await apiFetch(`/materials/${id}`, {
                    method: "PATCH",
                    body: updates,
                  });
                  loadCourseData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to update material");
                }
              }}
              getFileIcon={(fileType: string) => {
                if (fileType?.includes("video")) return <Video className="h-4 w-4" />;
                if (fileType?.includes("pdf")) return <FileText className="h-4 w-4" />;
                if (fileType?.includes("text/html")) return <BookOpen className="h-4 w-4" />;
                return <File className="h-4 w-4" />;
              }}
            />

            <DraggableAssignmentList
              assignments={assignments.filter((a) =>
                doesAssignmentBelongToSection(a, section)
              )}
              onDelete={async (id) => {
                try {
                  await apiFetch(`/assignments/${id}`, { method: "DELETE" });
                  loadCourseData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to delete assignment");
                }
              }}
              onUpdate={async (id, updates) => {
                try {
                  await apiFetch(`/assignments/${id}`, { method: "PATCH", body: updates });
                  loadCourseData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to update assignment");
                }
              }}
              onToggleHide={async (id, isHidden) => {
                try {
                  await apiFetch(`/assignments/${id}`, { method: "PATCH", body: { is_hidden: isHidden } });
                  loadCourseData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to update visibility");
                }
              }}
              onSetDeadline={openAssignmentDeadlineDialog}
            />

            <DraggableQuizList
              quizzes={sectionQuizzes.filter((q) => {
                const sectionKey = getSectionKey(section) || defaultSectionId;
                const key = getItemSectionKey(q) || defaultSectionId;
                return key === sectionKey;
              })}
              onDelete={async (id) => {
                try {
                  await apiFetch(`/quizzes/${id}`, { method: "DELETE" });
                  loadCourseData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to delete quiz");
                }
              }}
              onUpdate={async (id, updates) => {
                try {
                  await apiFetch(`/quizzes/${id}`, { method: "PATCH", body: updates });
                  loadCourseData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to update quiz");
                }
              }}
              onToggleHide={async (id, isHidden) => {
                try {
                  await apiFetch(`/quizzes/${id}`, { method: "PATCH", body: { is_hidden: isHidden } });
                  loadCourseData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to update quiz visibility");
                }
              }}
              onSetDeadline={openQuizDeadlineDialog}
            />
          </CardContent>
        </Card>
      </div>
    );
  };

  const getActiveSectionId = () => currentSectionId || defaultSectionId;

  const getSectionOrderingKey = (sectionId?: string) => {
    const candidateId = sectionId || getActiveSectionId() || defaultSectionId;
    return keyify(candidateId) || defaultSectionId;
  };

  const getNextMaterialOrderIndex = (sectionId?: string) => {
    const orderingKey = getSectionOrderingKey(sectionId);
    let maxIndex = -1;
    materials.forEach((item) => {
      const itemKey = getItemSectionKey(item) || defaultSectionId;
      if (itemKey !== orderingKey) return;
      const currentIndex = Number(item?.order_index ?? 0);
      if (Number.isFinite(currentIndex) && currentIndex > maxIndex) {
        maxIndex = currentIndex;
      }
    });
    return (maxIndex + 1).toString();
  };

  const handleAddSection = async () => {
    if (!newSection.title || !courseId) return;

    try {
      await apiFetch("/sections", {
        method: "POST",
        body: {
          course_id: courseId,
          title: newSection.title,
          description: newSection.description,
          order_index: sections.length,
        },
      });
      toast.success("Section added");
      setSectionDialogOpen(false);
      setNewSection({ title: "", description: "" });
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!courseId || !sectionId) return;
    if (!confirm("Are you sure you want to delete this section?")) return;

    try {
      await apiFetch(`/sections/${sectionId}`, { method: "DELETE" });
      toast.success("Section deleted");
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete section");
    }
  };

  const startEditingSection = (section: any) => {
    setEditingSectionId(section.id);
    setEditingSectionTitle(section.title || section.name || "");
  };

  const cancelEditingSection = () => {
    setEditingSectionId(null);
    setEditingSectionTitle("");
  };

  const saveSectionTitle = async (sectionId: string) => {
    if (!editingSectionId || !editingSectionTitle.trim()) {
      toast.error("Section title cannot be empty");
      return;
    }
    setEditingSectionSaving(true);
    try {
      await apiFetch(`/sections/${sectionId}`, {
        method: "PATCH",
        body: { title: editingSectionTitle.trim() },
      });
      setSections((prev) =>
        prev.map((section) =>
          section.id === sectionId ? { ...section, title: editingSectionTitle.trim() } : section
        )
      );
      toast.success("Section title updated");
      cancelEditingSection();
    } catch (error: any) {
      toast.error(error.message || "Failed to update section title");
    } finally {
      setEditingSectionSaving(false);
    }
  };

  const handleAddTextLesson = async () => {
    const sectionId = currentSectionId || getActiveSectionId();
    if (!newTextLesson.title || !newTextLesson.content || !sectionId || !courseId) {
      toast.error("Please provide title, content, and section");
      return;
    }
    setActivityLoading(true);
    try {
      const fd = new FormData();
      fd.append("course_id", courseId);
      fd.append("section_id", sectionId);
      fd.append("title", newTextLesson.title);
      fd.append("content", newTextLesson.content);
      fd.append("order_index", getNextMaterialOrderIndex(sectionId));

      await apiFetch("/materials", { method: "POST", body: fd, timeoutMs: 600000 });

      toast.success("Activity added successfully");
      setTextLessonDialogOpen(false);
      setNewTextLesson({ title: "", content: "" });
      loadCourseData();
    } catch (error: any) {
      console.error("Text lesson upload failed", error);
      toast.error(error.message || "Failed to add text lesson");
    } finally {
      setActivityLoading(false);
    }
  };

  const uploadMaterialFile = async (
    file: File,
    title: string,
    sectionId: string,
    options: {
      description?: string;
      orderIndex?: string;
      extraFields?: Record<string, string>;
      signal?: AbortSignal;
    } = {}
  ) => {
    const handleDirectProgress = (progress: DirectUploadProgress) => {
      setActiveUploadMode("direct");
      setUploadProgress(progress.percent);
    };

    const handleChunkProgress = (progress: ChunkUploadProgress) => {
      setActiveUploadMode("chunked");
      const percent = Math.round(
        (progress.uploadedChunks / Math.max(1, progress.totalChunks)) * 100
      );
      setUploadProgress(percent);
    };

    let uploadResult;
    setUploadProgress(null);
    setActiveUploadMode(null);

    try {
      uploadResult = await (async () => {
        try {
          return await directUploadFile(file, {
            signal: options.signal,
            onProgress: handleDirectProgress,
          });
        } catch (error) {
          console.warn("Direct upload failed, falling back to chunked upload", error);
          return await chunkedUploadFile(file, {
            signal: options.signal,
            onProgress: handleChunkProgress,
          });
        }
      })();

      const payload = new FormData();
      payload.append("course_id", courseId || "");
      payload.append("section_id", sectionId);
      payload.append("title", title);
      payload.append("order_index", options.orderIndex ?? getNextMaterialOrderIndex(sectionId));
      payload.append("uploaded_file_id", uploadResult.fileIdentifier);
      payload.append("uploaded_file_size", uploadResult.size.toString());
      payload.append("uploaded_file_mime_type", uploadResult.mimeType);
      if (options.description) {
        payload.append("description", options.description);
      }
      if (options.extraFields) {
        Object.entries(options.extraFields).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            payload.append(key, value);
          }
        });
      }

      await apiFetch("/materials", {
        method: "POST",
        body: payload,
        timeoutMs: MATERIAL_UPLOAD_TIMEOUT,
      });
    } finally {
      setUploadProgress(null);
      setActiveUploadMode(null);
    }
  };

  const handleUploadMaterials = async () => {
    const sectionId = getActiveSectionId();
    if (uploadFiles.length === 0 || !fileDisplayName || !sectionId) {
      toast.error("Please provide a display name and ensure a section is selected");
      return;
    }
    setActivityLoading(true);

    try {
      let nextOrderIndex = Number(getNextMaterialOrderIndex(sectionId));
      for (const file of uploadFiles) {
        await uploadMaterialFile(file, fileDisplayName, sectionId, {
          orderIndex: nextOrderIndex.toString(),
        });
        nextOrderIndex += 1;
      }

      toast.success("Activity added successfully");
      setUploadFiles([]);
      setFileDisplayName("");
      setActivityDialogOpen(false);
      setActivityType(null);
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleAddAssignment = async () => {
    const sectionContext =
      assignmentSectionContext ||
      getAssignmentDialogSectionContext() || {
        id: defaultSectionId,
        slug: defaultSectionSlug || "default-section",
        title: "Course Section",
      };

    const resolvedSection = findSectionRecordByContext(sectionContext);
    const resolvedSectionId =
      resolvedSection?.id ||
      resolvedSection?.section_id ||
      resolvedSection?.sectionId ||
      sectionContext.id;
    const sectionPayloadId = sectionContext.id || resolvedSectionId || defaultSectionId;
    const sectionSlug =
      resolvedSection?.slug ||
      sectionContext.slug ||
      normalizeIdentifier(sectionContext.title) ||
      normalizeIdentifier(sectionContext.name) ||
      defaultSectionSlug ||
      "default-section";
    const materialOrderIndex = getNextMaterialOrderIndex(sectionPayloadId);

    if (!newAssignment.title || !courseId || !sectionPayloadId) {
      toast.error("Title, course, and section are required");
      return;
    }

    setActivityLoading(true);
    try {
      let dueDate = null;
      if (newAssignment.due_date) {
        const localDate = new Date(newAssignment.due_date);
        const uaeOffset = 4 * 60;
        const localOffset = localDate.getTimezoneOffset();
        const totalOffset = uaeOffset + localOffset;
        localDate.setMinutes(localDate.getMinutes() - totalOffset);
        dueDate = localDate.toISOString().split("T")[0];
      }

      const courseCode = course?.code || course?.course_code || `COURSE-${courseId}`;
      const payload: Record<string, any> = {
        title: newAssignment.title.trim(),
        course: courseId,
        course_code: courseCode,
        unit_name: newAssignment.unit_name || sectionSlug,
        points: Number(newAssignment.points || 100),
        passing_marks: Number(newAssignment.passing_marks || 50),
        description: newAssignment.description || "",
        assessment_brief: newAssignment.assessment_brief || "",
        priority: "medium",
        hours_left: "0",
        attempts: 2,
        section_id: resolvedSectionId || sectionPayloadId,
      };

      if (dueDate) {
        payload.due_date = dueDate;
      }

      await apiFetch<{ id: string }>("/assignments", {
        method: "POST",
        body: payload,
      });

      if (assignmentFile) {
        await uploadMaterialFile(assignmentFile, `${newAssignment.title} - Brief`, sectionPayloadId, {
          orderIndex: materialOrderIndex,
        });
      }

      toast.success("Activity added successfully");
      setAssignmentDialogOpen(false);
      setNewAssignment(getDefaultAssignmentState());
      setAssignmentFile(null);
      setAssignmentSectionContext(null); // Clear the context
      loadCourseData();
    } catch (error: any) {
      console.error("Assignment creation failed", error, error?.data);
      const detail =
        error?.data?.message ||
        error?.data?.error ||
        (error?.data?.errors ? Object.values(error.data.errors).flat().join(" ") : null);
      toast.error(detail || error.message || "Failed to add assignment");
    } finally {
      setActivityLoading(false);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!submissionFile || !selectedAssignment || !user) return;

    try {
      const fd = new FormData();
      fd.append("file", submissionFile);
      if (courseId) fd.append("course_id", courseId);
      await apiFetch(`/assignments/${selectedAssignment.id}/submit`, { method: "POST", body: fd });

      toast.success("Assignment submitted");
      setSubmissionDialogOpen(false);
      setSubmissionFile(null);
      setSelectedAssignment(null);
      loadUserSubmissions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddQuiz = async () => {
    // Use currentSectionId from state directly
    const targetSectionId = currentSectionId || getActiveSectionId();

    if (!newQuiz.title || !newQuiz.quiz_url || !targetSectionId || !courseId) {
      toast.error("Please provide title, URL, and section");
      return;
    }

    setActivityLoading(true);

    try {
      // Convert datetime-local to UAE timezone (UTC+4) ISO string
      let dueDate = null;
      if (newQuiz.due_date) {
        // datetime-local gives us local time, treat it as UAE time
        const localDate = new Date(newQuiz.due_date);
        // Adjust to UAE timezone (UTC+4)
        const uaeOffset = 4 * 60; // 4 hours in minutes
        const localOffset = localDate.getTimezoneOffset(); // local offset in minutes (negative for UAE)
        const totalOffset = uaeOffset + localOffset;
        localDate.setMinutes(localDate.getMinutes() - totalOffset);
        dueDate = localDate.toISOString();
      }

      await apiFetch("/quizzes", {
        method: "POST",
        body: {
          course_id: courseId,
          section_id: targetSectionId,
          title: newQuiz.title,
          quiz_url: newQuiz.quiz_url,
          description: newQuiz.description,
          duration: newQuiz.duration,
          due_date: dueDate,
        },
      });
      toast.success("Activity added successfully");
      setActivityDialogOpen(false);
      setActivityType(null);
      setNewQuiz({ title: "", quiz_url: "", description: "", duration: 30, due_date: "" });
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || "Failed to add quiz");
    } finally {
      setActivityLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm("Delete this quiz?")) return;

    try {
      await apiFetch(`/quizzes/${quizId}`, { method: "DELETE" });
      toast.success("Quiz deleted");
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes("video")) return <Video className="h-4 w-4" />;
    if (fileType?.includes("pdf")) return <FileText className="h-4 w-4" />;
    if (fileType?.includes("text/html")) return <BookOpen className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleReorderMaterials = async (sectionId: string, reorderedMaterials: any[]) => {
    try {
      await apiFetch("/materials/reorder", {
        method: "POST",
        body: { order: reorderedMaterials.map((m) => m.id) },
      });
      loadCourseData();
      toast.success('Materials reordered');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reorder materials');
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      const material = materials.find(m => m.id === materialId);
      if (!material) return;
      await apiFetch(`/materials/${materialId}`, { method: "DELETE" });
      toast.success('Material deleted');
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete material');
    }
  };

  const handleUpdateMaterial = async (materialId: string, updates: any) => {
    try {
      await apiFetch(`/materials/${materialId}`, { method: "PATCH", body: updates });
      toast.success('Material updated');
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update material');
    }
  };

  const handleUpdateAssignment = async (assignmentId: string, updates: any) => {
    try {
      await apiFetch(`/assignments/${assignmentId}`, { method: "PATCH", body: updates });
      toast.success('Assignment updated');
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update assignment');
    }
  };

  const handleUpdateQuiz = async (quizId: string, updates: any) => {
    try {
      await apiFetch(`/quizzes/${quizId}`, { method: "PATCH", body: updates });
      toast.success('Quiz updated');
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update quiz');
    }
  };

  const handleSetUserDeadline = async () => {
    if (!selectedUserForDeadline || !customDeadline) {
      if (selectedAssignmentForDeadline && !selectedUserForDeadline) {
        toast.error("Please select a user");
        return;
      }
      if (!customDeadline) {
        toast.error("Please set a deadline");
        return;
      }
    }

    try {
      if (selectedAssignmentForDeadline) {
        // Set deadline for assignment
        await apiFetch(`/assignments/${selectedAssignmentForDeadline.id}/deadline`, {
          method: "POST",
          body: { user_id: selectedUserForDeadline || getDefaultDeadlineUser(), deadline: customDeadline },
        });
        toast.success("Custom assignment deadline set successfully");
      } else if (selectedQuizForDeadline) {
        // Update quiz deadline
        await apiFetch(`/quizzes/${selectedQuizForDeadline.id}/deadline`, {
          method: "POST",
          body: { user_id: selectedUserForDeadline || user?.id, deadline: customDeadline },
        });
        toast.success("Quiz deadline set successfully");
      }

      setDeadlineDialogOpen(false);
      setSelectedAssignmentForDeadline(null);
      setSelectedQuizForDeadline(null);
      setSelectedUserForDeadline("");
      setCustomDeadline("");
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || "Failed to set deadline");
    }
  };

  const formatDateForInput = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    const tzAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return tzAdjusted.toISOString().slice(0, 16);
  };

  const resolveUserSelectionId = (user: any) => user?.user_id ?? user?.id ?? "";

  const mergeUsers = (enrolled: any[], all: any[]) => {
    const seen = new Set<string>();
    const merged: any[] = [];

    const addUser = (entry: any) => {
      const id = resolveUserSelectionId(entry);
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push(entry);
    };

    enrolled.forEach(addUser);
    all.forEach(addUser);

    return merged;
  };

  const mergedUserOptions = mergeUsers(enrolledStudents, users);
  const deadlineUserOptions = mergedUserOptions
    .map((candidate) => ({
      selectionId: resolveUserSelectionId(candidate),
      user: candidate,
    }))
    .filter((entry) => entry.selectionId);

  const getDefaultDeadlineUser = (options?: any[]) => {
    const list = options ?? mergedUserOptions;
    if (list?.length) {
      const selectionId = resolveUserSelectionId(list[0]);
      if (selectionId) return selectionId;
    }
    if (user?.id) return user.id;
    return "";
  };

  const ensureUsersLoaded = async (): Promise<any[]> => {
    let merged = mergeUsers(enrolledStudents, users);
    if (merged.length > 0 || !canManageUsers) return merged;
    try {
      const data = await apiFetch<any[]>("/users");
      setUsers(data || []);
      merged = mergeUsers(enrolledStudents, data || []);
    } catch (e) {
      console.error("Failed to load users for deadline dialog", e);
    }
    return merged;
  };

  const openAssignmentDeadlineDialog = async (assignment: any) => {
    const options = await ensureUsersLoaded();
    const defaultUser = getDefaultDeadlineUser(options);
    setSelectedAssignmentForDeadline(assignment);
    setSelectedQuizForDeadline(null);
    setSelectedUserForDeadline(defaultUser);
    setCustomDeadline(formatDateForInput(assignment?.custom_deadline || assignment?.due_date));
    setDeadlineDialogOpen(true);
  };

  const openQuizDeadlineDialog = async (quiz: any) => {
    const options = await ensureUsersLoaded();
    const defaultUser = getDefaultDeadlineUser(options);
    setSelectedQuizForDeadline(quiz);
    setSelectedAssignmentForDeadline(null);
    setSelectedUserForDeadline(defaultUser);
    setCustomDeadline(formatDateForInput(quiz?.custom_deadline || quiz?.due_date));
    setDeadlineDialogOpen(true);
  };

  const handleToggleHideMaterial = async (materialId: string, currentlyHidden: boolean) => {
    try {
      await apiFetch(`/materials/${materialId}`, {
        method: "PATCH",
        body: { is_hidden: !currentlyHidden },
      });
      toast.success(currentlyHidden ? 'Material visible to students' : 'Material hidden from students');
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update visibility');
    }
  };

  const handleToggleHideAssignment = async (assignmentId: string, currentlyHidden: boolean) => {
    try {
      await apiFetch(`/assignments/${assignmentId}`, {
        method: "PATCH",
        body: { is_hidden: !currentlyHidden },
      });
      toast.success(currentlyHidden ? 'Assignment visible to students' : 'Assignment hidden from students');
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update visibility');
    }
  };

  const handleToggleHideQuiz = async (quizId: string, currentlyHidden: boolean) => {
    try {
      await apiFetch(`/quizzes/${quizId}`, {
        method: "PATCH",
        body: { is_hidden: !currentlyHidden },
      });
      toast.success(currentlyHidden ? 'Quiz visible to students' : 'Quiz hidden from students');
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update visibility');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Delete this assignment?")) return;

    try {
      await apiFetch(`/assignments/${assignmentId}`, { method: "DELETE" });
      toast.success('Assignment deleted');
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete assignment');
    }
  };

  const handleAddPdf = async () => {
    const sectionId = getActiveSectionId();
    if (!pdfFile || !pdfTitle || !sectionId || !courseId) {
      toast.error("Please provide a title, PDF file, and section");
      return;
    }

    try {
      setPdfUploading(true);
      await uploadMaterialFile(pdfFile, pdfTitle, sectionId, {
        orderIndex: getNextMaterialOrderIndex(sectionId),
        extraFields: { file_type: "pdf" },
      });

      toast.success("Activity added successfully");
      setPdfTitle("");
      setPdfFile(null);
      setActivityDialogOpen(false);
      setActivityType(null);
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || "Failed to add PDF");
    } finally {
      setPdfUploading(false);
    }
  };

  const handleAddPowerPoint = async () => {
    const sectionId = getActiveSectionId();
    if (!pptFile || !pptTitle || !sectionId || !courseId) {
      toast.error("Please provide a title, PowerPoint file, and section");
      return;
    }

    try {
      setPptUploading(true);
      await uploadMaterialFile(pptFile, pptTitle, sectionId, {
        orderIndex: getNextMaterialOrderIndex(sectionId),
        extraFields: { file_type: "presentation" },
      });

      toast.success("Activity added successfully");
      setPptTitle("");
      setPptFile(null);
      setActivityDialogOpen(false);
      setActivityType(null);
      loadCourseData();
    } catch (error: any) {
      toast.error(error.message || "Failed to add PowerPoint");
    } finally {
      setPptUploading(false);
    }
  };

  const handleAddVideoLecture = async () => {
    const sectionId = getActiveSectionId();
    if (!videoFile || !videoTitle || !sectionId || !courseId) {
      toast.error("Please provide title, video file, and section");
      return;
    }

    setActivityLoading(true);

    try {
      await uploadMaterialFile(videoFile, videoTitle, sectionId, { description: videoTitle });
      toast.success("Activity added successfully");
      setVideoTitle("");
      setVideoFile(null);
      setActivityDialogOpen(false);
      setActivityType(null);
      loadCourseData();
    } catch (error: any) {
      console.error("Video upload failed", error);
      toast.error(error.message || "Failed to add video lecture");
    } finally {
      setActivityLoading(false);
    }
  };

  const handleAddAssessmentBrief = async () => {
    const sectionId = getActiveSectionId();
    if (!newAssignment.title || !sectionId || !courseId) {
      toast.error("Title, section, and course are required for the brief");
      return;
    }
    if (!assignmentFile && !newAssignment.assessment_brief) {
      toast.error("Please upload a file or enter brief content");
      return;
    }
    const orderIndex = getNextMaterialOrderIndex(sectionId);
    setActivityLoading(true);
    try {
      if (assignmentFile) {
        await uploadMaterialFile(assignmentFile, `${newAssignment.title} - Brief`, sectionId, {
          orderIndex,
        });
      } else if (newAssignment.assessment_brief) {
        const briefFile = new File(
          [newAssignment.assessment_brief],
          `${newAssignment.title || "brief"}.txt`,
          { type: "text/plain" }
        );
        await uploadMaterialFile(briefFile, `${newAssignment.title} - Brief`, sectionId, {
          orderIndex,
        });
      }

      toast.success("Activity added successfully");
      setNewAssignment(getDefaultAssignmentState());
      setAssignmentFile(null);
      setActivityDialogOpen(false);
      setActivityType(null);
      loadCourseData();
    } catch (error: any) {
      console.error("Assessment brief upload failed", error);
      toast.error(error.message || "Failed to add assessment brief");
    } finally {
      setActivityLoading(false);
    }
  };

  const normalizeDriveLink = (link: string) => {
    const trimmed = link.trim();
    if (!trimmed) return "";
    const withScheme =
      /^https?:\/\//i.test(trimmed) || !/^(drive|docs)\.google\.com/i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
    try {
      const url = new URL(withScheme);
      const host = url.hostname.toLowerCase();
      if (host.includes("drive.google.com")) {
        const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
        const fileId = fileMatch?.[1] || url.searchParams.get("id") || "";
        if (fileId) return `https://drive.google.com/file/d/${fileId}/preview?usp=sharing&embedded=true`;
      }
      if (host.includes("docs.google.com")) {
        const docMatch = url.pathname.match(/\/(document|presentation|spreadsheets|forms)\/d\/([^/]+)/);
        const docType = docMatch?.[1] || "";
        const docId = docMatch?.[2] || "";
        if (docType && docId) return `https://docs.google.com/${docType}/d/${docId}/preview?usp=sharing&embedded=true`;
      }
      return withScheme;
    } catch {
      return withScheme;
    }
  };

  const handleAddGoogleDrive = async () => {
    const sectionId = getActiveSectionId();
    if (!googleDriveUrl || !googleDriveTitle || !sectionId || !courseId) {
      toast.error("Please provide title, URL, and section");
      return;
    }

    setActivityLoading(true);

    try {
      const embedUrl = normalizeDriveLink(googleDriveUrl);
      const fd = new FormData();
      fd.append("course_id", courseId);
      fd.append("section_id", sectionId);
      fd.append("title", googleDriveTitle.trim());
      fd.append("link_url", embedUrl);
      fd.append("file_type", "google_drive");
      fd.append("order_index", getNextMaterialOrderIndex(sectionId));
      await apiFetch("/materials", { method: "POST", body: fd });

      toast.success("Activity added successfully");
      setGoogleDriveUrl("");
      setGoogleDriveTitle("");
      setActivityDialogOpen(false);
      setActivityType(null);
      loadCourseData();
    } catch (error: any) {
      console.error("Google Drive upload failed", error);
      toast.error(error.message || "Failed to add Google Drive content");
    } finally {
      setActivityLoading(false);
    }
  };


  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm("Delete this submission?")) return;

    try {
      await apiFetch(`/submissions/${submissionId}`, { method: "DELETE" });
      toast.success('Submission deleted');
      loadUserSubmissions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete submission');
    }
  };

  const downloadMaterial = async (filePath: string, title: string) => {
    try {
      // if filePath is already a URL, use it; otherwise build backend storage URL
      const isAbsolute = /^https?:\/\//i.test(filePath);
      const url = isAbsolute
        ? filePath
        : resolveStorageUrl(`/backend/storage/course-materials/${filePath.replace(/^\/+/, "")}`);
      const a = document.createElement("a");
      a.href = url;
      a.download = title;
      a.rel = "noopener";
      a.target = "_blank";
      a.click();
    } catch (error: any) {
      toast.error("Failed to download file");
    }
  };

  const toggleSection = (sectionId: string) => {
    const key = sectionId || defaultSectionId;
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const safeCourse = course ?? { title: "Course", code: "", category: "" };

  const studentSections = useMemo(() => {
    // Build a map of sections so every item has a place
    const map = new Map<string, { id: string; title: string; items: any[] }>();
    const ensureSection = (id: string, title?: string) => {
      if (!map.has(id)) {
        map.set(id, { id, title: title || "Course Content", items: [] });
      }
      return map.get(id)!;
    };

    const normalizedSections = sections.length
      ? sections
      : [{ id: defaultSectionId, title: "Course Content" }];

    normalizedSections.forEach((s) => ensureSection(getSectionKey(s) || defaultSectionId, s.title));

      const addItem = (item: any, type: "material" | "assignment" | "quiz") => {
        if (type === "quiz" && !isPrivilegedUser && blockedQuizIds.has(item.id)) {
          return;
        }
        const sectionKey = getItemSectionKey(item) || defaultSectionId;
        const section = ensureSection(sectionKey);
        section.items.push({ type, payload: item });
      };

    materials.forEach((m) => addItem(m, "material"));
    assignments.forEach((a) => addItem({ ...a, file_type: "assignment", _isAssignment: true }, "assignment"));
    sectionQuizzes.forEach((q) => addItem({ ...q, file_type: "quiz", _isQuiz: true }, "quiz"));

    return Array.from(map.values());
  }, [
    sections,
    materials,
    assignments,
    sectionQuizzes,
    defaultSectionId,
    blockedQuizIds,
    isPrivilegedUser,
  ]);

  const assignmentItems = useMemo(
    () =>
      studentSections
        .flatMap((section) => section.items)
        .filter((item) => item.type === "assignment"),
    [studentSections]
  );

  const quizItems = useMemo(
    () =>
      studentSections
        .flatMap((section) => section.items)
        .filter((item) => item.type === "quiz"),
    [studentSections]
  );
  const contentSections = useMemo(
    () =>
      studentSections.map((section) => ({
        ...section,
        items: section.items,
      })),
    [studentSections]
  );

  const assessmentItems = useMemo(
    () => [...assignmentItems, ...quizItems],
    [assignmentItems, quizItems]
  );

  const submittedAssignmentIds = useMemo(
    () => new Set(ensureArray(userSubmissions).map((s) => s.assignment_id).filter(Boolean)),
    [userSubmissions]
  );
  const assignmentIds = useMemo(
    () => assignments.map((a) => a.id).filter(Boolean),
    [assignments]
  );
  const completedAssignmentsCount = useMemo(
    () => assignmentIds.filter((id) => submittedAssignmentIds.has(id)).length,
    [assignmentIds, submittedAssignmentIds]
  );
  const trackableMaterialIds = useMemo(
    () => materials.map((m) => m.id).filter(Boolean),
    [materials]
  );
  const completedMaterialsCount = useMemo(() => {
    if (!trackableMaterialIds.length) return 0;
    const materialIdSet = new Set(trackableMaterialIds);
    let count = 0;
    completedMaterials.forEach((id) => {
      if (materialIdSet.has(id)) count += 1;
    });
    return count;
  }, [completedMaterials, trackableMaterialIds]);
  const progressPercent = useMemo(() => {
    const totalItems = trackableMaterialIds.length + assignmentIds.length;
    if (!totalItems) return 0;
    const completedCount =
      Math.min(completedMaterialsCount, trackableMaterialIds.length) +
      Math.min(completedAssignmentsCount, assignmentIds.length);
    return Math.min(100, Math.round((completedCount / totalItems) * 100));
  }, [
    trackableMaterialIds,
    assignmentIds,
    completedMaterialsCount,
    completedAssignmentsCount,
  ]);
  const storedProgress = useMemo(() => {
    if (!user?.id || !courseId) return 0;
    const localKey = `course_progress_${user.id}_${courseId}`;
    const raw = localStorage.getItem(localKey);
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
  }, [courseId, user?.id]);
  const displayedProgress = useMemo(
    () => Math.max(progressPercent, storedProgress),
    [progressPercent, storedProgress]
  );
  const isCourseComplete = useMemo(() => {
    const totalItems = trackableMaterialIds.length + assignmentIds.length;
    if (!totalItems) return false;
    const materialsComplete = trackableMaterialIds.length
      ? completedMaterialsCount >= trackableMaterialIds.length
      : true;
    const assignmentsComplete = assignmentIds.length
      ? completedAssignmentsCount >= assignmentIds.length
      : true;
    return materialsComplete && assignmentsComplete;
  }, [
    trackableMaterialIds,
    assignmentIds,
    completedMaterialsCount,
    completedAssignmentsCount,
  ]);
  const completionShownRef = useRef(false);

  useEffect(() => {
    completionShownRef.current = false;
    setCourseCompleteDialogOpen(false);
  }, [courseId]);

  useEffect(() => {
    lastSyncedProgressRef.current = null;
  }, [courseId]);

  useEffect(() => {
    if (!user || !courseId) return;
    const totalItems = trackableMaterialIds.length + assignmentIds.length;
    if (!totalItems) return;
    if (lastSyncedProgressRef.current === displayedProgress) return;
    lastSyncedProgressRef.current = displayedProgress;
    localStorage.setItem(
      `course_progress_${user.id}_${courseId}`,
      String(displayedProgress)
    );
    apiFetch("/enrollments/progress", {
      method: "PATCH",
      body: {
        course_id: courseId,
        progress: displayedProgress,
      },
    }).catch((error) => {
      console.error("Failed to sync enrollment progress", error);
    });
  }, [courseId, trackableMaterialIds.length, assignmentIds.length, displayedProgress, user]);

  useEffect(() => {
    if (isAdmin) return;
    if (!isCourseComplete || completionShownRef.current) return;
    completionShownRef.current = true;
    setCourseCompleteDialogOpen(true);
  }, [isAdmin, isCourseComplete]);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  const handleSidebarSelection = (type: string, payload: any) => {
    if (type === "quiz" && !isPrivilegedUser) {
      if (blockedQuizIds.has(payload?.id)) {
        toast.info("Quiz already started and cannot be retaken.");
        return;
      }
      setPendingQuizStart(payload);
      return;
    }
    setSelectedFile(payload);
    setPendingQuizStart(null);
  };

  const renderSidebarButton = (
    item: { type: string; payload: any },
    idx: number,
    options: { showCompletion?: boolean } = {}
  ) => {
    const { type, payload } = item;
    const fileTypeValue = String(payload?.file_type || "");
    const filePathValue = String(payload?.file_path || "");
    const fileNameValue = String(payload?.title || "");
    const ext = filePathValue.toLowerCase().split(".").pop() || "";
    const isPdf = fileTypeValue.includes("pdf") || ext === "pdf";
    const isPowerPoint = /powerpoint|presentation/.test(fileTypeValue) || ["ppt", "pptx"].includes(ext);
    const isVideo = fileTypeValue.includes("video");
    const isImage = fileTypeValue.includes("image");
    const isText = fileTypeValue.includes("text/html");
    const isBrief = fileTypeValue === "application/brief";
    const isDrive = fileTypeValue === "google_drive" || /drive\.google\.com|docs\.google\.com/i.test(filePathValue);

    const active =
      selectedFile?.id === payload.id &&
      ((type === "material" && !selectedFile._isAssignment && !selectedFile._isQuiz) ||
        (type === "assignment" && selectedFile._isAssignment) ||
        (type === "quiz" && selectedFile._isQuiz));
    const icon =
      type === "assignment" ? (
        <Upload className="h-4 w-4 text-orange-500" />
      ) : type === "quiz" ? (
        <FileQuestion className="h-4 w-4 text-blue-500" />
      ) : isText || isBrief ? (
        <BookOpen className="h-4 w-4 text-slate-600" />
      ) : isPdf ? (
        <FileText className="h-4 w-4 text-red-500" />
      ) : isPowerPoint ? (
        <Presentation className="h-4 w-4 text-amber-500" />
      ) : isVideo ? (
        <Video className="h-4 w-4 text-indigo-500" />
      ) : isImage ? (
        <File className="h-4 w-4 text-emerald-500" />
      ) : isDrive ? (
        <FileText className="h-4 w-4 text-green-500" />
      ) : (
        <File className="h-4 w-4 text-slate-500" />
      );
    const typeLabel =
      type === "assignment"
        ? "Assignment"
        : type === "quiz"
          ? "Quiz"
          : isText
            ? "Text Lesson"
            : isBrief
              ? "Brief"
              : isPdf
                ? "PDF"
                : isPowerPoint
                  ? "PowerPoint"
                  : isVideo
                    ? "Video"
                    : isImage
                      ? "Image"
                      : isDrive
                        ? "Drive"
                        : fileNameValue
                            ? "File"
                            : "Item";
    const sizeLabel = payload.file_size
      ? `${(payload.file_size / (1024 * 1024)).toFixed(2)} MB`
      : "";
    const subtitle =
      type === "assignment"
        ? payload.due_date
          ? `${typeLabel} - Due ${new Date(payload.due_date).toLocaleDateString()}`
          : typeLabel
        : type === "quiz"
          ? typeLabel
          : [typeLabel, sizeLabel || "Min"].filter(Boolean).join(" - ");
    const showCompletion = options.showCompletion && type === "material" && payload?.id;
    const isCompleted = payload?.id ? completedMaterials.has(payload.id) : false;

    return (
      <div
        key={`${type}-${payload.id}-${idx}`}
        className={cn(
          "px-4 py-3 border-b border-slate-100 last:border-b-0",
          active ? "bg-slate-100" : "bg-transparent"
        )}
      >
        <button
        onClick={() =>
          handleSidebarSelection(
            type,
            type === "material" && payload.file_type === "application/brief"
              ? {
                  ...payload,
                  _isBrief: true,
                  assessment_brief: payload.description,
                  file_path: payload.file_path,
                }
                : type === "material" &&
                  (payload.file_type === "google_drive" ||
                    /drive\.google\.com|docs\.google\.com/i.test(String(payload.file_path || payload.link_url || payload.url || "")))
                  ? {
                      ...payload,
                      file_path: payload.file_path || payload.link_url || payload.url || "",
                      file_type: "google_drive",
                    }
                  : payload
            )
          }
          className="flex items-start gap-3 w-full text-left"
        >
          <div className="mt-0.5 h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 whitespace-normal break-words">
              {payload.title}
            </p>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </button>
        {showCompletion && (
          <div
            className="mt-2 flex items-center justify-between text-[11px] text-slate-400"
            onClick={(event) => event.stopPropagation()}
          >
            <span>I read this lesson</span>
            <Switch
              checked={isCompleted}
              onCheckedChange={(checked) => {
                if (checked && payload?.id) {
                  handleMarkComplete(payload.id);
                }
              }}
              disabled={isCompleted}
            />
          </div>
        )}
      </div>
    );
  };

  // If we loaded items but nothing is selected, pick the first one for students
  useEffect(() => {
    if (isAdmin || selectedFile) return;
    const first = studentSections
      .flatMap((section) => section.items)
      .find((item) => item.type !== "quiz");
    if (first) setSelectedFile(first.payload);
  }, [isAdmin, selectedFile, studentSections]);

  // If course not loaded yet, render a simple loading state for both admin and student
  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Admin view - old layout with tabs
  if (isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">{course.title}</h1>
              <p className="text-muted-foreground">{course.code}</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 w-full sm:w-auto">
                    <UserPlus className="h-4 w-4" />
                    Enroll User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enroll User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter(u => !enrolledStudents.find(s => s.id === u.id)).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleEnrollUser}>Enroll</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="destructive" onClick={handleDeleteCourse} className="gap-2 w-full sm:w-auto">
                <Trash2 className="h-4 w-4" />
                Delete Course
              </Button>
            </div>
          </div>

          <Tabs defaultValue="content" className="space-y-4">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-lg sm:text-xl">Course Sections</CardTitle>
                  <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2 w-full sm:w-auto">
                        <Plus className="h-4 w-4" />
                        Add Section
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Section</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Title</Label>
                          <Input
                            value={newSection.title}
                            onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={newSection.description}
                            onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
                          />
                        </div>
                        <Button onClick={handleAddSection}>Add Section</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
              </Card>
              <DndContext
                sensors={sectionSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSectionDragEnd}
              >
                <SortableContext
                  items={sections.map((section) => section.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-6">
                    {sections.map((section) => (
                      <SortableSectionCard key={section.id} section={section} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </TabsContent>

            <TabsContent value="students">
              <Card>
                <CardHeader>
                  <CardTitle>Enrolled Students</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrolledStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>{student.full_name || "N/A"}</TableCell>
                            <TableCell>{student.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog
          open={deadlineDialogOpen}
          onOpenChange={async (open) => {
            if (open) {
              const options = await ensureUsersLoaded();
              if (!selectedUserForDeadline && options.length) {
                setSelectedUserForDeadline(getDefaultDeadlineUser(options));
              }
            }
            setDeadlineDialogOpen(open);
            if (!open) {
              setSelectedAssignmentForDeadline(null);
              setSelectedQuizForDeadline(null);
              setSelectedUserForDeadline("");
              setCustomDeadline("");
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Set Custom Deadline</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedAssignmentForDeadline
                  ? `Assignment: ${selectedAssignmentForDeadline.title}`
                  : selectedQuizForDeadline
                    ? `Quiz: ${selectedQuizForDeadline.title}`
                    : "Select an assignment or quiz to set a deadline."}
              </div>
              <div>
                <Label>User</Label>
                {mergedUserOptions.length ? (
                  <Select
                    value={selectedUserForDeadline}
                    onValueChange={setSelectedUserForDeadline}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose learner" />
                    </SelectTrigger>
                    <SelectContent>
                      {deadlineUserOptions.map(({ selectionId, user }) => (
                        <SelectItem key={selectionId} value={selectionId}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No users available. Enroll a learner first.</p>
                )}
              </div>
              <div>
                <Label>Deadline (local time)</Label>
                <Input
                  type="datetime-local"
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSetUserDeadline}
                className="w-full"
                disabled={!mergedUserOptions.length && !user?.id}
              >
                Save Deadline
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={assignmentDialogOpen}
          onOpenChange={(open) => {
            setAssignmentDialogOpen(open);
            if (!open) {
              setNewAssignment(getDefaultAssignmentState());
              setAssignmentFile(null);
              setAssignmentSectionContext(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl relative max-h-[90vh] overflow-auto fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {activityLoading && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-20 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding assignment...
                </div>
              </div>
            )}
            <DialogHeader>
              <DialogTitle>Add Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                />
              </div>
            <div>
              <Label>Section</Label>
              <div className="rounded-lg border border-input/40 bg-background px-3 py-2 text-sm text-muted-foreground">
                {assignmentSectionContext?.title || "No section selected"}
              </div>
            </div>
            <div>
              <Label>Unit name</Label>
              <Input
                value={newAssignment.unit_name}
                onChange={(e) =>
                  setNewAssignment((prev) => ({ ...prev, unit_name: e.target.value }))
                }
                placeholder="Optional unit identifier (e.g. Unit 1, Module A)"
              />
            </div>
              <div>
                <Label>Description</Label>
                <RichTextEditor
                  content={newAssignment.description || ""}
                  onChange={(content) => setNewAssignment({ ...newAssignment, description: content })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Points</Label>
                  <Input
                    type="number"
                    value={newAssignment.points}
                    onChange={(e) => setNewAssignment({ ...newAssignment, points: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Passing Marks</Label>
                  <Input
                    type="number"
                    value={newAssignment.passing_marks}
                    onChange={(e) => setNewAssignment({ ...newAssignment, passing_marks: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="datetime-local"
                  value={newAssignment.due_date}
                  onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddAssignment} disabled={activityLoading}>
                  {activityLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Add Assignment"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Activity Dialog */}
        <Dialog
          open={activityDialogOpen}
          onOpenChange={(open) => {
            setActivityDialogOpen(open);
            if (!open) {
              setActivityType(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl relative max-h-[90vh] overflow-auto fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {isActivityDialogBusy && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-20 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {activityOverlayLabel}
                </div>
              </div>
            )}
            <DialogHeader>
              <DialogTitle>Add Activity</DialogTitle>
              <DialogDescription className="sr-only">
                Choose the type of activity to add and upload its content.
              </DialogDescription>
            </DialogHeader>
            {!activityType ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => setActivityType("text")}
                >
                  <FileText className="h-8 w-8" />
                  Text Lesson
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => setActivityType("file")}
                >
                  <File className="h-8 w-8" />
                  File
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => setActivityType("pdf")}
                >
                  <FileText className="h-8 w-8" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => setActivityType("powerpoint")}
                >
                  <Presentation className="h-8 w-8" />
                  PowerPoint
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => {
                    if (sections.length) {
                      const context = resolveSectionContext(sections[0]);
                      setCurrentSectionId(context.id);
                    }
                    setActivityType("assignment");
                  }}
                >
                  <Upload className="h-8 w-8" />
                  Assignment
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => setActivityType("brief")}
                >
                  <FileQuestion className="h-8 w-8" />
                  Assessment Brief
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => setActivityType("quiz")}
                >
                  <BookOpen className="h-8 w-8" />
                  Quiz
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => setActivityType("google_drive")}
                >
                  <File className="h-8 w-8" />
                  Google Drive
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => setActivityType("video_lecture")}
                >
                  <Video className="h-8 w-8" />
                  Video Lecture
                </Button>
              </div>
            ) : activityType === "text" ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newTextLesson.title}
                    onChange={(e) => setNewTextLesson({ ...newTextLesson, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Content</Label>
                  <RichTextEditor
                    content={newTextLesson.content}
                    onChange={(content) => setNewTextLesson({ ...newTextLesson, content })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddTextLesson} disabled={activityLoading}>
                    {activityLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setActivityType(null);
                    setNewTextLesson({ title: "", content: "" });
                  }}>
                    Back
                  </Button>
                </div>
              </div>
            ) : activityType === "file" ? (
              <div className="space-y-4">
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={fileDisplayName}
                    onChange={(e) => setFileDisplayName(e.target.value)}
                    placeholder="Enter display name for the file"
                  />
                </div>
                <div>
                  <Label>Upload Files</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUploadMaterials} disabled={activityLoading}>
                    {activityLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setActivityType(null);
                    setFileDisplayName("");
                    setUploadFiles([]);
                  }}>
                    Back
                  </Button>
                </div>
              </div>
            ) : activityType === "pdf" ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    placeholder="Enter PDF title"
                  />
                </div>
                <div>
                  <Label>Upload PDF</Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddPdf} disabled={pdfUploading}>
                    {pdfUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add PDF"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setActivityType(null);
                    setPdfTitle("");
                    setPdfFile(null);
                  }}>
                    Back
                  </Button>
                </div>
              </div>
            ) : activityType === "powerpoint" ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={pptTitle}
                    onChange={(e) => setPptTitle(e.target.value)}
                    placeholder="Enter PowerPoint title"
                  />
                </div>
                <div>
                  <Label>Upload PowerPoint</Label>
                  <Input
                    type="file"
                    accept=".ppt,.pptx"
                    onChange={(e) => setPptFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddPowerPoint} disabled={pptUploading}>
                    {pptUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add PowerPoint"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setActivityType(null);
                    setPptTitle("");
                    setPptFile(null);
                  }}>
                    Back
                  </Button>
                </div>
              </div>
            ) : activityType === "google_drive" ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={googleDriveTitle}
                    onChange={(e) => setGoogleDriveTitle(e.target.value)}
                    placeholder="Enter title"
                  />
                </div>
                <div>
                  <Label>Google Drive Link</Label>
                  <Input
                    value={googleDriveUrl}
                    onChange={(e) => setGoogleDriveUrl(e.target.value)}
                    placeholder="Paste Google Drive link"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddGoogleDrive} disabled={activityLoading}>
                    {activityLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActivityType(null);
                      setGoogleDriveUrl("");
                      setGoogleDriveTitle("");
                    }}
                  >
                    Back
                  </Button>
                </div>
              </div>
            ) : activityType === "video_lecture" ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Enter video title"
                  />
                </div>
                <div>
                  <Label>Upload Video</Label>
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddVideoLecture} disabled={activityLoading}>
                    {activityLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Add Video"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setActivityType(null);
                    setVideoTitle("");
                    setVideoFile(null);
                  }}>
                    Back
                  </Button>
                </div>
              </div>
            ) : activityType === "brief" ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Assessment Brief Content</Label>
                  <RichTextEditor
                    content={newAssignment.assessment_brief || ""}
                    onChange={(content) => setNewAssignment({ ...newAssignment, assessment_brief: content })}
                  />
                </div>
                <div>
                  <Label>Upload File (Optional)</Label>
                  <Input
                    type="file"
                    onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddAssessmentBrief} disabled={activityLoading}>
                    {activityLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Add Brief"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setActivityType(null);
                    setNewAssignment(getDefaultAssignmentState());
                    setAssignmentFile(null);
                  }}>
                    Back
                  </Button>
                </div>
              </div>
            ) : activityType === "quiz" ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newQuiz.title}
                    onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Quiz URL</Label>
                  <Input
                    value={newQuiz.quiz_url}
                    onChange={(e) => setNewQuiz({ ...newQuiz, quiz_url: e.target.value })}
                    placeholder="Enter external quiz URL"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <RichTextEditor
                    content={newQuiz.description || ""}
                    onChange={(content) => setNewQuiz({ ...newQuiz, description: content })}
                  />
                </div>
                <div>
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={newQuiz.duration}
                    onChange={(e) => setNewQuiz({ ...newQuiz, duration: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="datetime-local"
                    value={newQuiz.due_date}
                    onChange={(e) => setNewQuiz({ ...newQuiz, due_date: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddQuiz} disabled={activityLoading}>
                    {activityLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Add Quiz"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setActivityType(null);
                    setNewQuiz({
                      title: "",
                      quiz_url: "",
                      description: "",
                      duration: 30,
                      due_date: ""
                    });
                  }}>
                    Back
                  </Button>
                </div>
              </div>
            ) : null}
            {uploadProgress !== null && (
              <div className="mt-4 text-sm text-muted-foreground">
                {activeUploadMode === "chunked"
                  ? "Chunked upload"
                  : activeUploadMode === "direct"
                    ? "Direct upload"
                    : "Uploading"}
                : {uploadProgress}% complete
              </div>
            )}
          </DialogContent>
        </Dialog>

        <CertificateGeneratedDialog
          open={certificateDialogOpen}
          onOpenChange={setCertificateDialogOpen}
        />
      </DashboardLayout>
    );
  }

  // Student view - redesigned for clarity
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex items-center gap-4 px-4 py-3 md:px-6 max-w-[1400px]">
          <UECampusLogoLink className="h-9 w-auto" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="truncate text-sm md:text-base font-semibold text-slate-800">
                {safeCourse.title}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="h-1.5 w-32 md:w-48 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-[#5b3fd6]"
                    style={{ width: `${displayedProgress}%` }}
                  />
                </div>
                <span>{displayedProgress}% Learnt</span>
              </div>
            </div>
            {safeCourse.code && <p className="text-xs text-slate-400">{safeCourse.code}</p>}
          </div>
            <div className="hidden md:flex items-center gap-2">
              <Link to="/courses">
                <Button variant="outline" size="sm">
                  My Courses
                </Button>
              </Link>
            </div>
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open course sidebar"
              >
                <Menu className="h-5 w-5 text-slate-500" />
              </Button>
            </div>
        </div>
      </header>

        <div className="relative flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-hidden">
              <div className="w-full h-full">
                <div className="h-full bg-white overflow-hidden">
                  <FileViewer file={selectedFile} onAssignmentSubmitted={loadUserSubmissions} />
                </div>
              </div>
            </div>
          </div>

          <aside
            className={cn(
              "border-l border-slate-200 bg-white/95 transition-all duration-200",
              isMobile
                ? "absolute inset-y-0 right-0 z-30 w-[85vw] max-w-[340px]"
                : "relative w-[340px]",
              isMobile
                ? sidebarOpen
                  ? "translate-x-0"
                  : "translate-x-full pointer-events-none"
                : "translate-x-0"
            )}
          >
            <div className="h-full flex flex-col">
              <div className="px-5 pt-4">
              <div className="flex items-center gap-6 border-b border-slate-200">
                <button
                  onClick={() => setSidebarPanel("content")}
                  className={cn(
                    "relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors",
                    sidebarPanel === "content"
                      ? "text-slate-900 after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[#5b3fd6] after:content-['']"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Content
                </button>
                <button
                  onClick={() => setSidebarPanel("assessment")}
                  className={cn(
                    "relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors",
                    sidebarPanel === "assessment"
                      ? "text-slate-900 after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[#5b3fd6] after:content-['']"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <ClipboardList className="h-4 w-4" />
                  Assessment
                </button>
                  <button
                    onClick={() => setSidebarPanel("quizzes")}
                    className={cn(
                      "relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors",
                      sidebarPanel === "quizzes"
                        ? "text-slate-900 after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[#5b3fd6] after:content-['']"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <FileQuestion className="h-4 w-4" />
                    Quizzes
                  </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-4 pb-6 pt-4 space-y-4">
              {sidebarPanel === "content" && (
                <>
                  {contentSections.map((section) => {
                    const isOpen = openSections[section.id] ?? true;
                    const itemCount = section.items.length;
                    return (
                      <div
                        key={section.id}
                        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                      >
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-[#5b3fd6] text-white flex items-center justify-center">
                              <LayoutGrid className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <h3 className="font-semibold text-sm text-slate-900">{section.title}</h3>
                              <p className="text-xs text-slate-400">
                                {itemCount} Topic{itemCount === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="border-t border-slate-100 bg-slate-50/80">
                            {section.items.map((item, itemIdx) =>
                              renderSidebarButton(item, itemIdx, { showCompletion: true })
                            )}
                            {section.items.length === 0 && (
                              <div className="px-4 py-3 text-xs text-slate-400">
                                No content in this unit yet.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {contentSections.length === 0 && (
                    <Card className="p-4 text-center text-slate-500">
                      <p className="text-sm">No course content available yet.</p>
                    </Card>
                  )}
                </>
              )}

              {sidebarPanel === "assessment" && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-800">Assessments</h3>
                    <p className="text-xs text-slate-400">{assessmentItems.length} Items</p>
                  </div>
                  {assessmentItems.length ? (
                    assessmentItems.map((item, idx) => renderSidebarButton(item, idx))
                  ) : (
                    <div className="px-4 py-6 text-xs text-slate-400">No assessments available.</div>
                  )}
                </div>
              )}

                {sidebarPanel === "quizzes" && (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <h3 className="text-sm font-semibold text-slate-800">Quizzes</h3>
                      <p className="text-xs text-slate-400">{quizItems.length} Items</p>
                    </div>
                    {quizItems.length ? (
                      quizItems.map((item, idx) => renderSidebarButton(item, idx))
                    ) : (
                      <div className="px-4 py-6 text-xs text-slate-400">No quizzes available.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {isMobile && sidebarOpen && (
            <div
              className="absolute inset-0 bg-slate-900/40 z-20"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </div>

        <Dialog
          open={!!pendingQuizStart}
          onOpenChange={(open) => {
            if (!open) setPendingQuizStart(null);
          }}
        >
        <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Start Quiz</DialogTitle>
              <DialogDescription>
                {pendingQuizStart
                  ? `Please confirm your details before starting "${pendingQuizStart.title}". Once started you cannot retake this quiz.`
                  : "Preparing quiz..."}
              </DialogDescription>
            </DialogHeader>
            <div className="text-xs text-muted-foreground">
              This activity will be recorded in your progress history and cannot be started twice.
            </div>
            <DialogFooter>
              <Button onClick={handleConfirmQuizStart} disabled={quizStartLoading}>
                {quizStartLoading ? "Starting..." : "Start Quiz"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={courseCompleteDialogOpen}
          onOpenChange={setCourseCompleteDialogOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Course Completed</DialogTitle>
              <DialogDescription>
                Great job! You submitted all assignments and completed every lesson in this course.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setCourseCompleteDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {selectedFile &&
        selectedFile.file_path &&
        !selectedFile._isQuiz &&
        !selectedFile._isAssignment &&
        selectedFile.file_type !== "text/html" && (
          <div className="border-t bg-card p-4 flex items-center justify-between">
            <span className="text-sm font-medium">Download the file</span>
            <Button
              onClick={() => {
                if (selectedFile.file_path) {
                  downloadMaterial(selectedFile.file_path, selectedFile.title);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        )}
    </div>
  );
}
