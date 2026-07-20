import { Suspense } from "react";
import { ContentDetail } from "@/components/content/content-detail";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="h-[50vh] skeleton mt-16" />}>
      <ContentDetail slug={slug} />
    </Suspense>
  );
}
