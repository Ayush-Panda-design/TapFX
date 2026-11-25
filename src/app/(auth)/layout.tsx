import { SiteFooter, SiteHeader } from "@/components/site-header";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-12">{children}</main>
      <SiteFooter />
    </>
  );
}
