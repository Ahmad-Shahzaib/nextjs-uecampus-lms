import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, API_BASE_URL, getAuthToken } from "@/lib/api";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type TranscriptUnit = {
  id?: string;
  unit_title: string;
  level: string | number;
  credit: number | null;
  glh: number | null;
  exam: string | null;
  group_type: "mandatory" | "optional";
  group_order: number;
  unit_order: number;
  result?: string | null;
};

type Transcript = {
  id: string;
  user_id: string;
  level: string;
  units: TranscriptUnit[];
  file_url?: string;
};

const LEVEL_2_MANDATORY: TranscriptUnit[] = [
  {
    unit_title: "Foundation English Language",
    level: 2,
    credit: 9,
    glh: 90,
    exam: "LRN",
    group_type: "mandatory",
    group_order: 1,
    unit_order: 1,
  },
  {
    unit_title: "Introduction to Mathematics",
    level: 2,
    credit: 9,
    glh: 90,
    exam: "LRN",
    group_type: "mandatory",
    group_order: 1,
    unit_order: 2,
  },
  {
    unit_title: "Study Skills",
    level: 2,
    credit: 3,
    glh: 30,
    exam: "LRN",
    group_type: "mandatory",
    group_order: 1,
    unit_order: 3,
  },
];

const LEVEL_2_OPTIONAL: TranscriptUnit[] = [
  {
    unit_title: "Introduction to Biology",
    level: 2,
    credit: 9,
    glh: 90,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 1,
  },
  {
    unit_title: "Introduction to Chemistry",
    level: 2,
    credit: 9,
    glh: 90,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 2,
  },
  {
    unit_title: "Introduction to Physics",
    level: 2,
    credit: 9,
    glh: 90,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 3,
  },
  {
    unit_title: "Introduction to Business",
    level: 2,
    credit: 4,
    glh: 40,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 4,
  },
  {
    unit_title: "Introduction to Computing",
    level: 2,
    credit: 4,
    glh: 40,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 5,
  },
  {
    unit_title: "Introduction to Accounting",
    level: 2,
    credit: 4,
    glh: 40,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 6,
  },
  {
    unit_title: "Introduction to Economics",
    level: 2,
    credit: 4,
    glh: 40,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 7,
  },
  {
    unit_title: "Introduction to Sociology",
    level: 2,
    credit: 7,
    glh: 70,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 8,
  },
  {
    unit_title: "Introduction to Hospitality",
    level: 2,
    credit: 4,
    glh: 40,
    exam: "LRN",
    group_type: "optional",
    group_order: 2,
    unit_order: 9,
  },
];

