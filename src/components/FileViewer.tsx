// src/components/FileViewer.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, ExternalLink, FileText, File as FileIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignmentSubmissionStatus } from "@/components/AssignmentSubmissionStatus";
import { useAuth } from "@/hooks/useAuth";

/* ============================== Types & utils ============================== */
interface LMSFile {
  title: string;
  file_path?: string;
  file_type: string;
  description?: string;
  _isAssignment?: boolean;
  _isQuiz?: boolean;
  _isBrief?: boolean;
  quiz_url?: string;
  assessment_brief?: string;
  id?: string;
  feedback?: string;
  points?: number;
  passing_marks?: number;
  due_date?: string;
  attempts?: number;
  course?: string;
  course_id?: string;
  rubrics?: string;
  rubrics_file_url?: string;
}

interface FileViewerProps {
  file: LMSFile | null;
  onAssignmentSubmitted?: () => void;
}

const EXT = (p?: string) => (p ? p.toLowerCase().split(".").pop() || "" : "");
const isDocExt = (p?: string) => ["doc", "docx"].includes(EXT(p));
const isXlsExt = (p?: string) => ["xls", "xlsx"].includes(EXT(p));
const isOfficeExt = (p?: string) => ["doc", "docx", "xls", "xlsx"].includes(EXT(p));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const isHttpsPublic = (urlStr?: string) => {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    if (!/^https?:$/i.test(url.protocol)) return false;
    if (["localhost", "127.0.0.1"].includes(host)) return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
};

const googleViewer = (u: string) => `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(u)}`;

const normalizeGoogleUrl = (u?: string) => {
  if (!u) return "";
  const trimmed = u.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(drive|docs)\.google\.com/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
};

const extractDriveFileId = (url: URL) => {
  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const idParam = url.searchParams.get("id");
  if (idParam) return idParam;
  const ucId = url.pathname.includes("/uc") ? url.searchParams.get("id") : null;
  return ucId || "";
};

const buildGoogleEmbedUrl = (u?: string) => {
  const normalized = normalizeGoogleUrl(u);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();

    if (host.includes("drive.google.com")) {
      const fileId = extractDriveFileId(url);
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview?usp=sharing&embedded=true`;
      }
      return normalized;
    }

    if (host.includes("docs.google.com")) {
      const docMatch = url.pathname.match(/\/(document|presentation|spreadsheets|forms)\/d\/([^/]+)/);
      const docType = docMatch?.[1] || "";
      const docId = docMatch?.[2] || "";
      if (docType && docId) {
        return `https://docs.google.com/${docType}/d/${docId}/preview?usp=sharing&embedded=true`;
      }
      return normalized;
    }

    return "";
  } catch {
    return "";
  }
};

