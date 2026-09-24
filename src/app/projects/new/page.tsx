import { ProjectForm } from "@/components/project-form";

export default function NewProjectPage() {
  return (
    <div className="max-w-4xl px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold">New project</h1>
      <p className="mb-6 text-sm text-ink-500">
        Start with the basics. You can upload brand documents and refine the 3C profile afterwards.
      </p>
      <ProjectForm />
    </div>
  );
}
