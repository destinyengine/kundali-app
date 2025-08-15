import KundaliForm from "@/components/kundali/kundali-form";

export default function GenerateKundaliPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
            Generate your Kundali
          </h1>
          <p className="text-lg text-muted-foreground">
            Enter your birth details to generate a personalized Vedic astrological birth chart
          </p>
        </div>
        
        <KundaliForm />
      </div>
    </div>
  );
}