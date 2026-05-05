export default function Button({ className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center rounded-md bg-purple-600 px-4 text-sm font-medium text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

