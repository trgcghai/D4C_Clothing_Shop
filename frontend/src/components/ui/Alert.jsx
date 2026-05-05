export default function Alert({ children, variant = "error", className = "" }) {
  const variants = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-green-200 bg-green-50 text-green-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return <div className={`rounded-md border p-3 text-sm ${variants[variant] || variants.error} ${className}`}>{children}</div>;
}

