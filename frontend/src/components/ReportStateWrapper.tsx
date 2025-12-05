import type { ReactNode } from "react";

export interface ReportStateWrapperProps {
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether the data array is empty */
  isEmpty: boolean;
  /** Content to render when data is available */
  children: ReactNode;
  /** Custom loading message (default: "Loading...") */
  loadingMessage?: string;
  /** Custom empty message (default: "No data for this period") */
  emptyMessage?: string;
}

/**
 * Wrapper component that handles loading, error, and empty states consistently.
 * Renders children only when data is available.
 */
export default function ReportStateWrapper({
  loading,
  error,
  isEmpty,
  children,
  loadingMessage = "Loading...",
  emptyMessage = "No data for this period",
}: ReportStateWrapperProps) {
  if (loading) {
    return <div className="p-6 text-gray-600">{loadingMessage}</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 p-3 rounded">{error}</div>
    );
  }

  if (isEmpty) {
    return <div className="p-6 text-gray-500">{emptyMessage}</div>;
  }

  return <>{children}</>;
}