const buildLevel2Units = (): TranscriptUnit[] => [
  ...LEVEL_2_MANDATORY.map((unit) => ({ ...unit, result: "" })),
  ...LEVEL_2_OPTIONAL.map((unit) => ({ ...unit, result: "" })),
];

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const wrapText = (text: string, font: any, size: number, maxWidth: number) => {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const generateTranscriptPdfBase64 = async ({
  studentName,
  level,
  units,
}: {
  studentName: string;
  level: string;
  units: TranscriptUnit[];
}) => {
  const templateUrl = `${API_BASE_URL}/transcripts/template`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let templateBytes: ArrayBuffer;
  try {
    const token = getAuthToken();
    templateBytes = await fetch(templateUrl, {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load transcript template");
      }
      return res.arrayBuffer();
    });
  } finally {
    clearTimeout(timer);
  }

  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageHeight = page.getHeight();
  const pageWidth = page.getWidth();

  const fromTop = (y: number) => pageHeight - y;
  const coverTop = 190;
  const coverBottom = 610;
  page.drawRectangle({
    x: 60,
    y: fromTop(coverBottom),
    width: pageWidth - 120,
    height: coverBottom - coverTop,
    color: rgb(1, 1, 1),
  });

  const bodySize = 10;
  const smallSize = 9;
  const left = 72;

  page.drawText(`Name: ${studentName}`, {
    x: left,
    y: fromTop(197),
    size: bodySize,
    font,
  });
  page.drawText(`Qualification Title: ${level} Internal Marking Sheet`, {
    x: left,
    y: fromTop(226),
    size: bodySize,
    font,
  });

  const statement =
    "This is to certify that the learner has been awarded the following unit credits for achieving the learning outcomes of the qualification.";
  const statementLines = wrapText(statement, font, smallSize, pageWidth - 140);
  let statementY = fromTop(260);
  statementLines.forEach((line) => {
    page.drawText(line, { x: left, y: statementY, size: smallSize, font });
    statementY -= 12;
  });

  const titleX = left;
  const levelX = 350;
  const creditX = 395;
  const glhX = 435;
  const examX = 475;
  const resultX = 515;

  const drawHeader = (y: number) => {
    page.drawText("Unit Title", { x: titleX, y, size: smallSize, font });
    page.drawText("Level", { x: levelX, y, size: smallSize, font });
    page.drawText("Credit", { x: creditX, y, size: smallSize, font });
    page.drawText("GLH", { x: glhX, y, size: smallSize, font });
    page.drawText("Exam", { x: examX, y, size: smallSize, font });
    page.drawText("Result", { x: resultX, y, size: smallSize, font });
  };

  const drawRow = (unit: TranscriptUnit, y: number) => {
    const maxTitleWidth = levelX - titleX - 10;
    const titleLines = wrapText(unit.unit_title, font, smallSize, maxTitleWidth);
    const lineHeight = 12;
    titleLines.forEach((line, idx) => {
      page.drawText(line, { x: titleX, y: y - idx * lineHeight, size: smallSize, font });
    });
    const rowY = y;
    page.drawText(String(unit.level ?? ""), { x: levelX, y: rowY, size: smallSize, font });
    page.drawText(unit.credit !== null && unit.credit !== undefined ? String(unit.credit) : "", {
      x: creditX,
      y: rowY,
      size: smallSize,
      font,
    });
    page.drawText(unit.glh !== null && unit.glh !== undefined ? String(unit.glh) : "", {
      x: glhX,
      y: rowY,
      size: smallSize,
      font,
    });
    page.drawText(unit.exam || "", { x: examX, y: rowY, size: smallSize, font });
    page.drawText(unit.result || "", { x: resultX, y: rowY, size: smallSize, font });
    return Math.max(1, titleLines.length) * lineHeight;
  };

  let cursorY = fromTop(310);
  page.drawText("Mandatory Units (21 credits must be achieved)", {
    x: left,
    y: cursorY,
    size: smallSize,
    font,
  });
  cursorY -= 12;
  page.drawText("Externally set assignments which are externally marked by LRN (*)", {
    x: left,
    y: cursorY,
    size: 8,
    font,
  });
  cursorY -= 18;
  drawHeader(cursorY);
  cursorY -= 16;

  const mandatoryUnits = units.filter((u) => u.group_type === "mandatory");
  const optionalUnits = units.filter((u) => u.group_type === "optional");

  mandatoryUnits.forEach((unit) => {
    const rowHeight = drawRow(unit, cursorY);
    cursorY -= rowHeight;
  });

  cursorY -= 16;
  page.drawText("Optional Units (dependent on qualification)", {
    x: left,
    y: cursorY,
    size: smallSize,
    font,
  });
  cursorY -= 12;
  page.drawText("Externally set assignments which are externally marked by LRN", {
    x: left,
    y: cursorY,
    size: 8,
    font,
  });
  cursorY -= 18;
  drawHeader(cursorY);
  cursorY -= 16;

  optionalUnits.forEach((unit) => {
    const rowHeight = drawRow(unit, cursorY);
    cursorY -= rowHeight;
  });

  const totalCredits = units.reduce((sum, unit) => sum + (unit.credit || 0), 0);
  const totalY = fromTop(590);
  page.drawText(`Total Credits: ${totalCredits}`, {
    x: left,
    y: Math.min(cursorY - 10, totalY),
    size: smallSize,
    font,
  });

  const pdfBytes = await pdfDoc.save();
  return encodeBase64(pdfBytes);
};

const buildTranscriptFileUrl = (id: string, fileUrl?: string) => {
  let url = fileUrl || `${API_BASE_URL}/transcripts/${id}/file`;
  if (typeof window !== "undefined") {
    const isHttps = window.location.protocol === "https:";
    if (isHttps && url.startsWith("http://")) {
      url = `/api/transcripts/${id}/file`;
    }
  }
  return url;
};

