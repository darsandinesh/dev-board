import { ErrorState } from "@/components/ErrorState";

export default function NotFound() {
  return (
    <ErrorState
      code="404"
      title="Page not found"
      message="The page you’re looking for doesn’t exist or may have moved."
    />
  );
}
