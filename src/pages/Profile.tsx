import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, User } from "lucide-react";
import { apiFetch, resolveStorageUrl } from "@/lib/api";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userId, setUserId] = useState("");
  const [idDocumentUrl, setIdDocumentUrl] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserForIdUpload, setSelectedUserForIdUpload] = useState<string>("");
  const selectedUserName = useMemo(() => {
    const selected = users.find((u) => u.id === selectedUserForIdUpload);
    return selected?.full_name || selected?.email || "selected user";
  }, [users, selectedUserForIdUpload]);
  const selectedUserIdDocumentUrl = useMemo(() => {
    if (!isAdmin) return idDocumentUrl;
    const selected = users.find((u) => u.id === selectedUserForIdUpload);
    return selected?.id_document_url || "";
  }, [isAdmin, users, selectedUserForIdUpload, idDocumentUrl]);
  const resolvedIdDocumentUrl = useMemo(
    () => resolveStorageUrl(selectedUserIdDocumentUrl),
    [selectedUserIdDocumentUrl]
  );

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      void loadUsers();
    }
  }, [isAdmin, user]);


  const loadProfile = async () => {
    try {
      // use current auth user data for initial state
      setFullName(user?.full_name || "");
      const url = user?.avatar_url || "";
      setAvatarUrl(url);
      setIdDocumentUrl(user?.id_document_url || "");
      try {
        if (url) localStorage.setItem("avatar_url", url);
      } catch {
        // ignore
      }
      setUserId(user?.user_code || "Not assigned");
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiFetch<any[]>("/users");
      setUsers(data || []);
      setSelectedUserForIdUpload(
        (prev) =>
          prev ||
          data?.[0]?.id ||
          user?.id ||
          ""
      );
    } catch (error) {
      console.error("Error loading users for ID upload:", error);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const form = new FormData();
      form.append("avatar", file);
      const res = await apiFetch<{ avatar_url: string }>("/profile/avatar", {
        method: "POST",
        body: form,
      });

      setAvatarUrl(res.avatar_url);
      try {
        localStorage.setItem("avatar_url", res.avatar_url);
      } catch {
        // ignore
      }

      toast.success("Avatar uploaded successfully");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleIdUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIdUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

    const targetUserId =
      (isAdmin ? selectedUserForIdUpload : user?.id) || user?.id || "";
    if (!targetUserId) {
      toast.error("Select a user before uploading an ID document");
      return;
    }
    const file = event.target.files[0];
    const form = new FormData();
    form.append("id_document", file);
    form.append("user_id", targetUserId);
      const res = await apiFetch<{ id_document_url: string }>("/profile/id-document", {
        method: "POST",
        body: form,
      });

      if (res?.id_document_url && targetUserId === user?.id) {
        setIdDocumentUrl(res.id_document_url);
      }

      const targetName = users.find((u) => u.id === targetUserId)?.full_name || targetUserId;
      toast.success(`ID document uploaded for ${targetName}`);
      await loadUsers();
      event.target.value = "";
    } catch (error) {
      console.error("Error uploading ID document:", error);
      toast.error("Failed to upload ID document");
    } finally {
      setIdUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);

      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName }),
      });

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIdDocument = async () => {
    const targetUserId = (isAdmin ? selectedUserForIdUpload : user?.id) || user?.id || "";
    if (!targetUserId) {
      toast.error("Select a user before deleting an ID document");
      return;
    }
    const selectedLabel = isAdmin
      ? `${selectedUserName} (${targetUserId})`
      : "your account";
    if (!confirm(`Delete ID document for ${selectedLabel}? This action cannot be undone.`)) {
      return;
    }
    try {
      await apiFetch("/profile/id-document", {
        method: "DELETE",
        body: JSON.stringify({ user_id: targetUserId }),
      });
      if (targetUserId === user?.id) {
        setIdDocumentUrl("");
      }
      await loadUsers();
      toast.success("ID document deleted");
    } catch (error) {
      console.error("Error deleting ID document:", error);
      toast.error("Failed to delete ID document");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container max-w-4xl py-8">
      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
            Profile Settings
          </CardTitle>
          <CardDescription>
            Manage your account information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-32 w-32 border-4 border-primary/20">
              <AvatarImage src={avatarUrl} alt={fullName || "User"} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {fullName ? fullName.charAt(0).toUpperCase() : <User className="h-12 w-12" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button
                  variant="outline"
                  disabled={uploading}
                  className="relative"
                  asChild
                >
                  <span>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Avatar
                      </>
                    )}
                  </span>
                </Button>
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploading}
              />
            </div>
          </div>

          {/* Profile Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="text"
                value={userId}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Your unique user identifier assigned by the administrator.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={user.email || ""}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact administrator if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
              <p className="text-xs text-muted-foreground">
                You can edit your name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value="••••••••"
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Contact administrator to reset your password.
              </p>
            </div>
          </div>

          <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">ID Document</p>
                <p className="text-xs text-muted-foreground">
                  Visible to students when uploaded
                </p>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[200px]">
                    <Select
                      value={selectedUserForIdUpload}
                      onValueChange={setSelectedUserForIdUpload}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email || u.user_code || "Unknown user"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploading ID for {selectedUserName}
                  </p>
                </div>
                  <Label htmlFor="id-upload" className="cursor-pointer mb-0">
                    <Button
                      variant="outline"
                      disabled={idUploading}
                      className="min-w-[120px]"
                      asChild
                    >
                      <span>
                        {idUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload ID
                          </>
                        )}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="id-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleIdUpload}
                    className="hidden"
                    disabled={idUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteIdDocument}
                    disabled={idUploading || !selectedUserIdDocumentUrl}
                    className="min-w-[120px]"
                  >
                    Delete ID
                  </Button>
                </div>
              )}
            </div>
            {selectedUserIdDocumentUrl ? (
              <a
                href={resolvedIdDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-sm underline"
              >
                View uploaded ID document
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                No ID document uploaded yet.
              </p>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={loading}
              className="min-w-32"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
