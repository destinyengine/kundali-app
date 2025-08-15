import KundaliForm from "@/components/kundali/kundali-form";

export default function GenerateKundaliPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-6">
        <div className="mb-6 md:mb-8 text-center">
          <h1 className="mb-2 md:mb-3 text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Generate your Kundali
          </h1>
          <p className="text-base md:text-lg text-muted-foreground px-4">
            Enter your birth details to generate a personalized Vedic astrological birth chart
          </p>
        </div>
        
        <KundaliForm />
      </div>
    </div>
  );
}