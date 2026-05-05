export function Card({ className = "", children }) {
  return <div className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}

export function CardHeader({ className = "", children }) {
  return <div className={`mb-4 space-y-1 ${className}`}>{children}</div>;
}

export function CardTitle({ className = "", children }) {
  return <h2 className={`text-xl font-semibold text-gray-900 ${className}`}>{children}</h2>;
}

export function CardDescription({ className = "", children }) {
  return <p className={`text-sm text-gray-600 ${className}`}>{children}</p>;
}

export function CardContent({ className = "", children }) {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
}