export default function Transcript() {
  const { user, isAdmin } = useAuth();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [viewUserId, setViewUserId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("Level 2");
  const [units, setUnits] = useState<TranscriptUnit[]>(buildLevel2Units());
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const initUserId = user.id;
    setViewUserId(initUserId);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadTranscripts(viewUserId || user.id);
  }, [user, viewUserId]);

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      const data = await apiFetch<any[]>("/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTranscripts = async (targetUserId: string) => {
    if (!targetUserId) return;
    try {
      const path = isAdmin ? `/transcripts?user_id=${targetUserId}` : "/transcripts";
      const data = await apiFetch<Transcript[]>(path);
      setTranscripts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setTranscripts([]);
    }
  };

  const currentTranscript = useMemo(() => {
    if (!transcripts.length) return null;
    const levelMatch = transcripts.find((t) => t.level === "Level 2");
    return levelMatch || transcripts[0];
  }, [transcripts]);

  const groupedUnits = useMemo(() => {
    const allUnits = currentTranscript?.units || [];
    return {
      mandatory: allUnits.filter((u) => u.group_type === "mandatory"),
      optional: allUnits.filter((u) => u.group_type === "optional"),
    };
  }, [currentTranscript]);

  useEffect(() => {
    let revokedUrl: string | null = null;
    const controller = new AbortController();

    const loadPdf = async () => {
      if (!currentTranscript) return;
      setPdfError(null);
      setPdfUrl(null);
      const token = getAuthToken();
      const fileUrl = buildTranscriptFileUrl(
        currentTranscript.id,
        currentTranscript.file_url
      );
      const url = token
        ? `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${token}`
        : fileUrl;
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Failed to load PDF (${res.status})`);
        }
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        revokedUrl = objectUrl;
        setPdfUrl(objectUrl);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setPdfError(err?.message || "Failed to load PDF");
      }
    };

    loadPdf();

    return () => {
      controller.abort();
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [currentTranscript?.id, currentTranscript?.file_url]);

  const handleUnitChange = (index: number, field: "credit" | "result", value: string) => {
    setUnits((prev) => {
      const next = [...prev];
      if (field === "credit") {
        next[index] = { ...next[index], credit: value ? Number(value) : null };
      } else {
        next[index] = { ...next[index], result: value };
      }
      return next;
    });
  };

  const handleOpenDialog = () => {
    setSelectedUser("");
    setSelectedLevel("Level 2");
    setUnits(buildLevel2Units());
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser) {
      toast.error("Select a user");
      return;
    }
    setSaving(true);
    try {
      const selectedUserInfo = users.find((u) => u.id === selectedUser);
      const studentName =
        selectedUserInfo?.full_name || selectedUserInfo?.email || "Student";
      const pdfBase64 = await Promise.race([
        generateTranscriptPdfBase64({
          studentName,
          level: selectedLevel,
          units,
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Transcript generation timed out")), 15000)
        ),
      ]);
      const payload = {
        user_id: selectedUser,
        level: selectedLevel,
        units,
        pdf_base64: pdfBase64,
      };
      await apiFetch("/transcripts", { method: "POST", body: payload });
      toast.success("Transcript sent");
      setDialogOpen(false);
      if (viewUserId === selectedUser) {
        loadTranscripts(viewUserId);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to send transcript");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Internal Marking Sheet</h1>
          <p className="text-muted-foreground mt-1">
            Transcript of internal marking results
          </p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenDialog}>Add Transcript</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Add Transcript</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Select User</p>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Select Level</p>
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Level 2">Level 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold">
                        Mandatory Units (21 credits must be achieved)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Externally set assignments which are externally marked by LRN (*)
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground border-b">
                          <tr>
                            <th className="text-left py-2">Unit Title</th>
                            <th className="text-left py-2">Level</th>
                            <th className="text-left py-2">Credit</th>
                            <th className="text-left py-2">GLH</th>
                            <th className="text-left py-2">Exam</th>
                            <th className="text-left py-2">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {units
                            .filter((u) => u.group_type === "mandatory")
                            .map((unit, index) => {
                              const unitIndex = units.findIndex(
                                (entry) =>
                                  entry.unit_title === unit.unit_title &&
                                  entry.group_type === "mandatory"
                              );
                              return (
                              <tr key={`${unit.unit_title}-${index}`} className="border-b">
                                <td className="py-2">{unit.unit_title}</td>
                                <td className="py-2">{unit.level}</td>
                                <td className="py-2 w-24">
                                  <Input
                                    type="number"
                                    value={unit.credit ?? ""}
                                    onChange={(e) => handleUnitChange(unitIndex, "credit", e.target.value)}
                                    className="h-8"
                                  />
                                </td>
                                <td className="py-2">{unit.glh}</td>
                                <td className="py-2">{unit.exam}</td>
                                <td className="py-2 w-28">
                                  <Select
                                    value={unit.result || ""}
                                    onValueChange={(value) => handleUnitChange(unitIndex, "result", value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Result" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Pass">Pass</SelectItem>
                                      <SelectItem value="Fail">Fail</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold">Optional Units (dependent on qualification)</p>
                      <p className="text-sm text-muted-foreground">
                        Externally set assignments which are externally marked by LRN
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground border-b">
                          <tr>
                            <th className="text-left py-2">Unit Title</th>
                            <th className="text-left py-2">Level</th>
                            <th className="text-left py-2">Credit</th>
                            <th className="text-left py-2">GLH</th>
                            <th className="text-left py-2">Exam</th>
                            <th className="text-left py-2">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {units
                            .filter((u) => u.group_type === "optional")
                            .map((unit, index) => {
                              const unitIndex = units.findIndex(
                                (entry) => entry.unit_title === unit.unit_title && entry.group_type === "optional"
                              );
                              return (
                                <tr key={`${unit.unit_title}-${index}`} className="border-b">
                                  <td className="py-2">{unit.unit_title}</td>
                                  <td className="py-2">{unit.level}</td>
                                  <td className="py-2 w-24">
                                    <Input
                                      type="number"
                                      value={unit.credit ?? ""}
                                      onChange={(e) => handleUnitChange(unitIndex, "credit", e.target.value)}
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="py-2">{unit.glh}</td>
                                  <td className="py-2">{unit.exam}</td>
                                  <td className="py-2 w-28">
                                    <Select
                                      value={unit.result || ""}
                                      onValueChange={(value) => handleUnitChange(unitIndex, "result", value)}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Result" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Pass">Pass</SelectItem>
                                        <SelectItem value="Fail">Fail</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSave} className="w-full" disabled={saving}>
                  {saving ? "Sending..." : "Send Transcript"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isAdmin && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-medium">View transcript for</p>
              <Select value={viewUserId} onValueChange={setViewUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {!currentTranscript ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No transcript available yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {currentTranscript && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Transcript PDF</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const token = getAuthToken();
                      const fileUrl = buildTranscriptFileUrl(
                        currentTranscript.id,
                        currentTranscript.file_url
                      );
                      const url = token
                        ? `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${token}`
                        : fileUrl;
                      window.open(pdfUrl || url, "_blank");
                    }}
                  >
                    Download PDF
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden bg-muted/30 min-h-[400px] flex items-center justify-center">
                  {pdfError ? (
                    <p className="text-sm text-muted-foreground">{pdfError}</p>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      className="w-full h-[500px] border-0"
                      title="Transcript PDF"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading PDF...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">
                {currentTranscript.level} Internal Marking Sheet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div>
                  <p className="font-semibold">
                    Mandatory Units (21 credits must be achieved)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Externally set assignments which are externally marked by LRN (*)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2">Unit Title</th>
                        <th className="text-left py-2">Level</th>
                        <th className="text-left py-2">Credit</th>
                        <th className="text-left py-2">GLH</th>
                        <th className="text-left py-2">Exam</th>
                        <th className="text-left py-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedUnits.mandatory.map((unit) => (
                        <tr key={unit.id} className="border-b">
                          <td className="py-2">{unit.unit_title}</td>
                          <td className="py-2">{unit.level}</td>
                          <td className="py-2">{unit.credit ?? "-"}</td>
                          <td className="py-2">{unit.glh ?? "-"}</td>
                          <td className="py-2">{unit.exam ?? "-"}</td>
                          <td className="py-2">{unit.result || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="font-semibold">Optional Units (dependent on qualification)</p>
                  <p className="text-sm text-muted-foreground">
                    Externally set assignments which are externally marked by LRN
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2">Unit Title</th>
                        <th className="text-left py-2">Level</th>
                        <th className="text-left py-2">Credit</th>
                        <th className="text-left py-2">GLH</th>
                        <th className="text-left py-2">Exam</th>
                        <th className="text-left py-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedUnits.optional.map((unit) => (
                        <tr key={unit.id} className="border-b">
                          <td className="py-2">{unit.unit_title}</td>
                          <td className="py-2">{unit.level}</td>
                          <td className="py-2">{unit.credit ?? "-"}</td>
                          <td className="py-2">{unit.glh ?? "-"}</td>
                          <td className="py-2">{unit.exam ?? "-"}</td>
                          <td className="py-2">{unit.result || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
