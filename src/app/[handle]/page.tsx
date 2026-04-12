interface StorefrontPageProps {
  params: Promise<{ handle: string }>;
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { handle } = await params;

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 pt-8">
      <h1 className="text-3xl font-black text-white">@{handle}</h1>
      <p className="mt-2 text-white/60">Public storefront — coming soon</p>
    </main>
  );
}
