import LMSGuides from "@/components/LMSGuides";
import UECampusGuides from "@/components/UECampusGuides";
import { useEditMode } from "@/contexts/EditModeContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Guides() {
  const { isAdmin } = useEditMode();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Learning Guides
        </h1>
        <p className="text-muted-foreground mt-1">
          LMS tutorials and UECampus video guides
        </p>
      </div>

      <Tabs defaultValue="lms-guides" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-2">
          <TabsTrigger value="lms-guides">LMS Guides</TabsTrigger>
          <TabsTrigger value="uecampus-guides">UECampus Guides</TabsTrigger>
        </TabsList>

        <TabsContent value="lms-guides" className="mt-6">
          <LMSGuides isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="uecampus-guides" className="mt-6">
          <UECampusGuides isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