/* ============================== Inline PDF (no iframes) ============================== */
/* why: use local worker to avoid CSP/CDN issues */
export function InlinePdfViewer({
  url,
  fileId,
  initialScale = 1.25,
}: {
  url: string;
  fileId?: string;
  initialScale?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [scale, setScale] = useState(initialScale);
  const [renderTick, setRenderTick] = useState(0);

  useLayoutEffect(() => {
    setRenderTick((t) => t + 1);
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      if (!url) {
        setLoading(false);
        return;
      }
      const container = containerRef.current;
      if (!container) {
        return;
      }

      try {
        // Import legacy build and suppress TS checking because pdfjs-dist may not provide types in this setup
        // @ts-ignore
        const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"; // serve from /public

        const fetchUrl = url || (fileId ? `/materials/${fileId}/file` : "");
        if (!fetchUrl) throw new Error("PDF URL missing");
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

        container.innerHTML = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px auto";
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || "Failed to render PDF");
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [url, scale, renderTick]);

  return (
    <div className="w-full h-full overflow-auto">
      <div className="sticky top-0 z-10 flex gap-2 items-center justify-end p-2 border-b bg-background">
        <Button variant="outline" size="sm" onClick={() => setScale((s) => clamp(Math.round((s - 0.1) * 10) / 10, 0.5, 3))}>
          -
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="sm" onClick={() => setScale((s) => clamp(Math.round((s + 0.1) * 10) / 10, 0.5, 3))}>
          +
        </Button>
      </div>

      {err ? (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3 p-8">
          <p className="text-sm text-muted-foreground">PDF preview failed: {err}</p>
        </div>
      ) : (
        <>
          {loading && (
            <div className="flex items-center justify-center p-6">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          )}
          <div ref={containerRef} className="px-2 pb-8" />
        </>
      )}
    </div>
  );
}

/* ============================== Main ============================== */
export function FileViewer({ file, onAssignmentSubmitted }: FileViewerProps) {
  const { user } = useAuth();

  // data
  const [fileUrl, setFileUrl] = useState<string>(file?.file_path || "");
  const [loading, setLoading] = useState(true);
  const [textLessonContent, setTextLessonContent] = useState<string>("");
  const [textLessonLoading, setTextLessonLoading] = useState(false);

  // assignments
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [confirmSubmission, setConfirmSubmission] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(file?.attempts || 2);

  // type guards
  const pathOrTitle = `${file?.file_path || ""}|${file?.title || ""}`;
  const driveSource =
    (file as any)?.file_path ||
    (file as any)?.link_url ||
    (file as any)?.url ||
    "";
  const isPdf = useMemo(() => /pdf/i.test(file?.file_type || "") || EXT(pathOrTitle) === "pdf", [file, pathOrTitle]);
  const isVideo = useMemo(() => /video/i.test(file?.file_type || ""), [file]);
  const isImage = useMemo(() => /image/i.test(file?.file_type || ""), [file]);
  const isTextLesson = useMemo(() => /text\/html/i.test(file?.file_type || ""), [file]);
  const isGoogleDrive = useMemo(() => {
    const p = driveSource || "";
    return file?.file_type === "google_drive" || /drive\.google\.com|docs\.google\.com/i.test(p);
  }, [file, driveSource]);
  const googleEmbedUrl = isGoogleDrive
    ? buildGoogleEmbedUrl(driveSource) || normalizeGoogleUrl(driveSource)
    : "";
  const driveFileId = useMemo(() => {
    if (!isGoogleDrive || !driveSource) return "";
    try {
      const normalized = normalizeGoogleUrl(driveSource);
      const url = new URL(normalized);
      const host = url.hostname.toLowerCase();
      if (host.includes("drive.google.com")) {
        return extractDriveFileId(url);
      }
      return "";
    } catch {
      return "";
    }
  }, [driveSource, isGoogleDrive]);
  const driveDownloadUrl = driveFileId ? `https://drive.google.com/uc?export=download&id=${driveFileId}` : "";
  const pdfSrc = file?.file_path || fileUrl;
  const pdfFrameSrc = pdfSrc
    ? `${pdfSrc}${pdfSrc.includes("#") ? "" : "#view=FitH"}`
    : "";
  const publicUrl = isHttpsPublic(fileUrl);
  const viewerUrl = fileUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
    : "";
  const isWord = useMemo(() => {
    const ft = file?.file_type || "";
    return /msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/document/i.test(ft) || isDocExt(pathOrTitle);
  }, [file, pathOrTitle]);

  const isExcel = useMemo(() => {
    const ft = file?.file_type || "";
    return /vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i.test(ft) || isXlsExt(pathOrTitle);
  }, [file, pathOrTitle]);
  const isPowerPoint = useMemo(() => {
  const ft = file?.file_type || "";
  const typeMatch = /powerpoint|presentation|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml\.presentation/i.test(ft);
  return typeMatch || /\.(ppt|pptx)$/i.test(pathOrTitle);
}, [file, pathOrTitle]);
  const textLessonBody = textLessonContent || file?.description || "";
  const textLessonHasHtml = useMemo(() => /<\/?[a-z][\s\S]*>/i.test(textLessonBody), [textLessonBody]);

  // loaders
  const loadFile = async () => {
    if (!file || (!file.file_path && !file.id)) {
      setLoading(false);
      return;
    }
    try {
      // Static mode: prefer explicit file_path; otherwise fall back to a predictable path
      const url = file.file_path || (file.id ? `/materials/${file.id}/file` : "");
      if (!url) throw new Error("File URL missing");
      setFileUrl(url);
    } catch (error: any) {
      console.error("File load failed", error);
      toast.error("Failed to load file");
    } finally {
      setLoading(false);
    }
  };

  const loadTextLessonContent = async () => {
    if (!file || !isTextLesson) return;
    // Static mode: use inline content or description
    setTextLessonLoading(true);
    try {
      const html = (file as any).content || file.description || "";
      setTextLessonContent(html);
    } finally {
      setTextLessonLoading(false);
    }
  };

  const loadUserSubmissions = async () => {
    if (!file || !file._isAssignment || !user) return;
    // Static mode: use embedded submissions if provided, otherwise empty
    const subs = (file as any).submissions || [];
    setUserSubmissions((subs || []).filter((s) => s.assignment_id === file.id));
  };

  const loadAttempts = async () => {
    if (!file || !file._isAssignment || !user?.id) return;
    // Static: respect provided attempts on file
    setTotalAttempts(file.attempts || totalAttempts);
  };

  const downloadFile = () => {
    if (!file) return;
    try {
      const a = document.createElement("a");
      a.href = driveDownloadUrl || fileUrl || file.file_path || "";
      a.download = file.title || "download";
      a.rel = "noopener";
      a.target = "_blank";
      a.click();
    } catch {
      toast.error("Failed to download file");
    }
  };

  const renderOfficeViewer = (
    fallbackTitle: string,
    iframeSrc: string,
    options: { showPrivateWarning?: boolean } = {}
  ) => {
    if (!iframeSrc) return null;
    const viewerTitle = file?.title || fallbackTitle;
    return (
      <div className="flex flex-col h-full min-h-0 gap-0 bg-white">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
          <span className="text-sm font-semibold text-foreground">{viewerTitle}</span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {viewerUrl && (
              <Button asChild size="sm" variant="outline" className="px-3 py-1">
                <a href={viewerUrl} target="_blank" rel="noreferrer">
                  Open in Office
                </a>
              </Button>
            )}
            {fileUrl && (
              <Button asChild size="sm" variant="outline" className="px-3 py-1">
                <a href={fileUrl} download>
                  Download
                </a>
              </Button>
            )}
          </div>
        </div>
        <iframe
          src={iframeSrc}
          className="w-full flex-1 min-h-0 border-0 bg-white"
          title={`Preview of ${viewerTitle}`}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
        {options.showPrivateWarning && (
          <div className="px-6 py-2 border-t border-border/50 text-xs text-muted-foreground">
            Microsoft&apos;s viewer requires a publicly accessible link; open in a new tab if it does not load.
          </div>
        )}
      </div>
    );
  };

  // assignment submit (keep INSIDE to avoid TS2304)
  const handleSubmitAssignment = async () => {
    if (!file || !file._isAssignment || !submissionFile) {
      toast.error("Please select a file to submit");
      return;
    }
    if (!confirmSubmission) {
      toast.error("Please confirm that this submission is your own work");
      return;
    }
    setSubmitting(true);
    try {
      if (!user) throw new Error("Not authenticated");
      // Static mode: simulate submission
      await new Promise((res) => setTimeout(res, 500));
      toast.success("(Static) Assignment submitted successfully!");
      setSubmissionFile(null);
      setShowSubmissionForm(false);
      setConfirmSubmission(false);
      await loadUserSubmissions();
      onAssignmentSubmitted?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit assignment");
    } finally {
      setSubmitting(false);
    }
  };

  // effects
  useEffect(() => {
    if (!file) return;

    if (!file._isAssignment && !file._isQuiz) {
      if (isGoogleDrive) {
        setLoading(false);
      } else if (file.file_path && file.file_path.includes(".")) {
        loadFile();
      } else if (!file._isBrief) {
        loadFile();
      }
    }

    if (file._isAssignment) {
      loadUserSubmissions();
      setTotalAttempts(file.attempts || 2);
      loadAttempts();
    }

    setLoading(true);
    if (isTextLesson) {
      loadTextLessonContent();
    } else {
      setTextLessonContent("");
    }
  }, [file?.id, isGoogleDrive, isTextLesson]);

  /* ============================== Views ============================== */
  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center p-12">
          <FileIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No file selected</h3>
          <p className="text-muted-foreground">Select a file from the sidebar to view it here</p>
        </div>
      </div>
    );
  }

  // Quiz
  if (file._isQuiz && file.quiz_url) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="p-4 border-b bg-card">
          <h2 className="text-2xl font-bold">{file.title}</h2>
          {file.description && <p className="text-muted-foreground mt-1">{file.description}</p>}
        </div>
        <div className="flex-1">
          <iframe
            src={file.quiz_url}
            className="w-full h-full border-0"
            title={file.title}
            allow="fullscreen; autoplay"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    );
  }

  // Brief
  if (file._isBrief) {
    const canUseGoogle = isHttpsPublic(fileUrl);
    const briefIsPdf = isPdf;
    const briefLink = fileUrl ? (canUseGoogle ? googleViewer(fileUrl) : fileUrl) : "";

    return (
      <div className="h-full flex flex-col bg-background">
        <div className="p-4 border-b flex items-center justify-between bg-background sticky top-0 z-10">
          <h3 className="font-semibold text-lg">{file.title}</h3>
          {file.file_path && file.file_path.includes(".") && (
            <Button variant="outline" size="sm" onClick={downloadFile}>
              <Download className="h-4 w-4 mr-2" />
              Download Brief
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
            {file.file_path && file.file_path.includes(".") ? (
              briefIsPdf ? (
                <>
                  <InlinePdfViewer url={fileUrl} />
                  {briefLink && (
                    <div className="p-4 border-t bg-background flex justify-center">
                      <Button asChild size="sm" variant="outline" className="gap-2">
                        <a href={briefLink} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Open in Google Viewer
                        </a>
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    This document cannot be rendered inline; open it externally instead.
                  </p>
                  {briefLink && (
                    <Button asChild variant="outline">
                      <a href={briefLink} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Open Document
                      </a>
                    </Button>
                  )}
                </div>
              )
            ) : (
              <div className="w-full h-full p-8">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Assessment Brief</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">
                        {file.assessment_brief || file.description || "No brief content available"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
        </div>
      </div>
    );
  }

  // Assignment
  if (file._isAssignment) {
    const latestSubmission = userSubmissions.length > 0 ? userSubmissions[0] : null;
    const attemptNumber = userSubmissions.length;
    const hasAttemptsRemaining = attemptNumber < totalAttempts;

    if (latestSubmission && (!showSubmissionForm || !hasAttemptsRemaining)) {
      return (
      <div className="h-full overflow-auto bg-background">
        <div className="w-full h-full p-8">
          <AssignmentSubmissionStatus
            assignment={{
              id: file.id || "",
                title: file.title,
                due_date: file.due_date || null,
                points: file.points || 100,
                attempts: file.attempts || 2,
              }}
              submission={latestSubmission}
              attemptNumber={attemptNumber}
              totalAttempts={totalAttempts}
              onResubmit={() => {
                if (hasAttemptsRemaining) setShowSubmissionForm(true);
                else {
                  setUserSubmissions([]);
                  loadUserSubmissions();
                }
              }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto bg-background">
        <div className="w-full h-full p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold mb-2">{file.title}</h2>
            {file.description && <p className="text-muted-foreground">{file.description}</p>}
            <div className="flex gap-4 mt-3 text-sm">
              <div><span className="font-semibold">Total Marks:</span> {file.points}</div>
              <div><span className="font-semibold">Passing Marks:</span> {file.passing_marks}</div>
              {file.due_date && <div><span className="font-semibold">Due:</span> {new Date(file.due_date).toLocaleDateString()}</div>}
              <div><span className="font-semibold">Attempts:</span> {attemptNumber}/{totalAttempts}</div>
            </div>
          </div>
          {file.rubrics && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Rubrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                  {file.rubrics}
                </div>
              </CardContent>
            </Card>
          )}
          {file.rubrics_file_url && (
            <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              <a
                href={file.rubrics_file_url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Download Rubrics File
              </a>
            </div>
          )}

          {latestSubmission && showSubmissionForm && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Submitting attempt {attemptNumber + 1} of {totalAttempts}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setShowSubmissionForm(false)} className="mt-2">
                View Previous Submission
              </Button>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Submit Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Choose File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  onChange={(e) => {
                    setSubmissionFile(e.target.files?.[0] || null);
                    setConfirmSubmission(false);
                  }}
                />
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={confirmSubmission}
                  onCheckedChange={(value) => setConfirmSubmission(Boolean(value))}
                  id="confirm-submission"
                />
                <Label htmlFor="confirm-submission" className="text-sm">
                  I confirm that this is my work done by understanding the assignment requirements.
                </Label>
              </div>
              <Button
                onClick={handleSubmitAssignment}
                disabled={!submissionFile || submitting || !confirmSubmission}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {submitting ? "Submitting..." : "Submit Assignment"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Generic viewer (no PPT anywhere)
  const isDrive = isGoogleDrive && !!googleEmbedUrl;

  return (
    <div className="h-full flex flex-col bg-background">
      {!isPdf && (
        <div className="p-4 border-b flex items-center justify-between bg-background sticky top-0 z-10">
          <h3 className="font-semibold text-lg">{file.title}</h3>
          <Button variant="outline" size="sm" onClick={downloadFile}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto relative">
        {/* Google Drive */}
        {isDrive ? (
          isVideo && driveDownloadUrl ? (
            <div className="flex items-center justify-center h-full w-full p-6">
              <video src={driveDownloadUrl} controls className="w-full h-full rounded-lg shadow-lg object-contain" />
            </div>
          ) : (
            <iframe
              src={googleEmbedUrl}
              className="absolute inset-0 w-full h-full border-0"
              title={file.title}
              onLoad={() => setLoading(false)}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          )
        ) : null}

        {/* PDF */}
        {isPdf && pdfFrameSrc && (
          <div className="flex flex-col h-full min-h-0 gap-0 bg-white">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
              <span className="text-sm font-semibold text-foreground">{file?.title || "Document"}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {publicUrl && viewerUrl && (
                  <Button asChild size="sm" variant="outline" className="px-3 py-1">
                    <a href={viewerUrl} target="_blank" rel="noreferrer">
                      Open in Office
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="px-3 py-1">
                  <a href={pdfSrc} download>
                    Download
                  </a>
                </Button>
              </div>
            </div>
            <iframe
              src={pdfFrameSrc}
              className="w-full flex-1 min-h-0 border-0"
              title={`Preview of ${file?.title || "Document"}`}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        )}

        {/* Video */}
        {isVideo && fileUrl && (
          <div className="flex items-center justify-center h-full w-full p-6">
            <video src={fileUrl} controls className="w-full h-full rounded-lg shadow-lg object-contain" />
          </div>
        )}

        {/* Image */}
        {isImage && fileUrl && (
          <div className="flex items-center justify-center h-full w-full p-6">
            <img
              src={fileUrl}
              alt={file.title}
              className="w-full h-full object-contain rounded-lg shadow-lg"
            />
          </div>
        )}

        {/* HTML lesson */}
        {isTextLesson && (
          <div className="w-full h-full px-6 py-8 md:px-10">
            {textLessonLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : textLessonBody ? (
              textLessonHasHtml ? (
                <div
                  className="mx-auto max-w-4xl prose prose-2xl text-black
                    prose-headings:tracking-tight prose-headings:mt-6 prose-headings:mb-3
                    prose-headings:text-black prose-p:text-black prose-li:text-black prose-a:text-black prose-strong:text-black prose-em:text-black
                    prose-p:leading-relaxed prose-p:my-3 prose-li:my-2
                    [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-lg [&_iframe]:border-0
                    [&_video]:w-full [&_video]:max-w-full [&_video]:h-auto [&_video]:rounded-lg [&_video]:shadow-lg
                    [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg"
                  dangerouslySetInnerHTML={{ __html: textLessonBody }}
                />
              ) : (
                <div className="mx-auto max-w-4xl whitespace-pre-wrap text-base leading-relaxed text-black">
                  {textLessonBody}
                </div>
              )
            ) : (
              <div className="mx-auto max-w-4xl text-sm text-black">
                No text lesson content available.
              </div>
            )}
          </div>
        )}

        {/* PowerPoint preview */}
        {isPowerPoint && fileUrl && renderOfficeViewer(file?.title || "Presentation", viewerUrl, {
          showPrivateWarning: !publicUrl,
        })}

        {/* Word/Excel: public → Microsoft Viewer; private → local render */}
        {/* Word/Excel preview */}
        {(isWord || isExcel) && fileUrl && renderOfficeViewer(file?.title || "Document", viewerUrl, {
          showPrivateWarning: !publicUrl,
        })}

        {/* Unknown */}
        {!isDrive && !isPdf && !isVideo && !isImage && !isTextLesson && !isPowerPoint && !(isWord || isExcel) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
              <Button onClick={downloadFile}>
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
