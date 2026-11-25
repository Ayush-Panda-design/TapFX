import { Card, LinkButton } from "@/components/ui";

export default function DashboardNotFound() {
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">QR code not found</h1>
      <p className="mt-2 text-muted-foreground">It may have been deleted, or it doesn&apos;t belong to your account.</p>
      <div className="mt-6">
        <LinkButton href="/dashboard">Back to your QR codes</LinkButton>
      </div>
    </Card>
  );
}
